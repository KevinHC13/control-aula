import type { Alumno, DatosAlumno } from '@/domain/entities'
import type { Id, Suscribible } from '@/domain/values'

/**
 * Lo que se da de alta o se corrige a mano, sin el número de lista
 * (docs/DECISIONES.md D-033): ya no es un dato que la maestra elija ni escriba,
 * así que no tiene sentido pedirlo en el formulario. El adaptador le asigna uno
 * internamente al dar de alta, y lo conserva sin tocar al corregir.
 */
export type NuevoAlumno = Omit<DatosAlumno, 'numero_lista'>

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
   * El grupo **en orden alfabético**, sin los borrados.
   *
   * Por apellido y no por número de lista, que es como se busca a un alumno: el
   * que se dio de alta en noviembre tiene su sitio donde lo pone su apellido, no
   * al final. El orden lo pone el adaptador para todas las pantallas a la vez.
   *
   * **El `numero_lista` de cada alumno es su posición en este mismo orden**
   * (D-033), calculada aquí y no la guardada: se recalcula en cada lectura y
   * deja de coincidir con la de antes en cuanto hay un alta, una baja o una
   * corrección de nombre de por medio. Es a propósito —es lo que hace que el
   * número que ve la maestra se mueva solo al lugar que le toca— y por lo mismo
   * **no identifica a nadie**: no se usa para fusionar la lista ni para elegir a
   * quién corregir, solo para leer en voz alta.
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
   * El grupo del ciclo abierto **con los dados de baja**. El `numero_lista` es
   * la misma posición viva de `lista()`, calculada sobre el mismo orden
   * alfabético que junta a vigentes y bajas.
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
   * lista de un ciclo cerrado no cambia. El `numero_lista` es, igual que en
   * `lista()`, la posición alfabética de hoy, no una congelada al cerrar.
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
   * Idempotente: correrlo dos veces no duplica, y si el archivo cambió un dato
   * lo actualiza conservando el `id` —y con él su asistencia y sus
   * calificaciones—.
   *
   * **La identidad ya no es el número de lista** (D-033: con el número vuelto
   * una posición que se recalcula sola, dos cargas de la misma lista ya no
   * traen el mismo número para la misma persona en cuanto hubo una alta de por
   * medio). La fila del archivo se empareja con un alumno ya guardado del ciclo
   * por **CURP igual** cuando los dos lo tienen, y si no, por **nombre exacto
   * igual**. Sin ninguna de las dos coincidencias, es un alumno nuevo.
   *
   * No borra: un alumno que ya no está en el archivo se queda en la base. Dar
   * de baja es una decisión con datos de por medio, no un efecto secundario de
   * cargar una lista.
   *
   * La búsqueda es **dentro del ciclo abierto**: cargar la lista del año nuevo
   * crea alumnos nuevos, no reescribe los del anterior.
   */
  sembrar(datos: DatosAlumno[]): Promise<void>

  /**
   * Da de alta a un alumno que llegó con el ciclo empezado. Queda en el ciclo
   * abierto, como los que entraron con la lista.
   *
   * **Sin número de lista** (D-033): el adaptador le asigna uno internamente
   * —el siguiente al más alto del ciclo, contando a los dados de baja para no
   * reciclarlo— y la maestra nunca lo ve ni lo escribe. En cuanto se guarda, el
   * alumno aparece en `lista()` donde le toca por apellido.
   */
  agregar(datos: NuevoAlumno): Promise<void>

  /**
   * Corrige los datos de un alumno. **Conserva el `id`** y su número interno:
   * de uno cuelgan su asistencia y sus calificaciones, y el otro ya no es un
   * dato que se edite (D-033). Corregir un apellido mal escrito solo cambia
   * dónde aparece por apellido, nunca cuesta el trimestre.
   */
  editar(id: Id, datos: NuevoAlumno): Promise<void>

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
