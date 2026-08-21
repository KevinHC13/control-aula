// IndexedDB no existe en node: fake-indexeddb la provee en memoria.
import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { db, TABLAS_SINCRONIZABLES, VERSION_ESQUEMA } from './db'
import { DexieRespaldoRepo } from './respaldo.adapter'

const repo = new DexieRespaldoRepo()

const alumno = (n: number) => ({
  id: `alumno-${n}`,
  nombre: `Apellido${n}, Nombre`,
  numero_lista: n,
  fecha_nacimiento: null,
  updated_at: '2026-08-24T00:00:00.000Z',
  deleted_at: null,
})

beforeEach(async () => {
  await db.open()
  for (const nombre of TABLAS_SINCRONIZABLES) await db.table(nombre).clear()
  await db.outbox.clear()
})

describe('volcar', () => {
  it('trae una entrada por cada tabla sincronizable, y solo esas', async () => {
    const volcado = await repo.volcar()

    expect(Object.keys(volcado).sort()).toEqual([...TABLAS_SINCRONIZABLES].sort())
    // La outbox no entra: es local, efímera y no es contenido del salón.
    expect(volcado).not.toHaveProperty('outbox')
  })

  it('incluye los registros borrados', async () => {
    // El borrado es suave. Un respaldo que se comiera los `deleted_at`
    // resucitaría al restaurar a un alumno dado de baja.
    await db.alumnos.bulkPut([
      alumno(1),
      { ...alumno(2), deleted_at: '2026-09-01T00:00:00.000Z' },
    ])

    const volcado = await repo.volcar()
    expect(volcado.alumnos).toHaveLength(2)
  })

  it('la versión del esquema es la del archivo db.ts, no un número aparte', () => {
    expect(repo.versionDelEsquema()).toBe(VERSION_ESQUEMA)
  })
})

describe('restaurar', () => {
  it('reconstruye una base vacía con los ids del archivo', async () => {
    // Los ids son UUID del cliente y viajan en el archivo: es lo que permite que
    // la asistencia siga colgando del alumno correcto después de restaurar.
    const conteo = await repo.restaurar({
      alumnos: [alumno(1), alumno(2)],
      asistencia: [
        {
          id: 'asistencia-1',
          alumno_id: 'alumno-1',
          fecha: '2026-09-01',
          estado: 'ausente',
          updated_at: '2026-09-01T14:00:00.000Z',
          deleted_at: null,
        },
      ],
    })

    expect(conteo).toEqual({ alumnos: 2, asistencia: 1 })
    expect(await db.alumnos.count()).toBe(2)
    expect((await db.alumnos.get('alumno-1'))?.numero_lista).toBe(1)
    expect((await db.asistencia.get('asistencia-1'))?.estado).toBe('ausente')
  })

  it('restaurar dos veces el mismo archivo no duplica registros', async () => {
    const archivo = { alumnos: [alumno(1), alumno(2)] }

    await repo.restaurar(archivo)
    await repo.restaurar(archivo)

    expect(await db.alumnos.count()).toBe(2)
  })

  it('no borra lo que el archivo no trae', async () => {
    // Restaurar es recuperar, no reemplazar el dispositivo.
    await db.alumnos.put(alumno(3))
    await repo.restaurar({ alumnos: [alumno(1)] })

    expect(await db.alumnos.count()).toBe(2)
  })

  it('una tabla desconocida se rechaza sin escribir nada', async () => {
    await expect(
      repo.restaurar({ alumnos: [alumno(1)], calificaciones: [{ id: 'x' }] }),
    ).rejects.toThrow(/calificaciones/)

    // Se valida antes de abrir la transacción: el archivo malo no deja mitades.
    expect(await db.alumnos.count()).toBe(0)
  })

  it('no encola nada en la outbox', async () => {
    // Restaurar no es una mutación del salón. Qué hace la sincronía con un
    // dispositivo restaurado lo decide C16.
    await repo.restaurar({ alumnos: [alumno(1)] })
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('la vuelta completa', () => {
  it('volcar y restaurar en una base limpia deja la misma base', async () => {
    await db.alumnos.bulkPut([alumno(1), alumno(2), alumno(3)])
    await db.bitacora.put({
      id: 'reporte-1',
      alumno_id: 'alumno-2',
      fecha: '2026-09-10',
      texto: 'Se salió del salón sin permiso',
      updated_at: '2026-09-10T18:00:00.000Z',
      deleted_at: null,
    })

    const volcado = await repo.volcar()
    for (const nombre of TABLAS_SINCRONIZABLES) await db.table(nombre).clear()
    expect(await db.alumnos.count()).toBe(0)

    await repo.restaurar(volcado)

    expect(await db.alumnos.count()).toBe(3)
    expect((await db.bitacora.get('reporte-1'))?.texto).toBe(
      'Se salió del salón sin permiso',
    )
  })
})
