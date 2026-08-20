import type { Fecha, Mes } from './values'

/**
 * La fecha de un instante **en la zona del dispositivo**, no en UTC.
 *
 * No se puede usar `toISOString().slice(0, 10)`: el iPad está en horario de
 * México, y a las 19:00 del martes eso devolvería el miércoles. Un día de
 * asistencia mal fechado es peor que un error visible, porque nadie lo nota.
 *
 * `updated_at` sí va en UTC —es para comparar entre dispositivos— pero `fecha`
 * es el día del salón de clases.
 */
export function fechaLocal(instante: Date): Fecha {
  const anio = instante.getFullYear()
  const mes = String(instante.getMonth() + 1).padStart(2, '0')
  const dia = String(instante.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

/**
 * La fecha como `Date` local, al mediodía. El mediodía no es un detalle: operar
 * sobre medianoche puede caer en un cambio de horario y devolver el día anterior.
 */
export function comoDate(fecha: Fecha): Date {
  const [anio = 0, mes = 1, dia = 1] = fecha.split('-').map(Number)
  return new Date(anio, mes - 1, dia, 12)
}

/**
 * Una fecha es válida si sobrevive el viaje de ida y vuelta: `comoDate` corrige
 * en silencio un 31 de febrero a un 3 de marzo, así que si vuelve distinta es
 * que el día no existe. El formato lo filtra antes la expresión regular —una
 * fecha en `12/03/2015` es ambigua entre día y mes y no se adivina, se marca—.
 */
export function fechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false
  return fechaLocal(comoDate(fecha)) === fecha
}

/** Días de diferencia a partir de una fecha, para moverse por la tira de días. */
export function fechaMas(fecha: Fecha, dias: number): Fecha {
  const d = comoDate(fecha)
  d.setDate(d.getDate() + dias)
  return fechaLocal(d)
}

/** Los últimos `cuantos` días terminando en `hasta`, en orden ascendente. */
export function ultimosDias(hasta: Fecha, cuantos: number): Fecha[] {
  return Array.from({ length: cuantos }, (_, i) => fechaMas(hasta, i - (cuantos - 1)))
}

/**
 * Los `cuantos` días consecutivos que contienen al seleccionado, centrado cuando
 * se puede. Es la ventana de la tira de días.
 *
 * Nunca pasa de `hoy`: cerca de hoy la ventana termina ahí y el seleccionado se
 * corre a la derecha, porque un día que no ha pasado no tiene asistencia que
 * capturar. Si el seleccionado ya es futuro —la app pudo quedar abierta al cruzar
 * la medianoche— la ventana termina en él para seguir conteniéndolo.
 */
export function ventanaDeDias(seleccionado: Fecha, hoy: Fecha, cuantos: number): Fecha[] {
  const mitad = Math.floor((cuantos - 1) / 2)
  const tope = seleccionado > hoy ? seleccionado : hoy
  // Comparar `Fecha` como cadena ordena bien: ISO-8601 con ceros a la izquierda
  // es lexicográficamente igual que cronológicamente.
  const centrado = fechaMas(seleccionado, mitad)
  const fin = centrado > tope ? tope : centrado

  return ultimosDias(fin, cuantos)
}

/** El mes al que pertenece una fecha. */
export function mesDe(fecha: Fecha): Mes {
  return fecha.slice(0, 7)
}

/** El primer día del mes, que es de donde se opera todo lo demás. */
function primerDia(mes: Mes): Fecha {
  return `${mes}-01`
}

/** Meses de diferencia, para las flechas del calendario. */
export function mesMas(mes: Mes, meses: number): Mes {
  const d = comoDate(primerDia(mes))
  // Sobre el día 1: `setMonth` desde el 31 de enero daría el 3 de marzo.
  d.setMonth(d.getMonth() + meses)
  return mesDe(fechaLocal(d))
}

/** Primer y último día del mes, para pedir el rango a la base. */
export function rangoDelMes(mes: Mes): { desde: Fecha; hasta: Fecha } {
  return { desde: primerDia(mes), hasta: fechaMas(primerDia(mesMas(mes, 1)), -1) }
}

/** Todos los días del mes, en orden ascendente. */
export function diasDelMes(mes: Mes): Fecha[] {
  const { desde, hasta } = rangoDelMes(mes)
  // El último día del mes es también cuántos días tiene.
  const cuantos = Number(hasta.slice(-2))
  return Array.from({ length: cuantos }, (_, i) => fechaMas(desde, i))
}

/**
 * Celdas vacías antes del día 1 en una rejilla que **empieza en lunes**, como se
 * lee un calendario escolar. `getDay()` cuenta desde el domingo, de ahí el
 * corrimiento.
 */
export function huecosIniciales(mes: Mes): number {
  return (comoDate(primerDia(mes)).getDay() + 6) % 7
}
