import type { Id, Suscribible } from '@/domain/values'

/**
 * Contrato del motor de sincronía sobre la base local.
 *
 * Es un puerto aparte de los demás **a propósito**: los otros hablan de alumnos,
 * de asistencia o de calificaciones; este habla de filas y de la `outbox`. El
 * motor no pasa por los casos de uso —no vuelve a «marcar asistencia» al
 * restaurar— y por eso no puede compartir su contrato (docs/ARCHITECTURE.md).
 *
 * Lo que **no** está aquí es escribir lo que se baja: eso lo hace
 * `RespaldoRepo.restaurar`, el mismo camino del respaldo en JSON. Restaurar de un
 * archivo y restaurar de la nube son la misma operación con distinto origen, y
 * tener dos implementaciones sería tener dos formas de equivocarse.
 */

/** Una fila de la `outbox` con la fila que le corresponde, ya resuelta. */
export interface CambioPorSubir {
  seq: number
  tabla: string
  registro_id: Id
}

/**
 * Lo que hay por subir: los cambios y las filas que los acompañan, agrupadas por
 * tabla y listas para viajar.
 *
 * Vienen juntos porque el motor necesita las dos cosas a la vez: las filas para
 * subirlas y los `seq` para poder borrarlos **después** de que el servidor
 * confirme.
 */
export interface LotePorSubir {
  cambios: CambioPorSubir[]
  /** `nombre de tabla → filas`, sin duplicados. */
  filas: Record<string, unknown[]>
}

export interface SincroniaRepo {
  /**
   * Los nombres de las tablas que se sincronizan.
   *
   * Los da el repositorio y no una lista escrita en el caso de uso: quien conoce
   * el esquema es la capa de datos, y con dos listas la que se olvida de crecer
   * es siempre la de acá —una tabla nueva dejaría de subir en silencio—. Es el
   * mismo motivo por el que `RespaldoRepo` recorre el esquema solo.
   */
  tablasSincronizables(): readonly string[]

  /** Cuántos cambios esperan turno. Es la cifra que la pantalla enseña. */
  cuantosPendientes(): Promise<number>

  /** Lo mismo, reactivo: el contador baja solo al terminar de subir. */
  observarPendientes(): Suscribible<number>

  /**
   * El siguiente lote por subir, de a lo más `tope` cambios.
   *
   * Por lotes y no de golpe: un trimestre entero de captura son miles de filas y
   * una sola petición gigante es la que se cae a mitad con la red del salón.
   *
   * Si un cambio apunta a una fila que ya no existe, se devuelve igual en
   * `cambios` y no en `filas`: hay que sacarlo de la `outbox` de todos modos, o
   * bloquearía la cola para siempre.
   */
  lotePorSubir(tope: number): Promise<LotePorSubir>

  /**
   * Saca de la `outbox` los cambios ya confirmados por el servidor.
   *
   * **Solo se llama después de que el servidor contestó bien**: una `outbox` que
   * se vacía al mandar la petición pierde lo capturado en cuanto la red falla, y
   * eso es justo lo que no puede pasar (docs/DECISIONES.md D-006).
   */
  confirmar(seqs: readonly number[]): Promise<void>
}
