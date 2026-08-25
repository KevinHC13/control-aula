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
  ciclo_id: null,
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

/**
 * El grupo cuelga del ciclo abierto (D-025). Es lo que permite guardar varias
 * generaciones sin que la pantalla diaria las mezcle.
 */
describe('el grupo se acota al ciclo abierto', () => {
  const ciclo = (id: string, estado: 'abierto' | 'cerrado', updated_at: string) => ({
    id,
    nombre: id,
    estado,
    updated_at,
    deleted_at: null,
  })

  beforeEach(async () => {
    await db.ciclos.clear()
    await db.outbox.clear()
  })

  it('sin ciclo configurado devuelve los alumnos que no tienen ninguno', async () => {
    // El primer día: se pasa lista antes de haber configurado nada.
    await db.alumnos.bulkPut([alumno(1, 'Aguilar, Bruno'), alumno(2, 'Barrera, Diego')])

    expect(await repo.lista()).toHaveLength(2)
  })

  it('con un ciclo abierto devuelve solo a los suyos', async () => {
    await db.ciclos.put(ciclo('ciclo-a', 'abierto', '2026-08-01T00:00:00.000Z'))
    await db.alumnos.bulkPut([
      { ...alumno(1, 'Del ciclo abierto'), ciclo_id: 'ciclo-a' },
      { ...alumno(2, 'Del ciclo pasado'), ciclo_id: 'ciclo-viejo' },
      alumno(3, 'Sin ciclo'),
    ])

    const lista = await repo.lista()
    expect(lista).toHaveLength(1)
    expect(lista[0]?.nombre).toBe('Del ciclo abierto')
  })

  it('los alumnos del ciclo cerrado no aparecen, pero siguen en la base', async () => {
    // No se borran: consultarlos es justo lo que hace falta para una aclaración
    // de boleta del año pasado.
    await db.ciclos.bulkPut([
      ciclo('ciclo-viejo', 'cerrado', '2026-07-01T00:00:00.000Z'),
      ciclo('ciclo-nuevo', 'abierto', '2026-08-01T00:00:00.000Z'),
    ])
    await db.alumnos.bulkPut([
      { ...alumno(1, 'Del año pasado'), ciclo_id: 'ciclo-viejo' },
      { ...alumno(2, 'De este año'), ciclo_id: 'ciclo-nuevo' },
    ])

    expect((await repo.lista()).map((a) => a.nombre)).toEqual(['De este año'])
    expect(await db.alumnos.count()).toBe(2)
  })

  it('sembrar estampa el ciclo abierto', async () => {
    await db.ciclos.put(ciclo('ciclo-a', 'abierto', '2026-08-01T00:00:00.000Z'))

    await repo.sembrar([
      { numero_lista: 1, nombre: 'Aguilar, Bruno', fecha_nacimiento: null },
    ])

    expect((await repo.lista())[0]?.ciclo_id).toBe('ciclo-a')
  })

  it('el número de lista identifica dentro del ciclo, no entre ciclos', async () => {
    // La corrupción que esto evita: sin acotar, el alumno 1 del ciclo nuevo
    // reutilizaría el `id` del alumno 1 del anterior, y con él se llevaría su
    // asistencia y sus calificaciones.
    await db.alumnos.put({ ...alumno(1, 'Del año pasado'), ciclo_id: 'ciclo-viejo' })
    await db.ciclos.put(ciclo('ciclo-nuevo', 'abierto', '2026-08-01T00:00:00.000Z'))

    await repo.sembrar([
      { numero_lista: 1, nombre: 'De este año', fecha_nacimiento: null },
    ])

    const nuevo = (await repo.lista())[0]
    expect(nuevo?.nombre).toBe('De este año')
    expect(nuevo?.id).not.toBe('alumno-1')
    // Y el del año pasado sigue intacto, con su nombre y su id.
    expect((await db.alumnos.get('alumno-1'))?.nombre).toBe('Del año pasado')
  })
})

/**
 * Alta, corrección y baja uno por uno (D-026). La lista completa sigue entrando
 * por `sembrar()`; esto es lo que aquella no puede cubrir.
 */
describe('administrar alumnos', () => {
  beforeEach(async () => {
    await db.ciclos.clear()
    await db.outbox.clear()
  })

  const DATOS = { nombre: 'Llegó Después, Ana', numero_lista: 31, fecha_nacimiento: null }

  it('agregar da de alta con id, updated_at y sin baja', async () => {
    await repo.agregar(DATOS)

    const lista = await repo.lista()
    expect(lista).toHaveLength(1)
    expect(lista[0]?.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(lista[0]?.updated_at).toMatch(/Z$/)
    expect(lista[0]?.deleted_at).toBeNull()
  })

  it('agregar encola en la outbox', async () => {
    await repo.agregar(DATOS)

    const pendientes = await db.outbox.toArray()
    expect(pendientes.filter((c) => c.tabla === 'alumnos')).toHaveLength(1)
  })

  it('agregar estampa el ciclo abierto', async () => {
    await db.ciclos.put({
      id: 'ciclo-a',
      nombre: 'ciclo-a',
      estado: 'abierto',
      updated_at: '2026-08-01T00:00:00.000Z',
      deleted_at: null,
    })

    await repo.agregar(DATOS)

    expect((await repo.lista())[0]?.ciclo_id).toBe('ciclo-a')
  })

  it('agregar se niega si el número ya está tomado', async () => {
    await repo.agregar(DATOS)

    await expect(repo.agregar({ ...DATOS, nombre: 'Otro, Otro' })).rejects.toThrow(
      /ya está ocupado/,
    )
    expect(await repo.lista()).toHaveLength(1)
  })

  it('agregar se niega aunque el que ocupa el número esté dado de baja', async () => {
    // `sembrar()` fusiona por número de lista sobre todos los del ciclo,
    // borrados incluidos: dos con el mismo número harían que recargar la lista
    // escribiera sobre cualquiera de los dos.
    await repo.agregar(DATOS)
    const id = (await repo.lista())[0]!.id
    await repo.darDeBaja(id)

    await expect(repo.agregar({ ...DATOS, nombre: 'Otro, Otro' })).rejects.toThrow(
      /ya está ocupado/,
    )
  })

  it('editar corrige conservando el id, que es de donde cuelga su historia', async () => {
    await repo.agregar(DATOS)
    const original = (await repo.lista())[0]!

    await repo.editar(original.id, { ...DATOS, nombre: 'Corregido, Nombre' })

    const lista = await repo.lista()
    expect(lista[0]?.id).toBe(original.id)
    expect(lista[0]?.nombre).toBe('Corregido, Nombre')
  })

  it('editar deja cambiar el número al que ya tenía', async () => {
    // Su propio número no puede contar como repetido.
    await repo.agregar(DATOS)
    const id = (await repo.lista())[0]!.id

    await expect(
      repo.editar(id, { ...DATOS, nombre: 'Mismo número, otro nombre' }),
    ).resolves.toBeUndefined()
  })

  it('editar se niega ante el número de otro', async () => {
    await repo.agregar(DATOS)
    await repo.agregar({ ...DATOS, numero_lista: 32, nombre: 'Otra, Otra' })
    const segundo = (await repo.lista())[1]!

    await expect(repo.editar(segundo.id, { ...DATOS, numero_lista: 31 })).rejects.toThrow(
      /ya está ocupado/,
    )
  })

  it('editar no muda de ciclo', async () => {
    await db.alumnos.put({
      id: 'a-1',
      ciclo_id: 'ciclo-viejo',
      nombre: 'Del año pasado',
      numero_lista: 1,
      fecha_nacimiento: null,
      updated_at: '2025-08-25T00:00:00.000Z',
      deleted_at: null,
    })

    await repo.editar('a-1', {
      nombre: 'Corregido',
      numero_lista: 1,
      fecha_nacimiento: null,
    })

    expect((await db.alumnos.get('a-1'))?.ciclo_id).toBe('ciclo-viejo')
  })

  it('dar de baja lo saca de la lista sin borrar la fila', async () => {
    await repo.agregar(DATOS)
    const id = (await repo.lista())[0]!.id

    await repo.darDeBaja(id)

    expect(await repo.lista()).toHaveLength(0)
    expect(await db.alumnos.count()).toBe(1)
    expect((await db.alumnos.get(id))?.deleted_at).toMatch(/Z$/)
  })

  it('la baja se encola como upsert, no como delete', async () => {
    // El borrado es suave: lo que viaja es la fila con su `deleted_at` puesto.
    // Un delete en el servidor perdería la baja al restaurar.
    await repo.agregar(DATOS)
    const id = (await repo.lista())[0]!.id
    await db.outbox.clear()

    await repo.darDeBaja(id)

    const pendientes = await db.outbox.toArray()
    expect(pendientes).toHaveLength(1)
    expect(pendientes[0]?.op).toBe('upsert')
    expect(pendientes[0]?.registro_id).toBe(id)
  })

  it('reactivar deshace la baja', async () => {
    await repo.agregar(DATOS)
    const id = (await repo.lista())[0]!.id
    await repo.darDeBaja(id)

    await repo.reactivar(id)

    expect(await repo.lista()).toHaveLength(1)
    expect((await db.alumnos.get(id))?.deleted_at).toBeNull()
  })

  it('conBajas trae a los dos, ordenados por número', async () => {
    await repo.agregar({ ...DATOS, numero_lista: 2, nombre: 'Sigue, Aquí' })
    await repo.agregar({ ...DATOS, numero_lista: 1, nombre: 'Se, Fue' })
    const seFue = (await repo.lista()).find((a) => a.numero_lista === 1)!
    await repo.darDeBaja(seFue.id)

    const todos = await repo.conBajas()
    expect(todos.map((a) => a.numero_lista)).toEqual([1, 2])
    expect(await repo.lista()).toHaveLength(1)
  })

  it('editar y dar de baja se niegan ante un alumno que no existe', async () => {
    await expect(repo.editar('no-existe', DATOS)).rejects.toThrow(/No existe el alumno/)
    await expect(repo.darDeBaja('no-existe')).rejects.toThrow(/No existe el alumno/)
  })
})
