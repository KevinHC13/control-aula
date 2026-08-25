/**
 * Contrato del respaldo. Es el único puerto que trabaja sobre **todas** las
 * tablas a la vez, y por eso es el único que habla de tablas en lugar de casos
 * de uso del salón: un respaldo que no sepa qué tablas existen no es un
 * respaldo.
 *
 * Quién conoce el esquema es el repositorio, no el caso de uso: si el día que
 * entre `participaciones` a la app hubiera que acordarse de agregarla también
 * aquí, el respaldo saldría incompleto y nadie se daría cuenta hasta el día que
 * se necesitara restaurar.
 */

/** `nombre de tabla → sus filas, tal como están guardadas`. */
export type VolcadoDeTablas = Record<string, unknown[]>

/** `nombre de tabla → cuántas filas se escribieron`. */
export type ConteoPorTabla = Record<string, number>

export interface RespaldoRepo {
  /**
   * La versión del esquema local. Va en el archivo para que restaurar un
   * respaldo de un esquema **más nuevo** se pueda rechazar en vez de escribir
   * filas que esta versión de la app no sabe leer.
   */
  versionDelEsquema(): number

  /**
   * Todas las filas de todas las tablas sincronizables, **incluidas las
   * borradas**. El borrado es suave y un respaldo que se comiera los
   * `deleted_at` resucitaría al restaurar lo que ella dio de baja.
   *
   * La `outbox` no entra: es local, efímera y no es contenido.
   */
  volcar(): Promise<VolcadoDeTablas>

  /**
   * Escribe las filas del respaldo, cada tabla en la suya, todo en **una sola
   * transacción**: un archivo a medio restaurar dejaría calificaciones sin su
   * actividad.
   *
   * Es un upsert por `id`, así que **restaurar dos veces el mismo archivo no
   * duplica nada**, y no borra lo que no viene en el archivo: restaurar es
   * recuperar, no reemplazar el dispositivo.
   *
   * Se niega ante una tabla que no existe en el esquema: es la única señal de
   * que el archivo no es de esta app.
   */
  restaurar(tablas: VolcadoDeTablas): Promise<ConteoPorTabla>

  /**
   * **TEMPORAL — a petición del usuario, hasta que la base del iPad esté limpia.**
   *
   * Deja el dispositivo en cero: borra las filas de todas las tablas, **incluida
   * la `outbox`**. Devuelve cuántas se borraron por tabla, que es lo único que
   * hace creíble un botón así.
   *
   * Es un borrado **duro**, contra la regla general de que aquí todo se borra
   * suave con `deleted_at`, y a propósito: `deleted_at` significa «dada de baja»
   * y se sincroniza; esto no es dar de baja a nadie, es empezar de cero.
   *
   * La `outbox` entra aunque no sea contenido —a diferencia de `volcar()`—
   * porque dejarla con pendientes de registros que ya no existen haría que la
   * siguiente sincronía subiera fantasmas.
   */
  vaciar(): Promise<ConteoPorTabla>
}
