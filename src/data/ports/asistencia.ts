import type { RegistroAsistencia } from '@/domain/entities'
import type { EstadoAsistencia, Fecha, Id, Suscribible } from '@/domain/values'

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

  /**
   * Deja al alumno en ese estado ese día. Es un upsert: marcar dos veces el
   * mismo alumno el mismo día actualiza el registro, nunca crea un segundo —el
   * índice `[fecha+alumno_id]` es lo que lo garantiza.
   */
  marcar(alumnoId: Id, fecha: Fecha, estado: EstadoAsistencia): Promise<void>
}
