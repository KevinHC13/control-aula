/**
 * Leer la primera hoja de un archivo de Excel, sin dependencias.
 *
 * Está en `services/` por lo mismo que `extraccion.ts`: es una entrada de datos
 * del exterior, no una fuente de la app. Lo que devuelve —una matriz de texto—
 * lo interpreta `application/hoja.ts` y lo revisa la maestra antes de que exista
 * ningún alumno.
 *
 * **Por qué a mano y no con una librería.** Un `.xlsx` es un zip con dos XML
 * dentro, y el navegador sabe abrir las dos cosas: `DecompressionStream` para el
 * zip y `DOMParser` para el XML. La alternativa eran cuatrocientos kilobytes de
 * dependencia en una PWA que se instala en un iPad, para leer una hoja al año.
 *
 * Lee lo que hace falta y nada más: la primera hoja, como texto. No entiende
 * fórmulas, ni formatos, ni `.xls` de los viejos —eso es un binario distinto—.
 */

/** Firmas del formato zip, en little-endian. */
const FIN_CENTRAL = 0x06054b50
const ENCABEZADO_LOCAL = 0x04034b50

/** Lo máximo que puede medir el comentario final de un zip, más su encabezado. */
const MAX_COMENTARIO = 0xffff + 22

interface Entrada {
  metodo: number
  comprimido: number
  offsetLocal: number
}

/** Una hoja leída: las celdas como texto, indexadas por fila y columna. */
export type Celdas = string[][]

export class ErrorDeHoja extends Error {}

/**
 * Las celdas de la primera hoja del libro.
 *
 * Los mensajes de error son en español y para mostrarse tal cual, como los de
 * `extraccion.ts`: quien los va a leer es la maestra, no una consola.
 */
export async function leerHoja(archivo: File): Promise<Celdas> {
  if (typeof DecompressionStream === 'undefined') {
    throw new ErrorDeHoja(
      'Este dispositivo no puede abrir archivos de Excel. Tome una foto de la lista.',
    )
  }

  const zip = new Uint8Array(await archivo.arrayBuffer())
  const entradas = leerDirectorio(zip)

  const libro = await texto(zip, entradas, 'xl/workbook.xml')
  const cadenas = entradas.has('xl/sharedStrings.xml')
    ? cadenasCompartidas(await texto(zip, entradas, 'xl/sharedStrings.xml'))
    : []

  const hoja = await texto(zip, entradas, await rutaDeLaPrimeraHoja(zip, entradas, libro))
  return celdas(hoja, cadenas)
}

/**
 * El directorio central del zip: dónde empieza cada archivo y cómo está
 * comprimido. Se lee de atrás hacia adelante, que es como está escrito.
 */
function leerDirectorio(zip: Uint8Array): Map<string, Entrada> {
  const vista = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)

  let fin = -1
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - MAX_COMENTARIO); i--) {
    if (vista.getUint32(i, true) === FIN_CENTRAL) {
      fin = i
      break
    }
  }
  if (fin === -1) throw new ErrorDeHoja('El archivo no parece un libro de Excel')

  const cuantas = vista.getUint16(fin + 10, true)
  let p = vista.getUint32(fin + 16, true)

  const entradas = new Map<string, Entrada>()
  const nombres = new TextDecoder()

  for (let i = 0; i < cuantas; i++) {
    const largoNombre = vista.getUint16(p + 28, true)
    const largoExtra = vista.getUint16(p + 30, true)
    const largoComentario = vista.getUint16(p + 32, true)
    const nombre = nombres.decode(zip.subarray(p + 46, p + 46 + largoNombre))

    entradas.set(nombre, {
      metodo: vista.getUint16(p + 10, true),
      comprimido: vista.getUint32(p + 20, true),
      offsetLocal: vista.getUint32(p + 42, true),
    })

    p += 46 + largoNombre + largoExtra + largoComentario
  }

  return entradas
}

/** El contenido de una entrada, ya descomprimido y decodificado. */
async function texto(
  zip: Uint8Array,
  entradas: Map<string, Entrada>,
  ruta: string,
): Promise<string> {
  const entrada = entradas.get(ruta)
  if (entrada === undefined) throw new ErrorDeHoja('El libro de Excel viene incompleto')

  const vista = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
  const inicio = entrada.offsetLocal
  if (vista.getUint32(inicio, true) !== ENCABEZADO_LOCAL) {
    throw new ErrorDeHoja('El archivo no parece un libro de Excel')
  }

  // El encabezado local repite el nombre y los extras, y sus largos son los
  // únicos fiables: los del directorio central pueden diferir.
  const datos = inicio + 30 + vista.getUint16(inicio + 26, true) + vista.getUint16(inicio + 28, true)
  const crudo = zip.subarray(datos, datos + entrada.comprimido)

  // Método 0: guardado sin comprimir, que es lo que hace Excel con los archivos
  // chicos. Método 8: deflate. No hay más en la práctica.
  if (entrada.metodo === 0) return new TextDecoder().decode(crudo)
  if (entrada.metodo !== 8) throw new ErrorDeHoja('El libro de Excel usa una compresión desconocida')

  const flujo = new Blob([crudo as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))

  return new Response(flujo).text()
}

function documento(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror') !== null) {
    throw new ErrorDeHoja('No se pudo leer el contenido del libro de Excel')
  }
  return doc
}

/**
 * La ruta de la primera hoja dentro del zip.
 *
 * Casi siempre es `xl/worksheets/sheet1.xml`, pero no siempre: el orden de las
 * pestañas lo manda `workbook.xml` y el nombre del archivo sale de sus
 * relaciones, que viven en un archivo aparte. Si algo de eso falta se cae a la
 * primera hoja que haya, ordenada por su número y no por su texto —`sheet10` no
 * va antes que `sheet2`—.
 */
async function rutaDeLaPrimeraHoja(
  zip: Uint8Array,
  entradas: Map<string, Entrada>,
  libro: string,
): Promise<string> {
  const porRelacion = await relacionDeLaPrimeraHoja(zip, entradas, libro)
  if (porRelacion !== undefined && entradas.has(porRelacion)) return porRelacion

  const primera = [...entradas.keys()]
    .filter((r) => r.startsWith('xl/worksheets/') && r.endsWith('.xml'))
    .sort((a, b) => numeroDeHoja(a) - numeroDeHoja(b) || a.localeCompare(b))[0]

  if (primera === undefined) throw new ErrorDeHoja('El libro de Excel no tiene ninguna hoja')
  return primera
}

function numeroDeHoja(ruta: string): number {
  return Number(/(\d+)\.xml$/.exec(ruta)?.[1] ?? Number.MAX_SAFE_INTEGER)
}

/** El destino de la relación que `workbook.xml` cita como primera pestaña. */
async function relacionDeLaPrimeraHoja(
  zip: Uint8Array,
  entradas: Map<string, Entrada>,
  libro: string,
): Promise<string | undefined> {
  const id = documento(libro).querySelector('sheets > sheet')?.getAttribute('r:id')
  if (id === null || id === undefined) return undefined
  if (!entradas.has('xl/_rels/workbook.xml.rels')) return undefined

  const rels = documento(await texto(zip, entradas, 'xl/_rels/workbook.xml.rels'))
  const destino = [...rels.getElementsByTagName('Relationship')]
    .find((r) => r.getAttribute('Id') === id)
    ?.getAttribute('Target')

  // El `Target` es relativo a `xl/`, salvo cuando viene absoluto desde la raíz.
  return destino === null || destino === undefined
    ? undefined
    : `xl/${destino.replace(/^\/?xl\//, '').replace(/^\//, '')}`
}

/**
 * La tabla de cadenas compartidas: Excel guarda cada texto una sola vez y las
 * celdas lo referencian por índice.
 *
 * Un `<si>` puede venir partido en varios `<t>` —pasa cuando una palabra de la
 * celda tiene otro formato—, así que se concatenan todos.
 */
function cadenasCompartidas(xml: string): string[] {
  return [...documento(xml).getElementsByTagName('si')].map((si) =>
    [...si.getElementsByTagName('t')].map((t) => t.textContent ?? '').join(''),
  )
}

/** "B11" → columna 1 (0-based) y fila 10. */
function posicion(ref: string): { fila: number; columna: number } | null {
  const partes = /^([A-Z]+)(\d+)$/.exec(ref)
  if (partes === null) return null

  const letras = partes[1]!
  let columna = 0
  for (const letra of letras) columna = columna * 26 + (letra.charCodeAt(0) - 64)

  return { fila: Number(partes[2]) - 1, columna: columna - 1 }
}

/**
 * Las celdas de la hoja, como texto.
 *
 * La referencia de cada celda (`r="B11"`) da su sitio exacto, así que las filas
 * y las columnas vacías —que Excel simplemente no escribe— no descuadran nada.
 */
function celdas(xml: string, cadenas: string[]): Celdas {
  const matriz: Celdas = []

  for (const c of documento(xml).getElementsByTagName('c')) {
    const donde = posicion(c.getAttribute('r') ?? '')
    if (donde === null) continue

    const tipo = c.getAttribute('t')
    let valor: string

    if (tipo === 's') {
      const i = Number(c.getElementsByTagName('v')[0]?.textContent ?? '')
      valor = cadenas[i] ?? ''
    } else if (tipo === 'inlineStr') {
      valor = [...c.getElementsByTagName('t')].map((t) => t.textContent ?? '').join('')
    } else {
      // Números, fechas —que Excel guarda como número— y texto suelto.
      valor = c.getElementsByTagName('v')[0]?.textContent ?? ''
    }

    const fila = (matriz[donde.fila] ??= [])
    while (fila.length < donde.columna) fila.push('')
    fila[donde.columna] = valor.trim()
  }

  // Las filas que Excel no escribió quedan como huecos del arreglo.
  for (let i = 0; i < matriz.length; i++) matriz[i] ??= []

  return matriz
}
