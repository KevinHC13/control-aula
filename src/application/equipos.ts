import type { FilaAsistencia } from '@/application/asistencia'
import type { Alumno } from '@/domain/entities'
import { equiposPara, repartir } from '@/domain/equipos'
import { estaEnElSalon } from '@/domain/rules'

/**
 * Formar equipos con el grupo: ella dice cuántos equipos **o** cuántos niños por
 * equipo, y el sistema los arma (D-021).
 *
 * No hay puerto ni tabla: **no se guarda nada**. Es la única función del proyecto
 * que produce algo que no se escribe en ninguna parte, y es a propósito —los
 * equipos son estado de interfaz—.
 */

/** Un equipo armado. `numero` es 1-based, que es como se dice en el salón. */
export interface Equipo {
  numero: number
  integrantes: Alumno[]
}

/** Las dos formas de pedir el reparto. Son el mismo dato visto al revés. */
export type ModoDeReparto = 'equipos' | 'por_equipo'

/**
 * Quiénes entran al reparto.
 *
 * Con `soloPresentes`, los que **están en el salón** —presente o retardo, la misma
 * regla del sorteo—: armar equipos con quien no vino es armar un equipo de tres.
 * Sin eso, el grupo completo, que es lo que sirve para planear de un día para
 * otro.
 *
 * Función pura: recibe las filas que la pantalla ya tiene.
 */
export function alumnosParaEquipos(
  filas: readonly FilaAsistencia[],
  soloPresentes: boolean,
): Alumno[] {
  return filas.filter((f) => !soloPresentes || estaEnElSalon(f.estado)).map((f) => f.alumno)
}

/**
 * Cuántos equipos van a salir con lo que ella pidió. La pantalla lo necesita antes
 * de armar nada: es lo que le permite decir «pediste 40 equipos y solo hay 30
 * alumnos» en vez de mostrar diez tarjetas vacías.
 */
export function cuantosEquipos(
  total: number,
  modo: ModoDeReparto,
  cantidad: number,
): number {
  const pedidos = modo === 'equipos' ? cantidad : equiposPara(total, cantidad)
  return Math.min(pedidos, total)
}

/**
 * Arma los equipos. `semilla` es el número al azar que trae la pantalla: con la
 * misma semilla sale el mismo reparto, y «volver a sortear» es cambiarla.
 */
export function formarEquipos(
  alumnos: readonly Alumno[],
  modo: ModoDeReparto,
  cantidad: number,
  semilla: number,
): Equipo[] {
  const cuantos = modo === 'equipos' ? cantidad : equiposPara(alumnos.length, cantidad)

  return repartir(alumnos, cuantos, semilla).map((integrantes, i) => ({
    numero: i + 1,
    integrantes,
  }))
}
