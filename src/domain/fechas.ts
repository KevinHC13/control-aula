import type { Fecha } from './values'

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

/** Días de diferencia a partir de una fecha, para moverse por la tira de días. */
export function fechaMas(fecha: Fecha, dias: number): Fecha {
  const [anio = 0, mes = 1, dia = 1] = fecha.split('-').map(Number)
  // Mediodía: sumar días sobre medianoche puede caer en un cambio de horario y
  // devolver el mismo día o saltarse uno.
  const d = new Date(anio, mes - 1, dia, 12)
  d.setDate(d.getDate() + dias)
  return fechaLocal(d)
}
