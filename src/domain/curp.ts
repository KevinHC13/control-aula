import { fechaValida } from './fechas'
import type { Fecha } from './values'

/**
 * La CURP como fuente de la fecha de nacimiento.
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
