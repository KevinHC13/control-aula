/**
 * Escribir un PDF de una o varias páginas, sin dependencias.
 *
 * Está en `services/` por lo mismo que `xlsx.ts`: es un formato del exterior, no
 * una fuente de la app. No toca la base ni la interfaz, no sabe qué es un alumno
 * y no sale a la red —un reporte se guarda en el iPad, con o sin internet—.
 *
 * **Por qué a mano y no con una librería.** Un PDF de texto es un archivo de
 * texto: unos cuantos objetos, una tabla de posiciones y un flujo de comandos de
 * dibujo. Y las catorce fuentes estándar —Helvetica entre ellas— no se incrustan,
 * las pone el lector, así que no hay que cargar ni un byte de tipografía. La
 * alternativa eran trescientos kilobytes de dependencia en una PWA que se instala
 * en un iPad para escribir una tabla de cinco renglones. Es la misma cuenta que
 * ya se hizo con SheetJS.
 *
 * Y hay una razón que no es el tamaño: en una PWA instalada en iPadOS,
 * `window.print()` —el otro camino al PDF— no es de fiar. Esto genera el archivo
 * y lo entrega a la hoja de compartir, que es el camino que el respaldo ya tiene
 * probado.
 *
 * Escribe lo que hace falta y nada más: texto en Helvetica, unos tamaños,
 * negritas y líneas. Sin imágenes, sin color más allá del gris de las reglas, sin
 * enlaces. El día que un reporte pida una gráfica, esto no sirve y hay que
 * decirlo en vez de estirarlo.
 *
 * **Todo va en Latin-1** (`WinAnsiEncoding`), que cubre el español entero
 * —acentos, la eñe, los signos de apertura y las comillas angulares—. Lo que no
 * quepa se sustituye antes de escribir, nunca se cuela un byte suelto: un PDF con
 * la tabla de posiciones corrida no se abre a medias, no se abre.
 */

/** Un bloque del documento. Quien lo arma describe; esto dibuja. */
export type BloquePdf =
  /** La cifra grande de un reporte, con su leyenda debajo. */
  | { tipo: 'cifra'; valor: string; leyenda: string; detalle?: string }
  /** Un título de sección dentro del documento. */
  | { tipo: 'seccion'; texto: string }
  /** Una tabla de dos columnas: etiqueta a la izquierda, cifra a la derecha. */
  | {
      tipo: 'tabla'
      encabezados: { izquierda: string; derecha: string }
      filas: { etiqueta: string; detalle?: string; valor: string }[]
    }
  /** Un párrafo pequeño: el criterio con el que se calculó lo de arriba. */
  | { tipo: 'nota'; texto: string }

export interface DocumentoPdf {
  /** Va en el encabezado de la primera página y en las propiedades del archivo. */
  titulo: string
  /** La línea de contexto: el periodo, el grupo. */
  subtitulo?: string
  bloques: BloquePdf[]
}

/** A4 en puntos, que es la unidad del formato. */
const ANCHO = 595.28
const ALTO = 841.89
const MARGEN = 56

const NORMAL = 'F1'
const NEGRITA = 'F2'

/**
 * Anchos de Helvetica por carácter, en milésimas de punto, para los imprimibles
 * de ASCII. Son los de la métrica oficial de la fuente, y hacen falta para dos
 * cosas: alinear una columna a la derecha y saber dónde cortar un renglón.
 */
const TABLA_NORMAL =
  '278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 ' +
  '556 556 556 556 556 556 556 556 556 556 278 278 584 584 584 556 ' +
  '1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 ' +
  '667 778 722 667 611 722 667 944 667 667 611 278 278 278 469 556 ' +
  '333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 ' +
  '556 556 333 500 278 556 500 722 500 500 500 334 260 334 584'

const TABLA_NEGRITA =
  '278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 ' +
  '556 556 556 556 556 556 556 556 556 556 333 333 584 584 584 611 ' +
  '975 722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 ' +
  '667 778 722 667 611 722 667 944 667 667 611 333 278 333 584 556 ' +
  '333 556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 ' +
  '611 611 389 556 333 611 556 778 556 556 500 389 280 389 584'

function tabla(crudo: string): Record<string, number> {
  const anchos: Record<string, number> = {}
  crudo.split(' ').forEach((ancho, i) => {
    anchos[String.fromCharCode(32 + i)] = Number(ancho)
  })
  return anchos
}

const ANCHOS_NORMAL = tabla(TABLA_NORMAL)
const ANCHOS_NEGRITA = tabla(TABLA_NEGRITA)

/**
 * Lo que no es ASCII, resuelto una vez.
 *
 * Una letra acentuada mide **lo mismo que su letra**: es la misma forma con un
 * signo encima, y la métrica de Helvetica lo confirma. Así que en vez de una
 * segunda tabla de doscientas entradas, se le quita el acento para medirla. Lo
 * que no es una letra —los signos de apertura, las comillas angulares, los
 * guiones largos— sí va escrito, porque no se parece a nada de ASCII.
 */
const ANCHOS_SUELTOS: Record<string, number> = {
  '¡': 333,
  '¿': 611,
  '«': 556,
  '»': 556,
  '·': 278,
  '–': 556,
  '—': 1000,
  '‘': 222,
  '’': 222,
  '“': 333,
  '”': 333,
  'º': 365,
  'ª': 370,
  '°': 400,
}

/** La letra sin su acento: para medirla, y para sustituirla si no cupiera. */
function sinAcento(letra: string): string {
  return letra.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Cuánto mide un texto, en puntos, a ese tamaño. */
export function medir(texto: string, tamano: number, negrita = false): number {
  const anchos = negrita ? ANCHOS_NEGRITA : ANCHOS_NORMAL
  let milesimas = 0
  for (const letra of texto) {
    milesimas +=
      anchos[letra] ??
      ANCHOS_SUELTOS[letra] ??
      anchos[sinAcento(letra)] ??
      // Lo que no se sabe medir se cuenta como una letra de ancho medio. Vale
      // más una columna un poco corrida que una excepción al guardar.
      556
  }
  return (milesimas * tamano) / 1000
}

/**
 * Las líneas en que cabe un párrafo dentro de un ancho.
 *
 * Corta por palabras. Una palabra más larga que el renglón entero sale como está
 * y se pasa del margen: no ocurre con nombres ni con cifras, y partirla por la
 * mitad escondería el problema en vez de enseñarlo.
 */
export function repartirEnLineas(
  texto: string,
  ancho: number,
  tamano: number,
  negrita = false,
): string[] {
  const lineas: string[] = []
  let actual = ''

  for (const palabra of texto.split(/\s+/).filter((p) => p !== '')) {
    const tentativa = actual === '' ? palabra : `${actual} ${palabra}`
    if (medir(tentativa, tamano, negrita) <= ancho || actual === '') {
      actual = tentativa
    } else {
      lineas.push(actual)
      actual = palabra
    }
  }

  if (actual !== '') lineas.push(actual)
  return lineas
}

/**
 * El texto listo para meterse en un flujo: los tres caracteres con significado
 * dentro de un literal se escapan, y lo que no cabe en Latin-1 se sustituye por
 * su letra sin acento —o por un signo de interrogación— antes de escribir.
 *
 * La sustitución es deliberada y no un fallo en silencio: un byte fuera de rango
 * corre la tabla de posiciones y deja un archivo que no abre. Vale más un «Nunez»
 * que un PDF roto.
 */
function literal(texto: string): string {
  let salida = ''
  for (const letra of texto) {
    const codigo = letra.codePointAt(0) ?? 0
    const cabe = codigo <= 0xff ? letra : (sinAcento(letra) || '?').slice(0, 1)
    if ((cabe.codePointAt(0) ?? 0) > 0xff) {
      salida += '?'
      continue
    }
    salida += '()\\'.includes(cabe) ? `\\${cabe}` : cabe
  }
  return `(${salida})`
}

/** Un renglón de texto, con su esquina inferior izquierda. */
function texto(cadena: string, x: number, y: number, tamano: number, negrita = false): string {
  const fuente = negrita ? NEGRITA : NORMAL
  return (
    `BT /${fuente} ${tamano} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm ` +
    `${literal(cadena)} Tj ET\n`
  )
}

/** Una regla horizontal, del gris de las líneas de la app. */
function regla(y: number): string {
  return (
    `0.80 0.78 0.75 RG 0.6 w ${MARGEN} ${y.toFixed(2)} m ` +
    `${(ANCHO - MARGEN).toFixed(2)} ${y.toFixed(2)} l S\n`
  )
}

/**
 * Reparte los bloques en páginas y devuelve el flujo de dibujo de cada una.
 *
 * Una sola pasada de arriba abajo: cada bloque pide su alto y, si no cabe en lo
 * que queda, empieza la página siguiente. Una tabla **sí** se parte entre dos
 * páginas —un grupo de treinta no cabe en una— y repite su encabezado al
 * continuar, que es lo que evita leer una columna de cifras sin saber de qué son.
 */
function paginar(documento: DocumentoPdf): string[] {
  const anchoUtil = ANCHO - MARGEN * 2
  const derecha = ANCHO - MARGEN
  const paginas: string[] = []
  let flujo = ''
  let y = ALTO - MARGEN

  const cerrarPagina = () => {
    paginas.push(flujo)
    flujo = ''
    y = ALTO - MARGEN
  }

  const sitio = (alto: number) => {
    if (y - alto < MARGEN) cerrarPagina()
  }

  // El encabezado va solo en la primera página: repetirlo gastaría el sitio que
  // necesita la tabla que viene continuando.
  flujo += texto(documento.titulo, MARGEN, y - 18, 18, true)
  y -= 28
  if (documento.subtitulo !== undefined) {
    flujo += texto(documento.subtitulo, MARGEN, y - 11, 11)
    y -= 20
  }
  flujo += regla(y)
  y -= 26

  for (const bloque of documento.bloques) {
    if (bloque.tipo === 'cifra') {
      sitio(80)
      // Bajar primero y dibujar sobre la línea base: una cifra de 26 puntos
      // ocupa hacia arriba, y descontarla después la encimaba con su leyenda.
      y -= 26
      flujo += texto(bloque.valor, MARGEN, y, 26, true)
      y -= 16
      flujo += texto(bloque.leyenda, MARGEN, y, 10)
      y -= 18
      if (bloque.detalle !== undefined) {
        flujo += texto(bloque.detalle, MARGEN, y, 11)
        y -= 20
      }
      y -= 8
      continue
    }

    if (bloque.tipo === 'seccion') {
      sitio(34)
      flujo += texto(bloque.texto, MARGEN, y, 12, true)
      y -= 24
      continue
    }

    if (bloque.tipo === 'nota') {
      const lineas = repartirEnLineas(bloque.texto, anchoUtil, 9)
      sitio(lineas.length * 12 + 20)
      y -= 8
      flujo += regla(y)
      y -= 16
      for (const linea of lineas) {
        flujo += texto(linea, MARGEN, y, 9)
        y -= 12
      }
      y -= 8
      continue
    }

    const encabezar = () => {
      flujo += texto(bloque.encabezados.izquierda, MARGEN, y, 9)
      flujo += texto(
        bloque.encabezados.derecha,
        derecha - medir(bloque.encabezados.derecha, 9),
        y,
        9,
      )
      y -= 8
      flujo += regla(y)
      y -= 20
    }

    // Con menos de un par de renglones debajo, el encabezado se queda solo al pie
    // de la página. Se empieza la siguiente.
    sitio(80)
    encabezar()

    bloque.filas.forEach((fila, i) => {
      // Lo que mide de verdad el renglón que viene, contando su regla: si se
      // queda corto, la última fila de la página se dibuja fuera del papel.
      const alto = fila.detalle === undefined ? 32 : 44
      if (y - alto < MARGEN) {
        cerrarPagina()
        encabezar()
      }

      flujo += texto(fila.etiqueta, MARGEN, y, 11)
      flujo += texto(fila.valor, derecha - medir(fila.valor, 11, true), y, 11, true)
      y -= 12
      if (fila.detalle !== undefined) {
        flujo += texto(fila.detalle, MARGEN, y, 9)
        y -= 12
      }
      y -= 6
      // La regla separa un renglón del siguiente, así que el último no la lleva:
      // con ella, la línea que abre la nota de abajo quedaba a un pelo de otra
      // igual y parecían un error de impresión.
      if (i < bloque.filas.length - 1) flujo += regla(y)
      y -= 14
    })

    y -= 8
  }

  paginas.push(flujo)
  return paginas
}

/** La fecha como la pide el formato: `D:AAAAMMDDhhmmss`. */
function fechaPdf(instante: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0')
  return (
    `D:${instante.getFullYear()}${dos(instante.getMonth() + 1)}${dos(instante.getDate())}` +
    `${dos(instante.getHours())}${dos(instante.getMinutes())}${dos(instante.getSeconds())}`
  )
}

/**
 * El documento, ya en bytes.
 *
 * La tabla `xref` guarda la posición exacta de cada objeto dentro del archivo, así
 * que se va midiendo conforme se escribe. Como todo lo que se emite cabe en
 * Latin-1, un carácter es un byte y la longitud de la cadena **es** la posición
 * —por eso `literal()` sustituye antes de llegar aquí—.
 */
export function construirPdf(documento: DocumentoPdf, ahora = new Date()): Blob {
  const flujos = paginar(documento)

  // 1 catálogo, 2 páginas, 3 y 4 las fuentes, y de ahí en adelante una página y
  // un flujo por cada hoja.
  const idsPagina = flujos.map((_, i) => 5 + i * 2)

  const objetos: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${idsPagina.map((id) => `${id} 0 R`).join(' ')}] ` +
      `/Count ${flujos.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ]

  flujos.forEach((flujo, i) => {
    objetos.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO} ${ALTO}] ` +
        `/Resources << /Font << /${NORMAL} 3 0 R /${NEGRITA} 4 0 R >> >> ` +
        `/Contents ${idsPagina[i]! + 1} 0 R >>`,
    )
    objetos.push(`<< /Length ${flujo.length} >>\nstream\n${flujo}endstream`)
  })

  objetos.push(
    `<< /Title ${literal(documento.titulo)} /Producer (Palomita) ` +
      `/CreationDate (${fechaPdf(ahora)}) >>`,
  )
  const idInfo = objetos.length

  let archivo = '%PDF-1.4\n'
  const posiciones: number[] = []
  objetos.forEach((cuerpo, i) => {
    posiciones.push(archivo.length)
    archivo += `${i + 1} 0 obj\n${cuerpo}\nendobj\n`
  })

  const inicioXref = archivo.length
  archivo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
  for (const posicion of posiciones) {
    archivo += `${String(posicion).padStart(10, '0')} 00000 n \n`
  }
  archivo +=
    `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R /Info ${idInfo} 0 R >>\n` +
    `startxref\n${inicioXref}\n%%EOF\n`

  // Un carácter, un byte: `literal()` ya garantizó que nada pasa de 0xff.
  const bytes = new Uint8Array(archivo.length)
  for (let i = 0; i < archivo.length; i += 1) bytes[i] = archivo.charCodeAt(i) & 0xff

  return new Blob([bytes], { type: 'application/pdf' })
}
