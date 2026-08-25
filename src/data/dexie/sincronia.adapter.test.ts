// IndexedDB no existe en node: fake-indexeddb la provee en memoria.
import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { db, TABLAS_SINCRONIZABLES } from './db'
import { DexieSincroniaRepo } from './sincronia.adapter'

const repo = new DexieSincroniaRepo()

const base = { updated_at: '2026-09-01T00:00:00.000Z', deleted_at: null }

const alumno = (n: number) => ({
  id: `alumno-${n}`,
  ...base,
  nombre: `Apellido${n}, Nombre`,
  ciclo_id: null,
  numero_lista: n,
  fecha_nacimiento: null,
})

/** Encola un cambio como lo haría cualquier adaptador al escribir. */
async function encolar(tabla: string, registroId: string) {
  await db.outbox.add({
    tabla: tabla as never,
    registro_id: registroId,
    op: 'upsert',
    at: '2026-09-01T00:00:00.000Z',
  })
}

beforeEach(async () => {
  await db.open()
  for (const tabla of TABLAS_SINCRONIZABLES) await db.table(tabla).clear()
  await db.outbox.clear()
})

describe('tablasSincronizables', () => {
  it('las da el repositorio, que es quien conoce el esquema', () => {
    // Con dos listas, la que se olvida de crecer es la del caso de uso: una tabla
    // nueva dejaría de subir en silencio.
    expect([...repo.tablasSincronizables()]).toEqual([...TABLAS_SINCRONIZABLES])
  })
})

describe('cuantosPendientes', () => {
  it('cuenta la outbox', async () => {
    expect(await repo.cuantosPendientes()).toBe(0)

    await db.alumnos.put(alumno(1))
    await encolar('alumnos', 'alumno-1')

    expect(await repo.cuantosPendientes()).toBe(1)
  })
})

describe('lotePorSubir', () => {
  it('trae los cambios con sus filas, agrupadas por tabla', async () => {
    await db.alumnos.bulkPut([alumno(1), alumno(2)])
    await db.asistencia.put({
      id: 'asis-1',
      ...base,
      alumno_id: 'alumno-1',
      fecha: '2026-09-01',
      estado: 'ausente',
    })
    await encolar('alumnos', 'alumno-1')
    await encolar('alumnos', 'alumno-2')
    await encolar('asistencia', 'asis-1')

    const lote = await repo.lotePorSubir(10)

    expect(lote.cambios).toHaveLength(3)
    expect(lote.filas.alumnos).toHaveLength(2)
    expect(lote.filas.asistencia).toHaveLength(1)
  })

  it('no repite la fila aunque tenga varios cambios encolados', async () => {
    // La outbox encola un cambio por toque: ciclar el estado de un alumno cinco
    // veces son cinco cambios y una sola fila, que es la que está ahora.
    await db.alumnos.put(alumno(1))
    for (let i = 0; i < 5; i++) await encolar('alumnos', 'alumno-1')

    const lote = await repo.lotePorSubir(10)

    expect(lote.cambios).toHaveLength(5)
    expect(lote.filas.alumnos).toHaveLength(1)
  })

  it('respeta el tope y sale en orden de llegada', async () => {
    // Por lotes porque un trimestre entero son miles de filas, y una sola petición
    // gigante es la que se cae a mitad con la red del salón.
    await db.alumnos.bulkPut([alumno(1), alumno(2), alumno(3)])
    await encolar('alumnos', 'alumno-1')
    await encolar('alumnos', 'alumno-2')
    await encolar('alumnos', 'alumno-3')

    const lote = await repo.lotePorSubir(2)

    expect(lote.cambios.map((c) => c.registro_id)).toEqual(['alumno-1', 'alumno-2'])
  })

  it('un cambio cuya fila ya no existe viene igual, pero sin fila', async () => {
    // Si se quedara en la cola bloquearía para siempre todo lo que viene detrás.
    await encolar('alumnos', 'se-borro-de-verdad')

    const lote = await repo.lotePorSubir(10)

    expect(lote.cambios).toHaveLength(1)
    expect(lote.filas.alumnos).toBeUndefined()
  })

  it('la fila borrada suave sí se sube: lleva su deleted_at', async () => {
    // El borrado es suave, así que la baja viaja como una fila más y el servidor
    // no necesita una operación aparte.
    await db.alumnos.put({ ...alumno(1), deleted_at: '2026-09-02T00:00:00.000Z' })
    await encolar('alumnos', 'alumno-1')

    const lote = await repo.lotePorSubir(10)

    expect(lote.filas.alumnos).toHaveLength(1)
  })

  it('con la cola vacía no hay nada que subir', async () => {
    expect(await repo.lotePorSubir(10)).toEqual({ cambios: [], filas: {} })
  })
})

describe('confirmar', () => {
  it('saca de la outbox solo lo confirmado', async () => {
    await db.alumnos.bulkPut([alumno(1), alumno(2)])
    await encolar('alumnos', 'alumno-1')
    await encolar('alumnos', 'alumno-2')

    const lote = await repo.lotePorSubir(1)
    await repo.confirmar(lote.cambios.map((c) => c.seq))

    expect(await repo.cuantosPendientes()).toBe(1)
    expect((await repo.lotePorSubir(10)).cambios[0]?.registro_id).toBe('alumno-2')
  })

  it('confirmar nada no borra nada', async () => {
    await db.alumnos.put(alumno(1))
    await encolar('alumnos', 'alumno-1')

    await repo.confirmar([])

    expect(await repo.cuantosPendientes()).toBe(1)
  })
})
