import type { RegistroAsistencia } from '@/domain/entities'
import type { EstadoAsistencia, Fecha, Id, Mes, Suscribible } from '@/domain/values'

/**
 * Contrato de la pantalla principal. Los métodos se nombran por caso de uso y no
 * por consulta: si el contrato dijera `find(where)`, escribir un adaptador de
 * SQL sería traducir consultas y la interfaz limpia no habría servido de nada
 * (docs/ARCHITECTURE.md).
 */
export interface AsistenciaRepo {
  /** Los registros de un día, sin los borrados. */
  porDia(fecha: Fecha): Promise<RegistroAsistencia[]>

  /**
   * Lo mismo, reactivo. Es lo que sostiene que el contador de presentes y la
   * fila cambien de color sin recargar.
   */
  observarDia(fecha: Fecha): Suscribible<RegistroAsistencia[]>

  /** Los registros de un mes completo, sin los borrados. */
  porMes(mes: Mes): Promise<RegistroAsistencia[]>

  /**
   * Lo mismo, reactivo. Sostiene el mosaico del calendario: marcar una falta se
   * ve reflejada en el día correspondiente sin volver a abrir nada.
   */
  observarMes(mes: Mes): Suscribible<RegistroAsistencia[]>

  /**
   * Deja al alumno en ese estado ese día. Es un upsert: marcar dos veces el
   * mismo alumno el mismo día actualiza el registro, nunca crea un segundo —el
   * índice `[fecha+alumno_id]` es lo que lo garantiza.
   */
  marcar(alumnoId: Id, fecha: Fecha, estado: EstadoAsistencia): Promise<void>

  /**
   * Materializa el día: deja en `presente` a los alumnos que todavía no tienen
   * registro, sin tocar a los que ya lo tienen. Es idempotente.
   *
   * Existe porque el porcentaje de asistencia se calcula sobre registros: si un
   * día solo tuviera la fila del único ausente, el denominador de ese alumno y
   * el de sus compañeros serían distintos y los porcentajes no compararían lo
   * mismo. Todo en una transacción, no 30.
   */
  pasarLista(fecha: Fecha, alumnoIds: Id[]): Promise<void>
}
