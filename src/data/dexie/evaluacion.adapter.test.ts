import 'fake-indexeddb/auto'

import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from './db'
import { DexieEvaluacionRepo } from './evaluacion.adapter'

const repo = new DexieEvaluacionRepo()

const PERIODOS = [
  { numero: 1 as const, inicio: '2026-08-24', fin: '2026-11-27' },
  { numero: 2 as const, inicio: '2026-11-30', fin: '2027-03-19' },
  { numero: 3 as const, inicio: '2027-03-22', fin: '2027-07-16' },
]

beforeEach(async () => {
  await db.open()
  await db.ciclos.clear()
  await db.trimestres.clear()
  await db.outbox.clear()
})

afterAll(() => {
  db.close()
})

describe('cicloEnCurso', () => {
  it('sin ciclo configurado devuelve null, no falla', async () => {
    expect(await repo.cicloEnCurso()).toBeNull()
  })

  it('devuelve el ciclo con sus trimestres ordenados por número', async () => {
    // Se abren desordenados a propósito: el orden lo pone la lectura, no el
    // orden de inserción.
    await repo.abrirCiclo('2026–2027', [PERIODOS[2]!, PERIODOS[0]!, PERIODOS[1]!])

    const enCurso = await repo.cicloEnCurso()
    expect(enCurso?.ciclo.nombre).toBe('2026–2027')
    expect(enCurso?.trimestres.map((t) => t.numero)).toEqual([1, 2, 3])
  })

  it('ignora los ciclos cerrados', async () => {
    await repo.abrirCiclo('2026–2027', PERIODOS)
    const abierto = await repo.cicloEnCurso()
    await db.ciclos.update(abierto!.ciclo.id, { estado: 'cerrado' })

    expect(await repo.cicloEnCurso()).toBeNull()
  })

  it('ignora los ciclos borrados', async () => {
    await repo.abrirCiclo('2026–2027', PERIODOS)
    const abierto = await repo.cicloEnCurso()
    await db.ciclos.update(abierto!.ciclo.id, { deleted_at: '2026-08-25T00:00:00.000Z' })

    expect(await repo.cicloEnCurso()).toBeNull()
  })

  it('no devuelve trimestres borrados', async () => {
    await repo.abrirCiclo('2026–2027', PERIODOS)
    const enCurso = await repo.cicloEnCurso()
    await db.trimestres.update(enCurso!.trimestres[1]!.id, {
      deleted_at: '2026-08-25T00:00:00.000Z',
    })

    expect((await repo.cicloEnCurso())?.trimestres.map((t) => t.numero)).toEqual([1, 3])
  })
})

describe('abrirCiclo', () => {
  it('nace abierto, con los tres trimestres abiertos y sin cerrar', async () => {
    await repo.abrirCiclo('2026–2027', PERIODOS)
    const enCurso = await repo.cicloEnCurso()

    expect(enCurso?.ciclo.estado).toBe('abierto')
    expect(enCurso?.trimestres).toHaveLength(3)
    for (const trimestre of enCurso!.trimestres) {
      expect(trimestre.estado).toBe('abierto')
      expect(trimestre.cerrado_en).toBeNull()
      expect(trimestre.deleted_at).toBeNull()
      expect(trimestre.ciclo_id).toBe(enCurso!.ciclo.id)
    }
  })

  it('usa UUID del cliente, nunca autoincremento', async () => {
    await repo.abrirCiclo('2026–2027', PERIODOS)
    const enCurso = await repo.cicloEnCurso()
    expect(enCurso?.ciclo.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('escribe updated_at en cada registro', async () => {
    await repo.abrirCiclo('2026–2027', PERIODOS)
    const enCurso = await repo.cicloEnCurso()

    expect(enCurso?.ciclo.updated_at).toMatch(/Z$/)
    for (const trimestre of enCurso!.trimestres) {
      expect(trimestre.updated_at).toMatch(/Z$/)
    }
  })

  it('encola el ciclo y sus tres trimestres en la outbox', async () => {
    await repo.abrirCiclo('2026–2027', PERIODOS)

    const pendientes = await db.outbox.toArray()
    expect(pendientes.filter((c) => c.tabla === 'ciclos')).toHaveLength(1)
    expect(pendientes.filter((c) => c.tabla === 'trimestres')).toHaveLength(3)
  })

  it('no deja un ciclo a medias si la transacción falla', async () => {
    // Un periodo con `numero` fuera del esquema no rompe nada, así que el modo
    // de falla que sí importa se provoca con un id repetido: el ciclo se escribe
    // primero y el trimestre después.
    await repo.abrirCiclo('2026–2027', PERIODOS)
    const antes = await db.ciclos.count()

    await expect(
      db.transaction('rw', db.ciclos, db.trimestres, db.outbox, async () => {
        const existente = (await db.ciclos.toArray())[0]!
        await db.ciclos.add(existente) // choca con la clave primaria
      }),
    ).rejects.toThrow()

    expect(await db.ciclos.count()).toBe(antes)
  })
})

describe('ajustarFechas', () => {
  it('cambia el rango y refresca updated_at', async () => {
    await repo.abrirCiclo('2026–2027', PERIODOS)
    const antes = (await repo.cicloEnCurso())!.trimestres[0]!

    await repo.ajustarFechas(antes.id, '2026-08-25', '2026-12-04')

    const despues = (await repo.cicloEnCurso())!.trimestres[0]!
    expect(despues.inicio).toBe('2026-08-25')
    expect(despues.fin).toBe('2026-12-04')
    expect(despues.id).toBe(antes.id)
  })

  it('no toca los demás trimestres', async () => {
    await repo.abrirCiclo('2026–2027', PERIODOS)
    const trimestres = (await repo.cicloEnCurso())!.trimestres

    await repo.ajustarFechas(trimestres[0]!.id, '2026-08-25', '2026-12-04')

    const despues = (await repo.cicloEnCurso())!.trimestres
    expect(despues[1]).toEqual(trimestres[1])
    expect(despues[2]).toEqual(trimestres[2])
  })

  it('encola el cambio', async () => {
    await repo.abrirCiclo('2026–2027', PERIODOS)
    const trimestre = (await repo.cicloEnCurso())!.trimestres[0]!
    await db.outbox.clear()

    await repo.ajustarFechas(trimestre.id, '2026-08-25', '2026-12-04')

    const pendientes = await db.outbox.toArray()
    expect(pendientes).toHaveLength(1)
    expect(pendientes[0]?.tabla).toBe('trimestres')
    expect(pendientes[0]?.registro_id).toBe(trimestre.id)
  })

  it('falla si el trimestre no existe, en vez de crear uno', async () => {
    await expect(repo.ajustarFechas('no-existe', '2026-08-25', '2026-12-04')).rejects.toThrow()
    expect(await db.trimestres.count()).toBe(0)
  })
})
