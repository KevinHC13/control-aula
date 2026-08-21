import { liveQuery } from 'dexie'

import type { BitacoraRepo } from '@/data/ports/bitacora'
import type { Reporte } from '@/domain/entities'
import type { Fecha, Id, Suscribible } from '@/domain/values'

import { ahora, db, nuevoId } from './db'

export class DexieBitacoraRepo implements BitacoraRepo {
  /**
   * Una sola consulta por rango sobre el índice `fecha`, como el mes de
   * asistencia. El orden se hace en memoria: son los reportes de un trimestre
   * —decenas, no miles— y ordenar aquí ahorra un índice compuesto que nadie más
   * necesitaría.
   */
  async porRango(desde: Fecha, hasta: Fecha): Promise<Reporte[]> {
    const delRango = await db.bitacora.where('fecha').between(desde, hasta, true, true).toArray()
    // El filtro va en memoria: IndexedDB no indexa `null`, así que los vivos no
    // están en el índice de `deleted_at`. Ver la nota en alumnos.adapter.ts.
    return delRango
      .filter((r) => r.deleted_at === null)
      // Más reciente primero, y a igual día el último escrito arriba: dentro de
      // un día la fecha no desempata, `updated_at` sí.
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.updated_at.localeCompare(a.updated_at))
  }

  observarRango(desde: Fecha, hasta: Fecha): Suscribible<Reporte[]> {
    return liveQuery(() => this.porRango(desde, hasta))
  }

  /**
   * Inserta siempre: dos reportes del mismo alumno el mismo día son dos
   * reportes, no una corrección. Es lo contrario de la asistencia, donde el
   * índice `[fecha+alumno_id]` garantiza uno solo.
   */
  async registrar(alumnoId: Id, fecha: Fecha, texto: string): Promise<Id> {
    const reporte: Reporte = {
      id: nuevoId(),
      alumno_id: alumnoId,
      fecha,
      texto,
      updated_at: ahora(),
      deleted_at: null,
    }

    await db.transaction('rw', db.bitacora, db.outbox, async () => {
      await db.bitacora.add(reporte)
      await db.outbox.add({
        tabla: 'bitacora',
        registro_id: reporte.id,
        op: 'upsert',
        at: ahora(),
      })
    })

    return reporte.id
  }

  /**
   * Borrado suave, con la marca en `deleted_at` y la op `delete` en la `outbox`:
   * el reporte desaparece de la pantalla y deja de contar, pero el registro
   * sigue ahí para que la sincronía pueda propagar la baja.
   */
  async quitar(reporteId: Id): Promise<void> {
    await db.transaction('rw', db.bitacora, db.outbox, async () => {
      const momento = ahora()
      const cambiados = await db.bitacora.update(reporteId, {
        deleted_at: momento,
        updated_at: momento,
      })
      // Quitar dos veces el mismo reporte no encola una baja de algo que ya no
      // está: `update` devuelve 0 cuando el id no existe.
      if (cambiados === 0) return

      await db.outbox.add({
        tabla: 'bitacora',
        registro_id: reporteId,
        op: 'delete',
        at: momento,
      })
    })
  }
}
