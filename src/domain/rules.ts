import type { RegistroAsistencia } from './entities'
import { CICLO_ESTADOS, type EstadoAsistencia } from './values'

/**
 * [POR VALIDAR] Umbrales de riesgo del prototipo. Ella sabe cuál es el criterio
 * que su escuela usa; estos son una suposición (docs/DATA-MODEL.md).
 */
export const UMBRAL_ASISTENCIA = 90
export const UMBRAL_PROMEDIO = 6

/** Retardo y justificada cuentan como asistencia. Solo 'ausente' no cuenta. */
export function cuentaComoAsistencia(estado: EstadoAsistencia): boolean {
  return estado !== 'ausente'
}

/**
 * Siguiente estado del ciclo al tocar una fila:
 * presente → ausente → retardo → justificada → presente
 */
export function siguienteEstado(estado: EstadoAsistencia): EstadoAsistencia {
  const i = CICLO_ESTADOS.indexOf(estado)
  return CICLO_ESTADOS[(i + 1) % CICLO_ESTADOS.length] ?? 'presente'
}

/**
 * Porcentaje de días con asistencia sobre los registros recibidos.
 *
 * Sin registros devuelve 100, no NaN: un alumno del que no hay datos todavía no
 * es un alumno con cero asistencia.
 *
 * No redondea — la UI decide el formato. Tampoco filtra `deleted_at`: eso es
 * responsabilidad de la lectura que arma la lista (docs/DATA-MODEL.md).
 */
export function porcentajeAsistencia(registros: RegistroAsistencia[]): number {
  if (registros.length === 0) return 100

  const presentes = registros.filter((r) => cuentaComoAsistencia(r.estado)).length
  return (presentes / registros.length) * 100
}

/**
 * Promedio de calificaciones. Devuelve null cuando no hay ninguna, nunca 0: un
 * alumno sin calificaciones capturadas no es un alumno reprobado.
 */
export function promedioDe(valores: number[]): number | null {
  if (valores.length === 0) return null

  const suma = valores.reduce((acc, v) => acc + v, 0)
  return suma / valores.length
}

/**
 * Un alumno está en riesgo si su asistencia baja del umbral, o si su promedio
 * lo hace. Un promedio null —sin calificaciones capturadas— no cuenta como
 * riesgo: es ausencia de datos, no un dato malo.
 */
export function enRiesgo(pct: number, promedio: number | null): boolean {
  if (pct < UMBRAL_ASISTENCIA) return true
  return promedio !== null && promedio < UMBRAL_PROMEDIO
}
