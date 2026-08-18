import type { Alumno, DatosAlumno } from '@/domain/entities'
import type { Suscribible } from '@/domain/values'

/**
 * Contrato de lectura del grupo. Sin `alta`, `baja` ni `editar`: no hay CRUD de
 * alumnos en la v1 —la lista se carga una vez desde la semilla— y un puerto
 * declara solo lo que alguna pantalla usa hoy (docs/DECISIONES.md D-008, D-009).
 */
export interface AlumnosRepo {
  /** El grupo en el orden de la lista oficial, sin los borrados. */
  lista(): Promise<Alumno[]>

  /** Lo mismo, reactivo: emite de nuevo cuando el grupo cambia. */
  observarLista(): Suscribible<Alumno[]>

  /**
   * Carga la lista oficial. Idempotente: la identidad de un alumno es su
   * `numero_lista`, así que correrlo dos veces no duplica, y si el archivo
   * cambió un nombre lo actualiza conservando el `id` —y con él su asistencia y
   * sus calificaciones—.
   *
   * No borra: un alumno que ya no está en el archivo se queda en la base. Dar
   * de baja es una decisión con datos de por medio, no un efecto secundario de
   * arrancar la app.
   */
  sembrar(datos: DatosAlumno[]): Promise<void>
}
