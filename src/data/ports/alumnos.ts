import type { Alumno } from '@/domain/entities'
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
}
