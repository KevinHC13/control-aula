import { liveQuery } from 'dexie'

import type {
  CicloEnCurso,
  CriterioDelTrimestre,
  EsquemaTrimestre,
  EvaluacionRepo,
  PeriodoNuevo,
} from '@/data/ports/evaluacion'
import type {
  Ciclo,
  Criterio,
  CriterioTrimestre,
  TipoCriterio,
  Trimestre,
} from '@/domain/entities'
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

  async esquemaDeTrimestre(trimestreId: Id): Promise<EsquemaTrimestre | null> {
    const trimestre = await db.trimestres.get(trimestreId)
    if (!trimestre || trimestre.deleted_at !== null) return null

    const ponderados = (
      await db.criterios_trimestre.where('trimestre_id').equals(trimestreId).toArray()
    )
      .filter((c) => c.deleted_at === null)
      .sort((a, b) => a.orden - b.orden)

    // Una sola consulta por lote y no una por fila: son pocos criterios, pero el
    // hábito de resolver la relación con un `bulkGet` es el que evita el N+1
    // cuando la lista crece.
    const criterios = await db.criterios.bulkGet(ponderados.map((c) => c.criterio_id))

    const conCatalogo: CriterioDelTrimestre[] = []
    for (const [i, ponderado] of ponderados.entries()) {
      const criterio = criterios[i]
      // Una fila sin su entrada de catálogo es una inconsistencia que no debería
      // existir; se omite en vez de pintar un criterio sin nombre.
      if (criterio && criterio.deleted_at === null) conCatalogo.push({ ponderado, criterio })
    }

    return { trimestre, criterios: conCatalogo }
  }

  observarEsquemaDeTrimestre(trimestreId: Id): Suscribible<EsquemaTrimestre | null> {
    return liveQuery(() => this.esquemaDeTrimestre(trimestreId))
  }

  async agregarCriterio(trimestreId: Id, nombre: string, tipo: TipoCriterio): Promise<void> {
    await db.transaction(
      'rw',
      db.criterios,
      db.criterios_trimestre,
      db.outbox,
      async () => {
        const momento = ahora()

        // El catálogo se reutiliza: «Tareas» tiene que ser el mismo criterio en
        // los tres trimestres para que copiar el esquema signifique algo.
        const existente = (await db.criterios.where('tipo').equals(tipo).toArray()).find(
          (c) => c.deleted_at === null && c.nombre.localeCompare(nombre, 'es', {
            sensitivity: 'base',
          }) === 0,
        )

        let criterio = existente
        if (!criterio) {
          criterio = {
            id: nuevoId(),
            nombre,
            tipo,
            updated_at: momento,
            deleted_at: null,
          } satisfies Criterio
          await db.criterios.add(criterio)
          await db.outbox.add({
            tabla: 'criterios',
            registro_id: criterio.id,
            op: 'upsert',
            at: momento,
          })
        }

        const yaEsta = (
          await db.criterios_trimestre.where('trimestre_id').equals(trimestreId).toArray()
        ).filter((c) => c.deleted_at === null)

        if (yaEsta.some((c) => c.criterio_id === criterio.id)) return

        const ponderado: CriterioTrimestre = {
          id: nuevoId(),
          trimestre_id: trimestreId,
          criterio_id: criterio.id,
          // Nace en 0: un valor de arranque obligaría a adivinar el reparto.
          peso: 0,
          orden: yaEsta.length,
          rubrica_id: null,
          meta_participacion: null,
          updated_at: momento,
          deleted_at: null,
        }

        await db.criterios_trimestre.add(ponderado)
        await db.outbox.add({
          tabla: 'criterios_trimestre',
          registro_id: ponderado.id,
          op: 'upsert',
          at: momento,
        })
      },
    )
  }

  async ajustarPeso(criterioTrimestreId: Id, peso: number): Promise<void> {
    await db.transaction('rw', db.criterios_trimestre, db.outbox, async () => {
      const ponderado = await db.criterios_trimestre.get(criterioTrimestreId)
      if (!ponderado) throw new Error(`No existe el criterio ${criterioTrimestreId}`)

      const momento = ahora()
      await db.criterios_trimestre.put({ ...ponderado, peso, updated_at: momento })
      await db.outbox.add({
        tabla: 'criterios_trimestre',
        registro_id: ponderado.id,
        op: 'upsert',
        at: momento,
      })
    })
  }

  async quitarCriterio(criterioTrimestreId: Id): Promise<void> {
    await db.transaction('rw', db.criterios_trimestre, db.outbox, async () => {
      const ponderado = await db.criterios_trimestre.get(criterioTrimestreId)
      if (!ponderado) return

      const momento = ahora()
      // Borrado suave, y solo de la fila del trimestre: la entrada del catálogo
      // se queda porque otros trimestres la comparten.
      await db.criterios_trimestre.put({
        ...ponderado,
        deleted_at: momento,
        updated_at: momento,
      })
      await db.outbox.add({
        tabla: 'criterios_trimestre',
        registro_id: ponderado.id,
        op: 'delete',
        at: momento,
      })
    })
  }

  async copiarEsquema(desdeTrimestreId: Id, haciaTrimestreId: Id): Promise<void> {
    await db.transaction('rw', db.criterios_trimestre, db.outbox, async () => {
      const origen = (
        await db.criterios_trimestre.where('trimestre_id').equals(desdeTrimestreId).toArray()
      )
        .filter((c) => c.deleted_at === null)
        .sort((a, b) => a.orden - b.orden)

      const destino = (
        await db.criterios_trimestre.where('trimestre_id').equals(haciaTrimestreId).toArray()
      ).filter((c) => c.deleted_at === null)

      const yaEsta = new Set(destino.map((c) => c.criterio_id))
      const porCopiar = origen.filter((c) => !yaEsta.has(c.criterio_id))
      if (porCopiar.length === 0) return

      const momento = ahora()
      // Filas **nuevas**, no las mismas: es lo que hace que cambiar un peso aquí
      // no pueda tocar nada de lo ya calculado en el trimestre de origen.
      // Se copia el peso, la rúbrica y la meta; nunca actividades ni
      // calificaciones, que no cuelgan de esta tabla.
      const copias: CriterioTrimestre[] = porCopiar.map((c, i) => ({
        id: nuevoId(),
        trimestre_id: haciaTrimestreId,
        criterio_id: c.criterio_id,
        peso: c.peso,
        orden: destino.length + i,
        rubrica_id: c.rubrica_id,
        meta_participacion: c.meta_participacion,
        updated_at: momento,
        deleted_at: null,
      }))

      await db.criterios_trimestre.bulkAdd(copias)
      await db.outbox.bulkAdd(
        copias.map((c) => ({
          tabla: 'criterios_trimestre' as const,
          registro_id: c.id,
          op: 'upsert' as const,
          at: momento,
        })),
      )
    })
  }
}
