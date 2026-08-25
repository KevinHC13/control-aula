// IndexedDB no existe en node: fake-indexeddb la provee en memoria.
import 'fake-indexeddb/auto'

import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { repos } from '@/data'
import { db } from '@/data/dexie/db'
import type { CicloEnCurso } from '@/data/ports/evaluacion'

import { ciclosAnteriores, trimestresConsultables } from './historico'

const ciclo = (id: string, estado: 'abierto' | 'cerrado') => ({
  id,
  nombre: id,
  estado,
  updated_at: '2026-08-24T00:00:00.000Z',
  deleted_at: null,
})

const trimestre = (
  id: string,
  cicloId: string,
  numero: 1 | 2 | 3,
  inicio: string,
  fin: string,
  estado: 'abierto' | 'cerrado' = 'cerrado',
) => ({
  id,
  ciclo_id: cicloId,
  numero,
  inicio,
  fin,
  estado,
  cerrado_en: estado === 'cerrado' ? '2026-11-27T18:00:00.000Z' : null,
  updated_at: '2026-08-24T00:00:00.000Z',
  deleted_at: null,
})

beforeEach(async () => {
  await db.open()
  await db.ciclos.clear()
  await db.trimestres.clear()
  await db.alumnos.clear()
})

afterAll(() => {
  db.close()
})

describe('ciclosAnteriores', () => {
  it('sin ciclos terminados devuelve lista vacía', async () => {
    await db.ciclos.put(ciclo('2026–2027', 'abierto'))

    expect(await ciclosAnteriores()).toEqual([])
  })

  it('trae los cerrados y deja fuera el abierto', async () => {
    // El abierto se consulta por su pestaña; ofrecerlo aquí serían dos caminos
    // a lo mismo.
    await db.ciclos.bulkPut([ciclo('2025–2026', 'cerrado'), ciclo('2026–2027', 'abierto')])

    const anteriores = await ciclosAnteriores()
    expect(anteriores.map((c) => c.ciclo.nombre)).toEqual(['2025–2026'])
  })

  it('los ordena del más reciente al más viejo', async () => {
    await db.ciclos.bulkPut([ciclo('2024–2025', 'cerrado'), ciclo('2025–2026', 'cerrado')])
    await db.trimestres.bulkPut([
      trimestre('t-viejo', '2024–2025', 1, '2024-08-26', '2024-11-29'),
      trimestre('t-nuevo', '2025–2026', 1, '2025-08-25', '2025-11-28'),
    ])

    const anteriores = await ciclosAnteriores()
    expect(anteriores.map((c) => c.ciclo.nombre)).toEqual(['2025–2026', '2024–2025'])
  })

  it('cada ciclo llega con sus trimestres, ordenados por número', async () => {
    await db.ciclos.put(ciclo('2025–2026', 'cerrado'))
    await db.trimestres.bulkPut([
      trimestre('t2', '2025–2026', 2, '2025-12-01', '2026-03-20'),
      trimestre('t1', '2025–2026', 1, '2025-08-25', '2025-11-28'),
    ])

    const [anterior] = await ciclosAnteriores()
    expect(anterior?.trimestres.map((t) => t.numero)).toEqual([1, 2])
  })
})

describe('trimestresConsultables', () => {
  it('deja fuera un trimestre abierto', () => {
    // Calcularlo al vuelo daría números que ya no corresponden a los criterios
    // de entonces. Vale más no ofrecerlo.
    const c: CicloEnCurso = {
      ciclo: ciclo('2025–2026', 'cerrado'),
      trimestres: [
        trimestre('t1', '2025–2026', 1, '2025-08-25', '2025-11-28'),
        trimestre('t2', '2025–2026', 2, '2025-12-01', '2026-03-20', 'abierto'),
      ],
    }

    expect(trimestresConsultables(c).map((t) => t.numero)).toEqual([1])
  })
})

describe('el grupo de un ciclo cerrado', () => {
  it('se lee entero aunque no sea el ciclo abierto', async () => {
    // Sin esto, el reporte del año pasado se armaría sobre los alumnos de hoy y
    // saldría vacío: los cierres apuntan a ids que ya no están en la lista.
    await db.ciclos.bulkPut([ciclo('viejo', 'cerrado'), ciclo('nuevo', 'abierto')])
    await db.alumnos.bulkPut([
      {
        id: 'a-viejo',
        ciclo_id: 'viejo',
        nombre: 'Del año pasado',
        numero_lista: 1,
        fecha_nacimiento: null,
        updated_at: '2025-08-25T00:00:00.000Z',
        deleted_at: null,
      },
      {
        id: 'a-nuevo',
        ciclo_id: 'nuevo',
        nombre: 'De este año',
        numero_lista: 1,
        fecha_nacimiento: null,
        updated_at: '2026-08-24T00:00:00.000Z',
        deleted_at: null,
      },
    ])

    expect((await repos.alumnos.deCiclo('viejo')).map((a) => a.nombre)).toEqual([
      'Del año pasado',
    ])
    // Y la lista diaria sigue siendo la de hoy.
    expect((await repos.alumnos.lista()).map((a) => a.nombre)).toEqual(['De este año'])
  })

  it('no devuelve a los que se dieron de baja', async () => {
    await db.ciclos.put(ciclo('viejo', 'cerrado'))
    await db.alumnos.put({
      id: 'a-1',
      ciclo_id: 'viejo',
      nombre: 'Se cambió de escuela',
      numero_lista: 1,
      fecha_nacimiento: null,
      updated_at: '2025-08-25T00:00:00.000Z',
      deleted_at: '2025-10-01T00:00:00.000Z',
    })

    expect(await repos.alumnos.deCiclo('viejo')).toEqual([])
  })
})
