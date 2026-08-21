import type { Reporte } from '@/domain/entities'
import type { Fecha, Id, Suscribible } from '@/domain/values'

/**
 * Contrato de la bitácora. Se lee **por rango de fechas** y no por trimestre: la
 * atribución al trimestre se deriva al leer, nunca se guarda, así que el puerto
 * no conoce trimestres —igual que `AsistenciaRepo` recibe un mes y no un
 * periodo— (docs/DATA-MODEL.md).
 *
 * No hay `editar`: un reporte se escribe el día que pasó y corregirlo es
 * quitarlo y volver a escribirlo. Un texto que cambia después de haber contado
 * para conducta es historia reescrita.
 */
export interface BitacoraRepo {
  /** Los reportes del rango, sin los borrados, más recientes primero. */
  porRango(desde: Fecha, hasta: Fecha): Promise<Reporte[]>

  /**
   * Lo mismo, reactivo. Es lo que hace que el conteo por alumno suba en cuanto
   * se guarda un reporte, sin recargar: el conteo es lo que le permite ver que
   * un alumno ya va en dos antes de escribir el tercero.
   */
  observarRango(desde: Fecha, hasta: Fecha): Suscribible<Reporte[]>

  /** Anota un reporte. Devuelve su `id` para que la pantalla pueda señalarlo. */
  registrar(alumnoId: Id, fecha: Fecha, texto: string): Promise<Id>

  /** Borrado suave: el reporte deja de contar para conducta. */
  quitar(reporteId: Id): Promise<void>
}
