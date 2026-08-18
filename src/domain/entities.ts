import type { EstadoAsistencia, Fecha, Id, Sincronizable } from './values'

export interface Alumno extends Sincronizable {
  /** "Apellidos, Nombres" — el orden de la lista oficial */
  nombre: string
  /** Orden en la lista, 1-based */
  numero_lista: number
  fecha_nacimiento: Fecha | null
}

export interface RegistroAsistencia extends Sincronizable {
  alumno_id: Id
  fecha: Fecha
  estado: EstadoAsistencia
}

/**
 * [POR VALIDAR] Los cuatro campos formativos de la Nueva Escuela Mexicana según
 * mi entendimiento. No está confirmado que su escuela organice así la
 * evaluación, ni que agrupar por campo le sirva de algo en la práctica.
 * Confirmar antes de construir la pantalla de calificaciones.
 */
export type CampoFormativo =
  | 'lenguajes'
  | 'saberes_pensamiento_cientifico'
  | 'etica_naturaleza_sociedades'
  | 'humano_comunitario'

export interface Actividad extends Sincronizable {
  nombre: string
  campo: CampoFormativo
  fecha: Fecha
}

export interface Calificacion extends Sincronizable {
  alumno_id: Id
  actividad_id: Id
  /** [POR VALIDAR] Entero de 5 a 10. Si ella usa decimales, la captura por
   *  botones se cae y este campo cambia de forma (docs/DATA-MODEL.md). */
  valor: number
}

export interface Nota extends Sincronizable {
  alumno_id: Id
  fecha: Fecha
  texto: string
}
