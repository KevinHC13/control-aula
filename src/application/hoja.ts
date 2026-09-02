import { fechaValida } from '@/domain/fechas'
import type { Sexo } from '@/domain/values'
import type { AlumnoExtraido } from '@/services/extraccion'

/**
 * Entender una hoja de cálculo sin pasar por la IA.
 *
 * Una lista en Excel ya es una tabla: los datos están en columnas, con su
 * encabezado escrito. Mandársela a un modelo para que vuelva a descubrir lo que
 * el archivo ya dice sería pagar segundos y conexión por nada, y esta es una app
 * que funciona sin red.
 *
 * Lo que **no** hace es adivinar. Si no reconoce los encabezados devuelve `null`
 * y ahí sí entra la IA, que es buena justamente en lo que esto no puede: una
 * hoja con la lista escrita de cualquier manera.
 *
 * La hoja real contra la que se construyó —la lista de asistencia de la
 * escuela— tiene siete filas de membrete, los encabezados en la octava, los
 * datos desde la onceava y **el nombre partido en tres columnas**: apellido
 * paterno, apellido materno y nombres. Eso último es una ventaja sobre la foto,
 * no un estorbo: el corte entre apellidos y nombres viene dado y no hay que
 * adivinarlo.
 */

/** Hasta dónde se busca la fila de encabezados. El membrete no pasa de ahí. */
const FILAS_DE_MEMBRETE = 20

/**
 * Sin acentos, en minúsculas y **sin espacios ninguno**.
 *
 * Los espacios se van del todo, no solo los de sobra: la lista impresa titula la
 * columna «C U R P», separada para que se lea, y así «curp» la reconoce igual
 * que «CURP».
 */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/gu, '')
}

/** Los encabezados que se saben leer, en el orden en que se prueban. */
const ENCABEZADOS = {
  numero: (t: string) => /^(no|n|num|nun|no\.|num\.|numero|numerodelista|#)$/.test(t),
  nombre: (t: string) => t.includes('nombre') || t.includes('alumno'),
  curp: (t: string) => t.includes('curp'),
  nacimiento: (t: string) => t.includes('nacimiento'),
  // Estrecho a propósito, y es el único de los cuatro que no puede ser un
  // `includes`: la fila de encabezados de la escuela sigue con los días de la
  // semana —`L M M J V`— y un `'m'` suelto se colaría como columna de sexo.
  sexo: (t: string) =>
    t.startsWith('sexo') || t.startsWith('genero') || t === 'h/m' || t === 'm/h' || t === 'm/f',
} as const

interface Encabezados {
  fila: number
  numero: number
  nombre: number
  /** Cuántas columnas ocupa el nombre: 3 en la lista de la escuela. */
  anchoNombre: number
  curp: number
  nacimiento: number
  sexo: number
}

/**
 * Dónde están las columnas, o `null` si esta hoja no se sabe leer.
 *
 * La fila de encabezados es la primera que trae a la vez una columna de número y
 * una de nombre. Con las dos basta: son las únicas dos que no pueden faltar en
 * una lista de alumnos.
 */
function encabezados(celdas: readonly (readonly string[])[]): Encabezados | null {
  for (const [i, fila] of celdas.slice(0, FILAS_DE_MEMBRETE).entries()) {
    if (fila === undefined) continue

    const textos = fila.map((c) => normalizar(c ?? ''))
    const numero = textos.findIndex((t) => t !== '' && ENCABEZADOS.numero(t))
    const nombre = textos.findIndex((t) => t !== '' && ENCABEZADOS.nombre(t))
    if (numero === -1 || nombre === -1) continue

    // El nombre se extiende hasta el siguiente encabezado escrito: es lo que
    // recoge las tres columnas de "paterno / materno / nombres", que vienen con
    // un solo título arriba y las dos siguientes en blanco.
    let ancho = 1
    while (nombre + ancho < textos.length && textos[nombre + ancho] === '') ancho++

    const buscar = (cual: (t: string) => boolean) =>
      textos.findIndex((t, j) => j >= nombre + ancho && t !== '' && cual(t))

    return {
      fila: i,
      numero,
      nombre,
      anchoNombre: ancho,
      curp: textos.findIndex((t) => t !== '' && ENCABEZADOS.curp(t)),
      nacimiento: buscar(ENCABEZADOS.nacimiento),
      // En toda la fila y no solo después del nombre, como el CURP: hay listas
      // con `No | SEXO | NOMBRE`. Se puede porque el predicado es exacto —a
      // diferencia del de `nacimiento`, que sí necesita el acote para no
      // toparse con las columnas fusionadas del nombre—.
      sexo: textos.findIndex((t) => t !== '' && ENCABEZADOS.sexo(t)),
    }
  }

  return null
}

/**
 * "Arguelles", "Villanueva", "Geronimo Alejandro" → "Arguelles Villanueva,
 * Geronimo Alejandro".
 *
 * Con dos columnas, la primera son los apellidos. Con una, el nombre viene
 * entero y se deja como está: partirlo sería adivinar dónde acaban los
 * apellidos, que es justo lo que esta función existe para no tener que hacer.
 */
function armarNombre(partes: string[]): string {
  const limpias = partes.map((p) => p.trim()).filter((p) => p !== '')
  if (limpias.length <= 1) return limpias.join(' ')

  const nombres = limpias[limpias.length - 1]!
  const apellidos = limpias.slice(0, -1).join(' ')
  return `${apellidos}, ${nombres}`
}

/**
 * El día cero de Excel es el 30 de diciembre de 1899, y una fecha con formato se
 * guarda como los días transcurridos desde entonces. Sin esto, una columna de
 * fecha de nacimiento llega como «40123» y la revisión la marca en rojo.
 *
 * El rango acotado es a propósito: fuera de él, un número en esa columna es
 * cualquier otra cosa —una edad, un teléfono— y se descarta.
 */
function fechaDeExcel(valor: string): string {
  if (!/^\d+$/.test(valor)) return valor

  const dias = Number(valor)
  if (dias < 3653 || dias > 73050) return '' // 1910–2100

  const fecha = new Date(Date.UTC(1899, 11, 30) + dias * 86_400_000)
  return fecha.toISOString().slice(0, 10)
}

/**
 * Qué quiere decir la `M` de la columna, decidido **sobre la columna entera y no
 * celda por celda**.
 *
 * Es una ambigüedad real y no un caso de laboratorio: en la lista mexicana
 * —`H` / `M`— la `M` es Mujer, y en una lista escrita a la inglesa —`M` / `F`—
 * la misma letra es Masculino. Leyendo una celda suelta no hay forma de saberlo;
 * mirando la columna sí, porque una `F` en cualquier renglón solo puede ser
 * Femenino, y donde hay `F` la `M` es Masculino.
 *
 * Sin esto, media lista quedaría con el sexo invertido y en silencio, que es
 * exactamente lo que nadie revisaría.
 */
function laEmeEsMasculino(crudos: readonly string[]): boolean {
  return crudos.some((c) => c === 'f' || c === 'femenino')
}

function sexoDeCelda(crudo: string, emeEsMasculino: boolean): Sexo | null {
  switch (crudo) {
    case 'h':
    case 'hombre':
    case 'masculino':
    case 'v':
    case 'varon':
    case 'nino':
      return 'H'
    case 'f':
    case 'femenino':
    case 'mujer':
    case 'nina':
      return 'M'
    case 'm':
      return emeEsMasculino ? 'H' : 'M'
    default:
      // Una celda vacía, un guion o cualquier otra cosa. No es un error: hay
      // listas a las que les falta el dato de alguien.
      return null
  }
}

/**
 * Los alumnos de la hoja, en la forma en la que los deja la IA para que el resto
 * del camino sea el mismo. `null` si la hoja no se supo leer.
 */
export function interpretarHoja(celdas: readonly (readonly string[])[]): AlumnoExtraido[] | null {
  const donde = encabezados(celdas)
  if (donde === null) return null

  const alumnos: AlumnoExtraido[] = []
  // El sexo se guarda crudo y se traduce al final: qué significa la `M` depende
  // de la columna entera, y aquí todavía falta por leerla.
  const sexos: string[] = []

  for (const fila of celdas.slice(donde.fila + 1)) {
    if (fila === undefined) continue

    const celda = (i: number) => (i >= 0 ? (fila[i] ?? '').trim() : '')

    // Una fila de alumno tiene número y nombre. Con eso se van solos el
    // membrete, los encabezados repetidos y el pie de totales.
    const numero = Number(celda(donde.numero))
    if (!Number.isInteger(numero) || numero < 1) continue

    const nombre = armarNombre(
      Array.from({ length: donde.anchoNombre }, (_, k) => celda(donde.nombre + k)),
    )
    if (nombre === '') continue

    const nacimiento = fechaDeExcel(celda(donde.nacimiento))

    alumnos.push({
      nombre,
      numero_lista: numero,
      curp: celda(donde.curp) || null,
      fecha_nacimiento: fechaValida(nacimiento) ? nacimiento : null,
    })
    sexos.push(normalizar(celda(donde.sexo)))
  }

  if (alumnos.length === 0) return null

  const emeEsMasculino = laEmeEsMasculino(sexos)
  return alumnos.map((alumno, i) => ({
    ...alumno,
    sexo: sexoDeCelda(sexos[i] ?? '', emeEsMasculino),
  }))
}
