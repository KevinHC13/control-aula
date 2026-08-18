// IndexedDB no existe en node: fake-indexeddb la provee en memoria.
import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Alumno } from '@/domain/entities'

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
