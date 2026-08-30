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
 * «del 26 de agosto al 20 de noviembre», con el año solo si los dos extremos no
 * caen en el mismo: repetirlo en los dos lados es ruido en el caso normal, y
 * omitirlo cuando el periodo cruza el año es esconder el dato que importa.
 */
export function comoRango(desde: Fecha, hasta: Fecha): string {
  const mismoAnio = desde.slice(0, 4) === hasta.slice(0, 4)
  return mismoAnio
    ? `del ${comoDiaCorto(desde)} al ${comoDiaConAnio(hasta)}`
    : `del ${comoDiaConAnio(desde)} al ${comoDiaConAnio(hasta)}`
}
