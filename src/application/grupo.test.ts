// IndexedDB no existe en node: fake-indexeddb la provee en memoria.
import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { repos } from '@/data'
import { db } from '@/data/dexie/db'
import { GRUPO, usaEjemplo } from '@/data/seed'
import { GRUPO as EJEMPLO } from '@/data/seed/grupo.example'

import { sembrarGrupo } from './grupo'

beforeEach(async () => {
  await db.open()
  await db.alumnos.clear()
  await db.outbox.clear()
})

describe('la lista que se siembra', () => {
  it('en un clon limpio usa el ejemplo, no falla por el archivo real ausente', () => {
    // `grupo.ts` está ignorado por git. Si no existe, `import.meta.glob` no
    // resuelve nada y la app arranca con el ejemplo.
    expect(GRUPO.length).toBeGreaterThan(0)
    if (usaEjemplo) expect(GRUPO).toBe(EJEMPLO)
  })

  it('el ejemplo trae un grupo del tamaño de un salón real', () => {
    expect(EJEMPLO).toHaveLength(30)
  })

  it('los números de lista son únicos, 1-based y sin huecos', () => {
    const numeros = EJEMPLO.map((a) => a.numero_lista)
    expect(new Set(numeros).size).toBe(numeros.length)
    expect(numeros).toEqual(Array.from({ length: numeros.length }, (_, i) => i + 1))
  })

  it('viene en el orden de la lista oficial: alfabético por apellido', () => {
    const nombres = EJEMPLO.map((a) => a.nombre)
    const ordenados = [...nombres].sort((a, b) => a.localeCompare(b, 'es'))
    expect(nombres).toEqual(ordenados)
  })

  it('el nombre viene como "Apellidos, Nombres"', () => {
    for (const { nombre } of EJEMPLO) {
      expect(nombre, nombre).toContain(', ')
    }
  })
})

describe('sembrarGrupo', () => {
  it('carga el grupo completo, en el orden de la lista', async () => {
    await sembrarGrupo()

    const lista = await repos.alumnos.lista()
    expect(lista).toHaveLength(GRUPO.length)
    expect(lista.map((a) => a.numero_lista)).toEqual(GRUPO.map((a) => a.numero_lista))
    expect(lista[0]?.nombre).toBe(GRUPO[0]?.nombre)
  })

  it('genera UUID y updated_at para cada alumno', async () => {
    await sembrarGrupo()

    const lista = await repos.alumnos.lista()
    expect(new Set(lista.map((a) => a.id)).size).toBe(lista.length)
    for (const alumno of lista) {
      expect(alumno.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      )
      expect(alumno.updated_at).toMatch(/Z$/)
      expect(alumno.deleted_at).toBeNull()
    }
  })

  it('corre una sola vez: sembrar dos veces no duplica ni reescribe', async () => {
    await sembrarGrupo()
    const antes = await repos.alumnos.lista()
    const pendientes = await db.outbox.count()

    await sembrarGrupo()

    const despues = await repos.alumnos.lista()
    expect(despues).toHaveLength(antes.length)
    // Mismos ids: no se recrearon.
    expect(despues.map((a) => a.id)).toEqual(antes.map((a) => a.id))
    // Y la segunda pasada no encoló nada: nada cambió.
    expect(await db.outbox.count()).toBe(pendientes)
  })

  it('un nombre corregido en el archivo se actualiza conservando el id', async () => {
    await sembrarGrupo()
    const original = (await repos.alumnos.lista())[0]

    await repos.alumnos.sembrar([
      { ...GRUPO[0]!, nombre: 'Aguilar Mendoza, Bruno Alejandro' },
    ])

    const lista = await repos.alumnos.lista()
    const corregido = lista.find((a) => a.numero_lista === 1)
    // El id se conserva porque de él cuelgan su asistencia y sus calificaciones.
    expect(corregido?.id).toBe(original?.id)
    expect(corregido?.nombre).toBe('Aguilar Mendoza, Bruno Alejandro')
    expect(lista).toHaveLength(GRUPO.length)
  })

  it('no borra a un alumno que ya no está en el archivo', async () => {
    await sembrarGrupo()

    await repos.alumnos.sembrar([GRUPO[0]!])

    // Dar de baja es una decisión con datos de por medio, no un efecto
    // secundario de arrancar la app.
    expect(await repos.alumnos.lista()).toHaveLength(GRUPO.length)
  })

  it('revive a un alumno borrado si vuelve a estar en el archivo', async () => {
    await sembrarGrupo()
    const alumno = (await repos.alumnos.lista())[0]
    await db.alumnos.update(alumno?.id ?? '', { deleted_at: '2026-08-18T09:00:00.000Z' })
    expect(await repos.alumnos.lista()).toHaveLength(GRUPO.length - 1)

    // Sobre el puerto y no sobre `sembrarGrupo`: revivir es una propiedad de
    // `sembrar()`, y `sembrarGrupo` ya no lo llamaría con la base poblada.
    await repos.alumnos.sembrar(GRUPO)

    const lista = await repos.alumnos.lista()
    expect(lista).toHaveLength(GRUPO.length)
    expect(lista.find((a) => a.numero_lista === 1)?.id).toBe(alumno?.id)
  })

  it('no siembra si ya hay grupo: la lista importada no se pisa', async () => {
    // El caso que esto evita: la maestra carga su lista desde Ajustes, cierra la
    // app, y al abrirla vuelven los nombres del archivo de desarrollo. La semilla
    // fusiona por `numero_lista` igual que la importación, así que el estropicio
    // sería silencioso.
    await repos.alumnos.sembrar([
      { nombre: 'Importada Real, Alumna', numero_lista: 1, fecha_nacimiento: null },
    ])

    await sembrarGrupo()

    const lista = await repos.alumnos.lista()
    expect(lista).toHaveLength(1)
    expect(lista[0]?.nombre).toBe('Importada Real, Alumna')
  })

  it('vuelve a sembrar si la base quedó vacía', async () => {
    await sembrarGrupo()
    await db.alumnos.clear()

    await sembrarGrupo()

    expect(await repos.alumnos.lista()).toHaveLength(GRUPO.length)
  })
})
