import { liveQuery } from 'dexie'

import type { AlumnosRepo } from '@/data/ports/alumnos'
import type { Alumno, DatosAlumno } from '@/domain/entities'
import type { Suscribible } from '@/domain/values'

import { ahora, db, nuevoId } from './db'

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

  async sembrar(datos: DatosAlumno[]): Promise<void> {
    await db.transaction('rw', db.alumnos, db.outbox, async () => {
      const existentes = new Map(
        (await db.alumnos.toArray()).map((a) => [a.numero_lista, a]),
      )
      const momento = ahora()

      // Solo lo que cambió: si la semilla ya corrió y el archivo es el mismo, no
      // se escribe nada y el `outbox` no se llena de pendientes en cada arranque.
      const porEscribir: Alumno[] = []
      for (const alumno of datos) {
        const existente = existentes.get(alumno.numero_lista)

        if (existente === undefined) {
          porEscribir.push({
            id: nuevoId(),
            ...alumno,
            updated_at: momento,
            deleted_at: null,
          })
          continue
        }

        const igual =
          existente.nombre === alumno.nombre &&
          existente.fecha_nacimiento === alumno.fecha_nacimiento &&
          existente.deleted_at === null
        if (igual) continue

        // Conserva el `id`: con él se conservan su asistencia y sus
        // calificaciones, que apuntan a ese identificador.
        porEscribir.push({
          ...existente,
          ...alumno,
          updated_at: momento,
          deleted_at: null,
        })
      }

      if (porEscribir.length === 0) return

      await db.alumnos.bulkPut(porEscribir)
      await db.outbox.bulkAdd(
        porEscribir.map((a) => ({
          tabla: 'alumnos' as const,
          registro_id: a.id,
          op: 'upsert' as const,
          at: momento,
        })),
      )
    })
  }
}
