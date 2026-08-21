import type { Participacion } from '@/domain/entities'
import type { Fecha, Id, Suscribible } from '@/domain/values'

/**
 * Contrato de la participación. Es una tabla aparte de la asistencia y no un
 * campo suyo: marcar una participación no puede fabricar un registro de
 * asistencia, porque un día sin lista pasada no tiene fila y crearla para
 * colgarle un contador inventaría presencia —lo contrario de D-013—.
 *
 * Como la bitácora, se lee **por rango de fechas** para el conteo del trimestre:
 * la atribución se deriva al leer y el puerto no conoce trimestres.
 */
export interface ParticipacionesRepo {
  /** Los contadores de un día, sin los borrados. */
  porDia(fecha: Fecha): Promise<Participacion[]>

  /** Lo mismo, reactivo: es lo que hace que el número suba al toque. */
  observarDia(fecha: Fecha): Suscribible<Participacion[]>

  /** Los contadores del rango, para el conteo del trimestre por alumno. */
  porRango(desde: Fecha, hasta: Fecha): Promise<Participacion[]>

  /** Lo mismo, reactivo. */
  observarRango(desde: Fecha, hasta: Fecha): Suscribible<Participacion[]>

  /**
   * Suma una participación del día. Upsert por `[fecha+alumno_id]`: es **un
   * contador y no una fila por marca**, así que tres participaciones en una clase
   * son una fila con `cantidad: 3` y no tres filas —ni tres entradas en la
   * `outbox`— (docs/DATA-MODEL.md).
   */
  sumarUna(alumnoId: Id, fecha: Fecha): Promise<void>

  /**
   * Resta una. Nunca baja de cero: deshacer de más no puede dejar un contador
   * negativo, que después restaría participaciones de otros días al sumar el
   * trimestre.
   *
   * La fila se queda en cero en vez de borrarse. Un cero explícito y la ausencia
   * de fila significan lo mismo al calificar, y conservarla evita que deshacer y
   * volver a marcar sea crear, borrar y volver a crear.
   */
  restarUna(alumnoId: Id, fecha: Fecha): Promise<void>
}
