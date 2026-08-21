// IndexedDB no existe en node: fake-indexeddb la provee en memoria.
import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { DexieBitacoraRepo } from './bitacora.adapter'
import { db } from './db'

const INICIO = '2026-08-24'
const FIN = '2026-12-18'
const ALUMNO = 'alumno-1'
const OTRO = 'alumno-2'

const repo = new DexieBitacoraRepo()

beforeEach(async () => {
  await db.open()
  await db.bitacora.clear()
  await db.outbox.clear()
})

describe('registrar', () => {
  it('escribe el reporte con id de UUID, updated_at y sin borrar', async () => {
    const id = await repo.registrar(ALUMNO, '2026-09-01', 'Se levantó de su lugar')

    const reportes = await repo.porRango(INICIO, FIN)
    expect(reportes).toHaveLength(1)
    const reporte = reportes[0]
    expect(reporte?.id).toBe(id)
    expect(reporte?.alumno_id).toBe(ALUMNO)
    expect(reporte?.texto).toBe('Se levantó de su lugar')
    expect(reporte?.deleted_at).toBeNull()
    expect(reporte?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    expect(reporte?.updated_at).toMatch(/Z$/)
  })

  it('dos reportes del mismo alumno el mismo día son dos reportes', async () => {
    // Es lo contrario de la asistencia: aquí no hay upsert que los junte, porque
    // dos cosas que pasaron son dos cosas que pasaron.
    await repo.registrar(ALUMNO, '2026-09-01', 'Primero')
    await repo.registrar(ALUMNO, '2026-09-01', 'Segundo')

    expect(await repo.porRango(INICIO, FIN)).toHaveLength(2)
  })

  it('encola el cambio en la outbox, en la misma transacción', async () => {
    const id = await repo.registrar(ALUMNO, '2026-09-01', 'Algo')

    const pendientes = await db.outbox.toArray()
    expect(pendientes).toHaveLength(1)
    expect(pendientes[0]?.tabla).toBe('bitacora')
    expect(pendientes[0]?.registro_id).toBe(id)
    expect(pendientes[0]?.op).toBe('upsert')
  })
})

describe('porRango', () => {
  it('solo trae los reportes cuya fecha cae en el rango', async () => {
    // La atribución al trimestre es por fecha y se deriva al leer: un reporte de
    // las vacaciones no pertenece a ningún trimestre y no aparece en ninguno.
    await repo.registrar(ALUMNO, '2026-08-23', 'Un día antes de que abra')
    await repo.registrar(ALUMNO, '2026-08-24', 'El primer día')
    await repo.registrar(ALUMNO, '2026-12-18', 'El último día')
    await repo.registrar(ALUMNO, '2026-12-19', 'Ya en vacaciones')

    const textos = (await repo.porRango(INICIO, FIN)).map((r) => r.texto)
    expect(textos).toHaveLength(2)
    expect(textos).toContain('El primer día')
    expect(textos).toContain('El último día')
  })

  it('ordena más reciente primero', async () => {
    await repo.registrar(ALUMNO, '2026-09-01', 'Viejo')
    await repo.registrar(OTRO, '2026-10-15', 'Nuevo')

    expect((await repo.porRango(INICIO, FIN)).map((r) => r.texto)).toEqual(['Nuevo', 'Viejo'])
  })

  it('dentro del mismo día, el último escrito va arriba', async () => {
    // La fecha no desempata: `updated_at` sí. Sin esto, el historial de un día
    // saldría en un orden arbitrario.
    const primero = await repo.registrar(ALUMNO, '2026-09-01', 'Primero')
    await db.bitacora.update(primero, { updated_at: '2026-09-01T14:00:00.000Z' })
    const segundo = await repo.registrar(ALUMNO, '2026-09-01', 'Segundo')
    await db.bitacora.update(segundo, { updated_at: '2026-09-01T16:00:00.000Z' })

    expect((await repo.porRango(INICIO, FIN)).map((r) => r.texto)).toEqual([
      'Segundo',
      'Primero',
    ])
  })

  it('no trae los borrados', async () => {
    const id = await repo.registrar(ALUMNO, '2026-09-01', 'Se va')
    await repo.quitar(id)

    expect(await repo.porRango(INICIO, FIN)).toHaveLength(0)
  })
})

describe('quitar', () => {
  it('borra suave: el registro sigue en la tabla con deleted_at', async () => {
    const id = await repo.registrar(ALUMNO, '2026-09-01', 'Se va')
    await repo.quitar(id)

    const fila = await db.bitacora.get(id)
    expect(fila).toBeDefined()
    expect(fila?.deleted_at).not.toBeNull()
    expect(fila?.updated_at).toBe(fila?.deleted_at)
  })

  it('encola la baja para que la sincronía la propague', async () => {
    const id = await repo.registrar(ALUMNO, '2026-09-01', 'Se va')
    await db.outbox.clear()
    await repo.quitar(id)

    const pendientes = await db.outbox.toArray()
    expect(pendientes).toHaveLength(1)
    expect(pendientes[0]?.op).toBe('delete')
    expect(pendientes[0]?.registro_id).toBe(id)
  })

  it('quitar un reporte que no existe no encola nada', async () => {
    await repo.quitar('no-existe')
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('observarRango', () => {
  it('emite de nuevo al registrar un reporte', async () => {
    const emisiones: number[] = []
    const sub = repo.observarRango(INICIO, FIN).subscribe((reportes) => {
      emisiones.push(reportes.length)
    })

    await new Promise((r) => setTimeout(r, 10))
    await repo.registrar(ALUMNO, '2026-09-01', 'Algo')
    await new Promise((r) => setTimeout(r, 30))
    sub.unsubscribe()

    // La primera emisión es el estado inicial; la última, con el reporte nuevo.
    expect(emisiones[0]).toBe(0)
    expect(emisiones.at(-1)).toBe(1)
  })
})
