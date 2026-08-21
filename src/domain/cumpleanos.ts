import { comoDate, fechaLocal, fechaMas } from './fechas'
import type { Fecha } from './values'

/**
 * Los cumpleaños: qué día cae el de cada quien y cuántos años cumple.
 *
 * Funciones puras y sin librerías de fechas, como el resto de `fechas.ts`. Todo
 * se calcula sobre la `Fecha` en formato ISO, que es texto ordenable, y las
 * cuentas de días pasan por `comoDate`, que opera al mediodía para no caer en un
 * cambio de horario.
 */

/** El día y el mes de una fecha: `"03-14"`. Es lo que se repite cada año. */
export function diaYMes(fecha: Fecha): string {
  return fecha.slice(5)
}

/**
 * Cuántos años cumple —o cumplió— en esa fecha.
 *
 * No es una resta de años: quien nació en diciembre todavía no cumple en octubre,
 * y por eso se compara también el día y el mes. Sin eso, el aviso diría un año más
 * durante meses.
 */
export function edadEn(nacimiento: Fecha, fecha: Fecha): number {
  const anios = Number(fecha.slice(0, 4)) - Number(nacimiento.slice(0, 4))
  return diaYMes(fecha) >= diaYMes(nacimiento) ? anios : anios - 1
}

/**
 * El próximo cumpleaños a partir de `desde`, incluido ese mismo día.
 *
 * Devuelve la fecha con el año que le toca: el cumpleaños de enero visto en
 * diciembre cae en el año siguiente, que es justo el caso que un `slice` del año
 * en curso se comería.
 *
 * Un 29 de febrero cae en el 1 de marzo los años que no son bisiestos: `comoDate`
 * corrige el día inexistente y aquí se aprovecha en vez de esconderlo. Es lo que
 * hace la mayoría de los calendarios, y no festejar es peor que festejar un día
 * después.
 */
export function proximoCumpleanos(nacimiento: Fecha, desde: Fecha): Fecha {
  const anio = Number(desde.slice(0, 4))
  const esteAnio = fechaLocal(comoDate(`${anio}-${diaYMes(nacimiento)}`))

  if (esteAnio >= desde) return esteAnio
  return fechaLocal(comoDate(`${anio + 1}-${diaYMes(nacimiento)}`))
}

/** Cuántos días faltan de una fecha a otra. Cero es hoy. */
export function diasHasta(desde: Fecha, hasta: Fecha): number {
  const uno = comoDate(desde).getTime()
  const otro = comoDate(hasta).getTime()
  return Math.round((otro - uno) / 86400000)
}

/**
 * Si la fecha cae dentro de los próximos `cuantos` días contando hoy.
 *
 * Con `cuantos: 7` la ventana es hoy y los seis siguientes: la semana que viene,
 * no los siete días que empiezan mañana. Es lo que hace que el cumpleaños de hoy
 * salga en el mismo aviso.
 */
export function dentroDeLaVentana(hoy: Fecha, fecha: Fecha, cuantos: number): boolean {
  return fecha >= hoy && fecha <= fechaMas(hoy, cuantos - 1)
}
