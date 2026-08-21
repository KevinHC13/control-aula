import { liveQuery } from 'dexie'

import type { LotePorSubir, SincroniaRepo } from '@/data/ports/sincronia'
import type { Suscribible } from '@/domain/values'

import { db, TABLAS_SINCRONIZABLES } from './db'

export class DexieSincroniaRepo implements SincroniaRepo {
  tablasSincronizables(): readonly string[] {
    return TABLAS_SINCRONIZABLES
  }

  async cuantosPendientes(): Promise<number> {
    return db.outbox.count()
  }

  observarPendientes(): Suscribible<number> {
    return liveQuery(() => this.cuantosPendientes())
  }

  /**
   * Los primeros `tope` cambios en orden de llegada —`++seq` es autoincremental,
   * así que el orden de la tabla ya es el cronológico— con sus filas resueltas.
   *
   * Las filas se agrupan por tabla y sin repetir: la `outbox` encola un cambio por
   * toque, así que ciclar el estado de un alumno cinco veces deja cinco filas
   * apuntando al mismo registro. Lo que se sube es el registro **como está ahora**,
   * una sola vez, que es todo lo que el servidor necesita para quedar igual.
   */
  async lotePorSubir(tope: number): Promise<LotePorSubir> {
    const pendientes = await db.outbox.orderBy('seq').limit(tope).toArray()

    const cambios = pendientes.map((c) => ({
      seq: c.seq!,
      tabla: c.tabla,
      registro_id: c.registro_id,
    }))

    const filas: Record<string, unknown[]> = {}
    const yaAgregados = new Set<string>()

    for (const cambio of cambios) {
      const clave = `${cambio.tabla}/${cambio.registro_id}`
      if (yaAgregados.has(clave)) continue
      yaAgregados.add(clave)

      const fila = await db.table(cambio.tabla).get(cambio.registro_id)
      // Una fila que ya no existe no se sube, pero su cambio sí se confirma: si se
      // quedara en la cola, bloquearía todo lo que venga detrás para siempre.
      if (fila === undefined) continue

      filas[cambio.tabla] = [...(filas[cambio.tabla] ?? []), fila]
    }

    return { cambios, filas }
  }

  async confirmar(seqs: readonly number[]): Promise<void> {
    if (seqs.length === 0) return
    await db.outbox.bulkDelete([...seqs])
  }
}
