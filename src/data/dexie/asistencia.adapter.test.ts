// IndexedDB no existe en node: fake-indexeddb la provee en memoria.
import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DexieAsistenciaRepo } from './asistencia.adapter'
import { db } from './db'

const HOY = '2026-08-18'
const AYER = '2026-08-17'
const ALUMNO = 'alumno-1'
const OTRO = 'alumno-2'

const repo = new DexieAsistenciaRepo()

beforeEach(async () => {
  await db.open()
  await db.asistencia.clear()
  await db.outbox.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('marcar', () => {
  it('crea el registro del día con estado, id de UUID y updated_at', async () => {
    await repo.marcar(ALUMNO, HOY, 'ausente')

    const registros = await repo.porDia(HOY)
    expect(registros).toHaveLength(1)
    const registro = registros[0]
    expect(registro?.estado).toBe('ausente')
    expect(registro?.alumno_id).toBe(ALUMNO)
    expect(registro?.deleted_at).toBeNull()
    // UUID, no autoincremento.
    expect(registro?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    expect(registro?.updated_at).toMatch(/Z$/)
  })

  it('marcar dos veces el mismo alumno el mismo día actualiza, no crea un segundo', async () => {
    await repo.marcar(ALUMNO, HOY, 'ausente')
    const primero = (await repo.porDia(HOY))[0]

    await repo.marcar(ALUMNO, HOY, 'retardo')
    const registros = await repo.porDia(HOY)

    expect(registros).toHaveLength(1)
    expect(registros[0]?.estado).toBe('retardo')
    // Mismo registro, no uno nuevo.
    expect(registros[0]?.id).toBe(primero?.id)
    // Y en la tabla completa tampoco quedó un duplicado escondido.
    expect(await db.asistencia.count()).toBe(1)
  })

  it('reescribe updated_at en cada mutación', async () => {
    // Solo Date: falsear los temporizadores completos cuelga a fake-indexeddb,
    // que los usa para resolver sus propias operaciones.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-18T08:00:00.000Z'))
    await repo.marcar(ALUMNO, HOY, 'ausente')
    const antes = (await repo.porDia(HOY))[0]?.updated_at

    vi.setSystemTime(new Date('2026-08-18T08:00:05.000Z'))
    await repo.marcar(ALUMNO, HOY, 'presente')
    const despues = (await repo.porDia(HOY))[0]?.updated_at

    expect(antes).toBe('2026-08-18T08:00:00.000Z')
    expect(despues).toBe('2026-08-18T08:00:05.000Z')
  })

  it('separa por día y por alumno', async () => {
    await repo.marcar(ALUMNO, HOY, 'ausente')
    await repo.marcar(ALUMNO, AYER, 'presente')
    await repo.marcar(OTRO, HOY, 'retardo')

    expect(await repo.porDia(HOY)).toHaveLength(2)
    expect((await repo.porDia(AYER))[0]?.estado).toBe('presente')
  })

  it('vuelve a marcar un registro borrado en vez de crear otro', async () => {
    await repo.marcar(ALUMNO, HOY, 'ausente')
    const id = (await repo.porDia(HOY))[0]?.id ?? ''
    await db.asistencia.update(id, { deleted_at: '2026-08-18T09:00:00.000Z' })
    expect(await repo.porDia(HOY)).toHaveLength(0)

    await repo.marcar(ALUMNO, HOY, 'presente')

    const registros = await repo.porDia(HOY)
    expect(registros).toHaveLength(1)
    expect(registros[0]?.id).toBe(id)
    expect(registros[0]?.deleted_at).toBeNull()
  })
})

describe('outbox', () => {
  it('cada mutación encola su cambio', async () => {
    await repo.marcar(ALUMNO, HOY, 'ausente')

    const pendientes = await db.outbox.toArray()
    expect(pendientes).toHaveLength(1)
    expect(pendientes[0]?.tabla).toBe('asistencia')
    expect(pendientes[0]?.op).toBe('upsert')
    expect(pendientes[0]?.registro_id).toBe((await repo.porDia(HOY))[0]?.id)
  })

  it('encola una vez por mutación, no una por registro', async () => {
    await repo.marcar(ALUMNO, HOY, 'ausente')
    await repo.marcar(ALUMNO, HOY, 'retardo')
    await repo.marcar(ALUMNO, HOY, 'presente')

    expect(await db.asistencia.count()).toBe(1)
    expect(await db.outbox.count()).toBe(3)
  })

  it('si falla el encolado, la escritura se revierte: misma transacción', async () => {
    const add = vi
      .spyOn(db.outbox, 'add')
      .mockRejectedValueOnce(new Error('outbox caído'))

    await expect(repo.marcar(ALUMNO, HOY, 'ausente')).rejects.toThrow()

    // Sin esto quedaría un registro sin cambio pendiente: invisible para la
    // sincronía y perdido en el respaldo.
    expect(await db.asistencia.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
    add.mockRestore()
  })
})

describe('porDia', () => {
  it('filtra los borrados', async () => {
    await repo.marcar(ALUMNO, HOY, 'ausente')
    await repo.marcar(OTRO, HOY, 'presente')
    const id = (await repo.porDia(HOY)).find((r) => r.alumno_id === ALUMNO)?.id ?? ''
    await db.asistencia.update(id, { deleted_at: '2026-08-18T09:00:00.000Z' })

    const registros = await repo.porDia(HOY)
    expect(registros).toHaveLength(1)
    expect(registros[0]?.alumno_id).toBe(OTRO)
  })

  it('un día sin registros devuelve lista vacía, no falla', async () => {
    expect(await repo.porDia('2026-01-01')).toEqual([])
  })
})

describe('observarDia', () => {
  it('emite el estado actual y vuelve a emitir cuando cambia', async () => {
    const emisiones: number[] = []
    const sub = repo.observarDia(HOY).subscribe((registros) => {
      emisiones.push(registros.length)
    })

    await vi.waitFor(() => expect(emisiones.length).toBeGreaterThan(0))
    expect(emisiones[0]).toBe(0)

    await repo.marcar(ALUMNO, HOY, 'ausente')
    await vi.waitFor(() => expect(emisiones.at(-1)).toBe(1))

    sub.unsubscribe()
  })

  it('deja de emitir después de unsubscribe', async () => {
    let emisiones = 0
    const sub = repo.observarDia(HOY).subscribe(() => {
      emisiones++
    })
    await vi.waitFor(() => expect(emisiones).toBeGreaterThan(0))

    sub.unsubscribe()
    const antes = emisiones
    await repo.marcar(ALUMNO, HOY, 'presente')
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(emisiones).toBe(antes)
  })
})
