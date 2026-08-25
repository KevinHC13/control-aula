import type { Alumno, DatosAlumno } from '@/domain/entities'
import type { Id, Suscribible } from '@/domain/values'

/**
 * Contrato del grupo.
 *
 * La lista sigue entrando **completa** por la carga asistida por IA (D-014) o
 * por un respaldo: es el camino normal y el que evita teclear treinta nombres.
 * Encima de eso hay alta, edición y baja uno por uno (D-026), porque un grupo
 * real se mueve durante el año —llega alguien en noviembre, otro se cambia de
 * escuela— y volver a cargar la lista entera para eso no es una respuesta.
 *
 * Cada método sigue siendo un caso de uso con nombre propio, no un CRUD
 * genérico: se llaman `agregar`, `editar` y `darDeBaja`, no `save` ni `remove`,
 * y el puerto sigue sin declarar un solo método por consulta
 * (docs/DECISIONES.md D-009).
 */
export interface AlumnosRepo {
  /**
   * El grupo en el orden de la lista oficial, sin los borrados.
   *
   * **Son los alumnos del ciclo abierto** (D-025). No recibe el ciclo por
   * parámetro a propósito: no existe un «ver el grupo de otro ciclo» en el
   * camino diario, y que el repositorio lo resuelva es lo que impide que una
   * pantalla se salte el acote por olvido.
   */
  lista(): Promise<Alumno[]>

  /** Lo mismo, reactivo: emite de nuevo cuando el grupo cambia. */
  observarLista(): Suscribible<Alumno[]>

  /**
   * El grupo del ciclo abierto **con los dados de baja**.
   *
   * Quién entra a un reporte lo decide `armarReporte`, no el repositorio: en un
   * trimestre cerrado entran todos y en uno abierto solo los vigentes. Aquí se
   * entrega el conjunto completo para que esa decisión siga viviendo en un solo
   * sitio (D-026).
   */
  conBajas(): Promise<Alumno[]>

  /**
   * Lo mismo, reactivo.
   *
   * Dos pantallas lo necesitan y ninguna es del camino diario: la de
   * administrar alumnos —para poder deshacer una baja— y el reporte de un
   * trimestre **cerrado**, donde un alumno que se fue en noviembre tiene que
   * seguir apareciendo en el trimestre que se cerró en octubre. Dar de baja no
   * puede cambiar una boleta que ya se entregó (D-026).
   */
  observarConBajas(): Suscribible<Alumno[]>

  /**
   * El grupo de un ciclo cualquiera, incluido uno cerrado. Es lo único que hace
   * falta para consultar el año pasado (D-025), y por eso no es reactivo: la
   * lista de un ciclo cerrado no cambia.
   *
   * Sin esto, el reporte de un trimestre de otro ciclo se armaría sobre los
   * alumnos de **hoy** y saldría vacío: los cierres apuntan a ids que ya no
   * están en la lista diaria.
   */
  deCiclo(cicloId: Id): Promise<Alumno[]>

  /** Lo mismo, con los dados de baja, por la razón de `observarConBajas`. */
  deCicloConBajas(cicloId: Id): Promise<Alumno[]>

  /**
   * Carga la lista oficial del archivo que la maestra subió desde Ajustes.
   * Idempotente: la identidad de un alumno es su
   * `numero_lista`, así que correrlo dos veces no duplica, y si el archivo
   * cambió un nombre lo actualiza conservando el `id` —y con él su asistencia y
   * sus calificaciones—.
   *
   * No borra: un alumno que ya no está en el archivo se queda en la base. Dar
   * de baja es una decisión con datos de por medio, no un efecto secundario de
   * cargar una lista.
   *
   * La identidad es el número de lista **dentro del ciclo abierto**: cargar la
   * lista del año nuevo crea alumnos nuevos, no reescribe los del anterior.
   */
  sembrar(datos: DatosAlumno[]): Promise<void>

  /**
   * Da de alta a un alumno que llegó con el ciclo empezado. Queda en el ciclo
   * abierto, como los que entraron con la lista.
   *
   * Se niega si el número de lista ya está tomado **en ese ciclo, contando a los
   * dados de baja**: `sembrar()` fusiona por número de lista, así que dos
   * alumnos con el mismo número harían que una recarga de la lista escribiera
   * sobre cualquiera de los dos. La pantalla avisa antes; esto es el respaldo.
   */
  agregar(datos: DatosAlumno): Promise<void>

  /**
   * Corrige los datos de un alumno. **Conserva el `id`**, que es de donde
   * cuelgan su asistencia y sus calificaciones: corregir un apellido mal escrito
   * no puede costar el trimestre.
   *
   * Se niega ante un número de lista tomado por otro, por lo mismo que `agregar`.
   */
  editar(id: Id, datos: DatosAlumno): Promise<void>

  /**
   * Da de baja a un alumno: el borrado suave del proyecto, `deleted_at`.
   *
   * Nada de lo suyo se borra —su asistencia y sus calificaciones siguen ahí, y
   * su `id` sigue siendo válido—; deja de aparecer en el camino diario, que es
   * lo que significa que se fue de la escuela.
   */
  darDeBaja(id: Id): Promise<void>

  /** Deshace una baja. Existe porque tocar el renglón equivocado pasa. */
  reactivar(id: Id): Promise<void>
}
