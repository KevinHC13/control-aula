import { liveQuery } from 'dexie'

import type { CicloEnCurso, EvaluacionRepo, PeriodoNuevo } from '@/data/ports/evaluacion'
import type { Ciclo, Trimestre } from '@/domain/entities'
import type { Fecha, Id, Suscribible } from '@/domain/values'

import { ahora, db, nuevoId } from './db'

export class DexieEvaluacionRepo implements EvaluacionRepo {
  async cicloEnCurso(): Promise<CicloEnCurso | null> {
    // El filtro de vivos va en memoria: IndexedDB no indexa `null`, así que los
    // registros con `deleted_at: null` no están en ese índice. Ver la nota en
    // alumnos.adapter.ts.
    const abiertos = (await db.ciclos.where('estado').equals('abierto').toArray()).filter(
      (c) => c.deleted_at === null,
    )
    // Solo puede haber uno abierto; si hubiera dos, el más reciente es el que
    // ella acaba de configurar.
    const ciclo = abiertos.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
    if (!ciclo) return null

    const trimestres = (await db.trimestres.where('ciclo_id').equals(ciclo.id).toArray())
      .filter((t) => t.deleted_at === null)
      .sort((a, b) => a.numero - b.numero)

    return { ciclo, trimestres }
  }

  observarCicloEnCurso(): Suscribible<CicloEnCurso | null> {
    return liveQuery(() => this.cicloEnCurso())
  }

  async abrirCiclo(nombre: string, periodos: PeriodoNuevo[]): Promise<void> {
    await db.transaction('rw', db.ciclos, db.trimestres, db.outbox, async () => {
      const momento = ahora()

      const ciclo: Ciclo = {
        id: nuevoId(),
        nombre,
        estado: 'abierto',
        updated_at: momento,
        deleted_at: null,
      }

      const trimestres: Trimestre[] = periodos.map((periodo) => ({
        id: nuevoId(),
        ciclo_id: ciclo.id,
        numero: periodo.numero,
        inicio: periodo.inicio,
        fin: periodo.fin,
        estado: 'abierto',
        cerrado_en: null,
        updated_at: momento,
        deleted_at: null,
      }))

      await db.ciclos.add(ciclo)
      await db.trimestres.bulkAdd(trimestres)
      await db.outbox.bulkAdd([
        { tabla: 'ciclos', registro_id: ciclo.id, op: 'upsert', at: momento },
        ...trimestres.map((t) => ({
          tabla: 'trimestres' as const,
          registro_id: t.id,
          op: 'upsert' as const,
          at: momento,
        })),
      ])
    })
  }

  async ajustarFechas(trimestreId: Id, inicio: Fecha, fin: Fecha): Promise<void> {
    await db.transaction('rw', db.trimestres, db.outbox, async () => {
      const trimestre = await db.trimestres.get(trimestreId)
      if (!trimestre) throw new Error(`No existe el trimestre ${trimestreId}`)

      const momento = ahora()
      await db.trimestres.put({ ...trimestre, inicio, fin, updated_at: momento })
      await db.outbox.add({
        tabla: 'trimestres',
        registro_id: trimestre.id,
        op: 'upsert',
        at: momento,
      })
    })
  }
}
