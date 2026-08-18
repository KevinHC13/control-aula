import { liveQuery } from 'dexie'

import type { AlumnosRepo } from '@/data/ports/alumnos'
import type { Alumno } from '@/domain/entities'
import type { Suscribible } from '@/domain/values'

import { db } from './db'

/**
 * Nota sobre el filtro de borrados: no se puede resolver con el índice de
 * `deleted_at`. IndexedDB no admite `null` como clave, así que los registros
 * vivos —los que tienen `deleted_at: null`— simplemente no están en ese índice.
 * El índice sirve para encontrar los borrados; los vivos se filtran en memoria,
 * que con 30 alumnos no cuesta nada.
 */
function vivos(alumnos: Alumno[]): Alumno[] {
  return alumnos.filter((a) => a.deleted_at === null)
}

export class DexieAlumnosRepo implements AlumnosRepo {
  async lista(): Promise<Alumno[]> {
    return vivos(await db.alumnos.orderBy('numero_lista').toArray())
  }

  observarLista(): Suscribible<Alumno[]> {
    return liveQuery(() => this.lista())
  }
}
