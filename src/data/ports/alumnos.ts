import type { Alumno, DatosAlumno } from '@/domain/entities'
import type { Suscribible } from '@/domain/values'

/**
 * Contrato de lectura del grupo. Sin `alta`, `baja` ni `editar`: no hay CRUD de
 * alumnos en la v1 —la lista entra completa, desde la carga asistida por IA
 * (D-014) o desde un respaldo— y un puerto
 * declara solo lo que alguna pantalla usa hoy (docs/DECISIONES.md D-009).
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
}
