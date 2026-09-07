import { comoDate } from '@/domain/fechas'
import type { Fecha } from '@/domain/values'

/**
 * Fechas escritas como se dicen.
 *
 * Vive en `ui/` y no en `domain/`: es presentación, y el dominio no formatea nada
 * —ni siquiera con `Intl`, que sería meter una decisión de pantalla en la capa que
 * calcula—. El dominio guarda y compara `AAAA-MM-DD`, que es lo que hace que las
 * fechas se ordenen solas comparando cadenas; lo que se **lee** se arma aquí.
 *
 * Los formateadores se construyen una vez, fuera de las funciones: `Intl` es caro
 * de instanciar y estas se llaman una vez por fila.
 */
const CORTO = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long' })
const CON_ANIO = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const CON_DIA = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

/** «29 de agosto». Para lo que ocurre dentro del ciclo que se está viendo. */
export function comoDiaCorto(fecha: Fecha): string {
  return CORTO.format(comoDate(fecha))
}

/** «29 de agosto de 2026». Para lo que puede ser de otro año. */
export function comoDiaConAnio(fecha: Fecha): string {
  return CON_ANIO.format(comoDate(fecha))
}

/**
 * «sábado 29 de agosto». Para los lectores de pantalla de la tira de días, que
 * antes dictaban la fecha cruda dígito por dígito.
 */
export function comoDiaConNombre(fecha: Fecha): string {
  return CON_DIA.format(comoDate(fecha))
}

/**
 * «del 26 de agosto al 20 de noviembre de 2026»: un periodo, dicho como se dice.
 *
 * Tres formas según lo que los extremos comparten, y cada una omite lo que
 * repetiría:
 *
 * - **Distinto año** — el año va en los dos lados: es el dato que importa.
 * - **Mismo año** — va una vez, al final. Repetirlo es ruido.
 * - **Mismo mes** — también va una vez: «del 7 al 11 de septiembre de 2026», y
 *   no «del 7 de septiembre al 11 de septiembre», que es como sale una semana y
 *   se lee como si fueran dos meses distintos hasta que uno lo comprueba.
 */
export function comoRango(desde: Fecha, hasta: Fecha): string {
  if (desde.slice(0, 4) !== hasta.slice(0, 4)) {
    return `del ${comoDiaConAnio(desde)} al ${comoDiaConAnio(hasta)}`
  }

  const mismoMes = desde.slice(0, 7) === hasta.slice(0, 7)
  // Solo el número del día: el mes y el año los pone el otro extremo.
  const inicio = mismoMes ? String(Number(desde.slice(-2))) : comoDiaCorto(desde)
  return `del ${inicio} al ${comoDiaConAnio(hasta)}`
}
