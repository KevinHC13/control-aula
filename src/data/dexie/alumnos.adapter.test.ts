// IndexedDB no existe en node: fake-indexeddb la provee en memoria.
import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Alumno, DatosAlumno } from '@/domain/entities'

import { DexieAlumnosRepo } from './alumnos.adapter'
import { db } from './db'

const repo = new DexieAlumnosRepo()

// Nombres inventados: en el repositorio no va un solo nombre real del salón.
const alumno = (numero_lista: number, nombre: string, deleted_at: string | null = null): Alumno => ({
  id: `alumno-${numero_lista}`,
  nombre,
  numero_lista,
  fecha_nacimiento: null,
  updated_at: '2026-08-18T08:00:00.000Z',
  deleted_at,
})

beforeEach(async () => {
  await db.open()
  await db.alumnos.clear()
})

describe('lista', () => {
  it('devuelve el grupo en el orden de la lista oficial, no en el de inserción', async () => {
    await db.alumnos.bulkPut([
      alumno(3, 'Cruz, Regina'),
      alumno(1, 'Aguilar, Bruno'),
      alumno(2, 'Bautista, Ana'),
    ])

    expect((await repo.lista()).map((a) => a.numero_lista)).toEqual([1, 2, 3])
  })

  it('filtra los borrados', async () => {
    await db.alumnos.bulkPut([
      alumno(1, 'Aguilar, Bruno'),
      alumno(2, 'Bautista, Ana', '2026-08-18T09:00:00.000Z'),
    ])

    const lista = await repo.lista()
    expect(lista).toHaveLength(1)
    expect(lista[0]?.numero_lista).toBe(1)
  })

  it('un grupo vacío devuelve lista vacía, no falla', async () => {
    expect(await repo.lista()).toEqual([])
  })
})

describe('observarLista', () => {
  it('emite el grupo y vuelve a emitir cuando cambia', async () => {
    const emisiones: number[] = []
    const sub = repo.observarLista().subscribe((alumnos) => {
      emisiones.push(alumnos.length)
    })

    await vi.waitFor(() => expect(emisiones.length).toBeGreaterThan(0))
    expect(emisiones[0]).toBe(0)

    await db.alumnos.put(alumno(1, 'Aguilar, Bruno'))
    await vi.waitFor(() => expect(emisiones.at(-1)).toBe(1))

    sub.unsubscribe()
  })
})

/**
 * Estos casos vivían en `application/grupo.test.ts`, colgados de la semilla que
 * se retiró. Prueban el puerto, no la semilla: `sembrar()` sigue siendo la vía
 * por la que entra la lista, ahora desde la carga asistida por IA.
 */
describe('sembrar', () => {
  const LISTA: DatosAlumno[] = [
    { numero_lista: 1, nombre: 'Aguilar Mendoza, Bruno', fecha_nacimiento: '2017-03-14' },
    { numero_lista: 2, nombre: 'Barrera Solís, Diego', fecha_nacimiento: null },
    { numero_lista: 3, nombre: 'Cruz Herrera, Regina', fecha_nacimiento: '2017-09-23' },
  ]

  beforeEach(async () => {
    await db.outbox.clear()
  })

  it('carga el grupo completo, en el orden de la lista', async () => {
    await repo.sembrar(LISTA)

    const lista = await repo.lista()
    expect(lista.map((a) => a.numero_lista)).toEqual([1, 2, 3])
    expect(lista[0]?.nombre).toBe('Aguilar Mendoza, Bruno')
  })

  it('genera UUID y updated_at para cada alumno', async () => {
    await repo.sembrar(LISTA)

    const lista = await repo.lista()
    expect(new Set(lista.map((a) => a.id)).size).toBe(lista.length)
    for (const alumno of lista) {
      expect(alumno.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      )
      expect(alumno.updated_at).toMatch(/Z$/)
      expect(alumno.deleted_at).toBeNull()
    }
  })

  it('es idempotente: sembrar dos veces no duplica ni reescribe', async () => {
    await repo.sembrar(LISTA)
    const antes = await repo.lista()
    const pendientes = await db.outbox.count()

    await repo.sembrar(LISTA)

    const despues = await repo.lista()
    expect(despues).toHaveLength(antes.length)
    // Mismos ids: no se recrearon.
    expect(despues.map((a) => a.id)).toEqual(antes.map((a) => a.id))
    // Y la segunda pasada no encoló nada: nada cambió.
    expect(await db.outbox.count()).toBe(pendientes)
  })

  it('un nombre corregido se actualiza conservando el id', async () => {
    await repo.sembrar(LISTA)
    const original = (await repo.lista())[0]

    await repo.sembrar([{ ...LISTA[0]!, nombre: 'Aguilar Mendoza, Bruno Alejandro' }])

    const lista = await repo.lista()
    const corregido = lista.find((a) => a.numero_lista === 1)
    // El id se conserva porque de él cuelgan su asistencia y sus calificaciones.
    expect(corregido?.id).toBe(original?.id)
    expect(corregido?.nombre).toBe('Aguilar Mendoza, Bruno Alejandro')
    expect(lista).toHaveLength(LISTA.length)
  })

  it('no borra a un alumno que ya no está en la lista nueva', async () => {
    await repo.sembrar(LISTA)

    await repo.sembrar([LISTA[0]!])

    // Dar de baja es una decisión con datos de por medio, no un efecto
    // secundario de volver a cargar la lista.
    expect(await repo.lista()).toHaveLength(LISTA.length)
  })

  it('revive a un alumno borrado si vuelve a estar en la lista', async () => {
    await repo.sembrar(LISTA)
    const primero = (await repo.lista())[0]
    await db.alumnos.update(primero?.id ?? '', { deleted_at: '2026-08-18T09:00:00.000Z' })
    expect(await repo.lista()).toHaveLength(LISTA.length - 1)

    await repo.sembrar(LISTA)

    const lista = await repo.lista()
    expect(lista).toHaveLength(LISTA.length)
    expect(lista.find((a) => a.numero_lista === 1)?.id).toBe(primero?.id)
  })
})
