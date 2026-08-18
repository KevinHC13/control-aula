import Dexie, { type EntityTable } from 'dexie'

import type {
  Actividad,
  Alumno,
  Calificacion,
  Nota,
  RegistroAsistencia,
} from '@/domain/entities'
import type { Id, Instante } from '@/domain/values'

/**
 * Una fila de la bitácora de cambios por subir. Vive en la capa de datos y no
 * en `domain/`: es un detalle local del dispositivo, nunca se sincroniza como
 * contenido y desaparece cuando el motor de sincronía la sube.
 */
export interface CambioPendiente {
  seq?: number
  tabla: 'alumnos' | 'asistencia' | 'actividades' | 'calificaciones' | 'notas'
  registro_id: Id
  op: 'upsert' | 'delete'
  at: Instante
}

export const db = new Dexie('palomita') as Dexie & {
  alumnos: EntityTable<Alumno, 'id'>
  asistencia: EntityTable<RegistroAsistencia, 'id'>
  actividades: EntityTable<Actividad, 'id'>
  calificaciones: EntityTable<Calificacion, 'id'>
  notas: EntityTable<Nota, 'id'>
  outbox: EntityTable<CambioPendiente, 'seq'>
}

db.version(1).stores({
  alumnos: 'id, numero_lista, deleted_at',
  asistencia: 'id, fecha, alumno_id, [fecha+alumno_id], deleted_at',
  actividades: 'id, fecha, campo, deleted_at',
  calificaciones: 'id, actividad_id, alumno_id, [actividad_id+alumno_id], deleted_at',
  notas: 'id, alumno_id, fecha, deleted_at',
  outbox: '++seq, tabla, registro_id',
})

/**
 * Marca de tiempo para `updated_at`, en ISO 8601 UTC. Se escribe en cada
 * mutación, sin excepción: es lo único que le dice al motor de sincronía qué
 * falta subir (docs/DATA-MODEL.md).
 *
 * Existe como función, y no como `new Date().toISOString()` suelto en cada
 * adaptador, para que el formato sea uno solo y las pruebas puedan congelarlo.
 */
export function ahora(): Instante {
  return new Date().toISOString()
}
