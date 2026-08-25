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

/**
 * El ciclo al que pertenece el grupo de hoy: el abierto, o `null` si todavía no
 * se configura ninguno.
 *
 * Vive aquí y no en el puerto a propósito. Todas las pantallas leen el grupo por
 * `lista()`/`observarLista()`, así que acotar por ciclo en un solo lugar las
 * acota todas, y ninguna puede saltárselo por olvido. El precio es que este
 * adaptador lee `db.ciclos`, que no es «su» tabla; es más barato que repartir la
 * decisión por seis pantallas.
 */
async function cicloAbierto(): Promise<string | null> {
  const abiertos = (await db.ciclos.where('estado').equals('abierto').toArray()).filter(
    (c) => c.deleted_at === null,
  )
  // El mismo desempate que `cicloEnCurso()`: solo puede haber uno abierto, y si
  // hubiera dos, el más reciente es el que ella acaba de configurar.
  return abiertos.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]?.id ?? null
}

export class DexieAlumnosRepo implements AlumnosRepo {
  /**
   * El grupo del ciclo abierto. Sin ciclo configurado devuelve los alumnos que
   * todavía no tienen ninguno, que es lo que permite pasar lista el primer día
   * sin haber abierto nada: en cuanto se abre el ciclo, los adopta.
   */
  async lista(): Promise<Alumno[]> {
    const ciclo = await cicloAbierto()
    const todos = await db.alumnos.orderBy('numero_lista').toArray()
    return vivos(todos).filter((a) => (a.ciclo_id ?? null) === ciclo)
  }

  observarLista(): Suscribible<Alumno[]> {
    // Depende de `ciclos` además de `alumnos`, y `liveQuery` lo detecta solo:
    // rastrea las tablas que la consulta tocó. Cerrar un ciclo o abrir otro
    // vuelve a emitir sin que nadie lo pida.
    return liveQuery(() => this.lista())
  }

  /** El grupo de un ciclo cualquiera, para consultar uno cerrado. */
  async deCiclo(cicloId: string): Promise<Alumno[]> {
    const todos = await db.alumnos.orderBy('numero_lista').toArray()
    return vivos(todos).filter((a) => a.ciclo_id === cicloId)
  }

  /**
   * La identidad para fusionar es `[ciclo, numero_lista]`, no `numero_lista` a
   * secas: con dos generaciones en la base, el alumno 1 del ciclo nuevo no es el
   * alumno 1 del anterior, y confundirlos le colgaría la asistencia y las
   * calificaciones del otro.
   */
  async sembrar(datos: DatosAlumno[]): Promise<void> {
    await db.transaction('rw', db.alumnos, db.ciclos, db.outbox, async () => {
      const ciclo = await cicloAbierto()
      const existentes = new Map(
        (await db.alumnos.toArray())
          .filter((a) => (a.ciclo_id ?? null) === ciclo)
          .map((a) => [a.numero_lista, a]),
      )
      const momento = ahora()

      // Solo lo que cambió: si la lista ya se cargó y el archivo es el mismo, no
      // se escribe nada y el `outbox` no se llena de pendientes en cada arranque.
      const porEscribir: Alumno[] = []
      for (const alumno of datos) {
        const existente = existentes.get(alumno.numero_lista)

        if (existente === undefined) {
          porEscribir.push({
            id: nuevoId(),
            ciclo_id: ciclo,
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
