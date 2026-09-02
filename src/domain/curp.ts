import { fechaValida } from './fechas'
import type { Fecha, Sexo } from './values'

/**
 * La CURP como fuente de la fecha de nacimiento y del sexo.
 *
 * La lista oficial de Control Escolar trae `No | MATRÍCULA | CURP | NOMBRE` y
 * **no trae fecha de nacimiento**: viene dentro de la CURP, en seis dígitos. Sin
 * esto, el aviso de cumpleaños (`C15`) exigiría teclear treinta fechas a mano,
 * que es exactamente lo que nadie hace.
 *
 * Esto no es adivinar, es decodificar: la fecha está escrita ahí y solo hay que
 * leerla. Por eso vive en `domain/` y no en el prompt de la IA —a un modelo no
 * se le pide aritmética que se puede hacer con un `slice`—.
 *
 * Formato, con `AUVG160520HNLRLRA3` de ejemplo:
 *
 * ```
 * AUVG   160520   H   NL   RLR   A   3
 * │      │        │   │    │     │   └─ dígito verificador
 * │      │        │   │    │     └───── homoclave: dígito si nació antes del 2000,
 * │      │        │   │    │            letra si nació del 2000 en adelante
 * │      │        │   │    └─────────── consonantes internas
 * │      │        │   └──────────────── entidad de nacimiento
 * │      │        └──────────────────── sexo: H o M
 * │      └───────────────────────────── AAMMDD  ← lo que interesa
 * └──────────────────────────────────── iniciales del nombre
 * ```
 */

/** 18 caracteres con la forma que publica RENAPO. */
const FORMA = /^[A-Z][AEIOUX][A-Z]{2}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/

/** Mayúsculas y sin espacios. Lo que teclea una persona no viene así. */
export function normalizarCurp(texto: string): string {
  return texto.replace(/\s+/g, '').toUpperCase()
}

/**
 * Solo verifica la **forma**, no el dígito verificador ni que la persona exista.
 * Alcanza para lo que se usa aquí: distinguir un CURP de un renglón que el OCR
 * leyó torcido.
 */
export function curpValido(curp: string): boolean {
  return FORMA.test(curp) && fechaDeCurp(curp) !== null
}

/**
 * `AUVG160520HNLRLRA3` → `2016-05-20`. `null` si la forma no cuadra o si la
 * fecha no existe —un 31 de febrero se rechaza, cortesía de `fechaValida`—.
 *
 * **El siglo sale de la homoclave**, no de una suposición sobre la edad: si el
 * carácter 17 es un dígito la persona nació en los 1900, y si es una letra, del
 * 2000 en adelante. Es la regla con la que RENAPO evitó el efecto 2000, y es lo
 * que hace que el mismo código sirva para un alumno de diez años y para la
 * maestra.
 */
export function fechaDeCurp(curp: string): Fecha | null {
  if (!FORMA.test(curp)) return null

  const siglo = /\d/.test(curp.charAt(16)) ? '19' : '20'
  const fecha = `${siglo}${curp.slice(4, 6)}-${curp.slice(6, 8)}-${curp.slice(8, 10)}`

  return fechaValida(fecha) ? fecha : null
}

/**
 * `AUVG160520HNLRLRA3` → `'H'`. El carácter 11 —índice 10, justo después de los
 * seis dígitos de la fecha— es el sexo, y `FORMA` ya lo acota a `H` o `M`, así
 * que no hay un tercer caso que contemplar.
 *
 * Es lo mismo que `fechaDeCurp` y por la misma razón: el dato está escrito ahí y
 * solo hay que leerlo. A la IA se le pide el sexo únicamente cuando no hay CURP
 * ni columna en el documento —adivinarlo por el nombre de pila falla con
 * «Guadalupe», con «Cruz» y con la mitad de los nombres nuevos—, y esta función
 * es justo lo que hace que ese caso sea raro (docs/DECISIONES.md D-029).
 */
export function sexoDeCurp(curp: string): Sexo | null {
  if (!FORMA.test(curp)) return null

  return curp.charAt(10) === 'H' ? 'H' : 'M'
}

/**
 * Partículas que RENAPO no cuenta al formar las iniciales: "De la Cruz" empieza
 * por C, no por D. Son las mismas que van en minúscula al capitalizar.
 */
const PARTICULAS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'E', 'DA', 'DO', 'DOS', 'VAN', 'VON', 'DI', 'MC', 'MAC'])

/** Sin acentos y en mayúsculas, que es como se forman las iniciales. */
function sinAcentos(palabra: string): string {
  return palabra
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
}

/**
 * "DE LEON CEDILLO YARETZI XIMENA" + "LECY160830…" → "De Leon Cedillo, Yaretzi
 * Ximena" —sin capitalizar todavía: eso lo hace quien llama—.
 *
 * La lista oficial imprime el nombre completo **sin coma**, así que dónde acaban
 * los apellidos hay que averiguarlo. Un modelo lo adivina, y con "De León
 * Cedillo" se equivoca. El CURP no: sus cuatro primeras letras son la inicial
 * del apellido paterno, su primera vocal interna, la inicial del materno y la
 * inicial del primer nombre. En `LECY`, la `C` es Cedillo y la `Y` es Yaretzi,
 * así que el corte está señalado y no hay nada que adivinar.
 *
 * Devuelve `null` cuando las iniciales no cuadran —un CURP de otra persona, un
 * nombre mal leído, alguien con un solo apellido—. Ahí el nombre se deja como
 * vino, que es lo que la revisión existe para atrapar.
 */
export function partirNombre(completo: string, curp: string): string | null {
  if (!FORMA.test(curp)) return null

  const palabras = completo.trim().split(/\s+/).filter((p) => p !== '')
  if (palabras.length < 3) return null

  const significativa = palabras.map(sinAcentos)
  const esParticula = (i: number) => PARTICULAS.has(significativa[i]!)
  const empiezaCon = (i: number, letra: string) =>
    !esParticula(i) && significativa[i]!.startsWith(letra)

  const inicialMaterno = curp.charAt(2)
  const inicialNombre = curp.charAt(3)

  // El materno no puede ser la primera palabra —antes va el paterno— y los
  // nombres no pueden ser lo último que quede si el materno se los come.
  for (let materno = 1; materno < palabras.length - 1; materno++) {
    if (!empiezaCon(materno, inicialMaterno)) continue

    for (let nombres = materno + 1; nombres < palabras.length; nombres++) {
      if (!empiezaCon(nombres, inicialNombre)) continue

      const apellidos = palabras.slice(0, nombres).join(' ')
      return `${apellidos}, ${palabras.slice(nombres).join(' ')}`
    }
  }

  return null
}
