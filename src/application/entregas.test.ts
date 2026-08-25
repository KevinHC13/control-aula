// IndexedDB no existe en node: fake-indexeddb la provee en memoria.
import 'fake-indexeddb/auto'

import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { repos } from '@/data'
import { db } from '@/data/dexie/db'
import type { ActividadConEstado } from '@/data/ports/evaluacion'
import type { Alumno, Entrega, Trimestre } from '@/domain/entities'

import {
  abrirCaptura,
  alternarEntrega,
  contarEntregadas,
  filasDeEntrega,
} from './entregas'

const ALUMNOS = 30

const trimestre: Trimestre = {
  id: 'trimestre-1',
  updated_at: '2026-08-24T00:00:00.000Z',
  deleted_at: null,
  ciclo_id: 'ciclo-1',
  numero: 1,
  inicio: '2026-08-24',
  fin: '2026-11-27',
  estado: 'abierto',
  cerrado_en: null,
}

const actividad: ActividadConEstado = {
  actividad: {
    id: 'actividad-1',
    updated_at: '2026-09-01T00:00:00.000Z',
    deleted_at: null,
    criterio_trimestre_id: 'ct-1',
    nombre: 'Cuento de terror',
    campo: 'lenguajes',
    ejes: [],
    fecha: '2026-09-01',
    rubrica_id: null,
  },
  registros: 0,
}

const alumno = (i: number): Alumno => ({
  id: `alumno-${i}`,
  updated_at: '2026-08-17T00:00:00.000Z',
  deleted_at: null,
  nombre: `Apellido${String(i).padStart(2, '0')}, Nombre`,
  ciclo_id: null,
  numero_lista: i,
  fecha_nacimiento: null,
})

const entrega = (alumnoId: string, entregada: boolean): Entrega => ({
  id: `entrega-${alumnoId}`,
  updated_at: '2026-09-01T00:00:00.000Z',
  deleted_at: null,
  actividad_id: actividad.actividad.id,
  alumno_id: alumnoId,
  entregada,
})

beforeEach(async () => {
  await db.open()
  await db.alumnos.clear()
  await db.entregas.clear()
  await db.outbox.clear()
  await db.alumnos.bulkAdd(Array.from({ length: ALUMNOS }, (_, i) => alumno(i + 1)))
})

afterAll(() => {
  db.close()
})

describe('filasDeEntrega', () => {
  it('sin registros, todos aparecen como entregada', () => {
    // El estado más probable es el estado por defecto: casi todos entregan.
    const filas = filasDeEntrega([alumno(1), alumno(2)], [])
    expect(filas.every((f) => f.entregada)).toBe(true)
    expect(filas.every((f) => !f.registrado)).toBe(true)
  })

  it('respeta lo capturado', () => {
    const filas = filasDeEntrega(
      [alumno(1), alumno(2)],
      [entrega('alumno-1', false)],
    )
    expect(filas[0]?.entregada).toBe(false)
    expect(filas[0]?.registrado).toBe(true)
    expect(filas[1]?.entregada).toBe(true)
    expect(filas[1]?.registrado).toBe(false)
  })

  it('conserva el orden del grupo, no el de los registros', () => {
    const filas = filasDeEntrega(
      [alumno(1), alumno(2), alumno(3)],
      [entrega('alumno-3', false), entrega('alumno-1', true)],
    )
    expect(filas.map((f) => f.alumno.numero_lista)).toEqual([1, 2, 3])
  })

  it('sin grupo devuelve la lista vacía, no falla', () => {
    expect(filasDeEntrega([], [entrega('alumno-1', false)])).toEqual([])
  })

  it('es pura: no lee la base', async () => {
    const antes = await db.entregas.count()
    filasDeEntrega([alumno(1)], [])
    expect(await db.entregas.count()).toBe(antes)
  })
})

describe('contarEntregadas', () => {
  it('cuenta sobre el total del grupo', () => {
    const filas = filasDeEntrega(
      [alumno(1), alumno(2), alumno(3)],
      [entrega('alumno-2', false)],
    )
    expect(contarEntregadas(filas)).toEqual({ entregadas: 2, total: 3 })
  })

  it('sin filas no divide entre cero', () => {
    expect(contarEntregadas([])).toEqual({ entregadas: 0, total: 0 })
  })
})

describe('abrirCaptura', () => {
  it('escribe los 30 registros de golpe, todos en entregada', async () => {
    await abrirCaptura(trimestre, actividad)

    const entregas = await repos.evaluacion.entregasDeActividad(actividad.actividad.id)
    expect(entregas).toHaveLength(ALUMNOS)
    expect(entregas.every((e) => e.entregada)).toBe(true)
  })

  it('es idempotente: abrirla dos veces no duplica', async () => {
    await abrirCaptura(trimestre, actividad)
    await abrirCaptura(trimestre, actividad)

    expect(await repos.evaluacion.entregasDeActividad(actividad.actividad.id)).toHaveLength(
      ALUMNOS,
    )
  })

  it('no revierte lo ya capturado', async () => {
    await abrirCaptura(trimestre, actividad)
    await alternarEntrega(
      trimestre,
      actividad,
      { alumno: alumno(1), entregada: true, registrado: true },
    )

    await abrirCaptura(trimestre, actividad)

    const entregas = await repos.evaluacion.entregasDeActividad(actividad.actividad.id)
    expect(entregas.find((e) => e.alumno_id === 'alumno-1')?.entregada).toBe(false)
    expect(entregas.filter((e) => !e.entregada)).toHaveLength(1)
  })

  it('con un solo alumno nuevo en la lista, completa sin tocar el resto', async () => {
    await abrirCaptura(trimestre, actividad)
    const antes = await repos.evaluacion.entregasDeActividad(actividad.actividad.id)
    await db.alumnos.add(alumno(31))

    await abrirCaptura(trimestre, actividad)

    const despues = await repos.evaluacion.entregasDeActividad(actividad.actividad.id)
    expect(despues).toHaveLength(ALUMNOS + 1)
    // Los que ya estaban conservan su id: no se recrearon.
    const idsAntes = new Set(antes.map((e) => e.id))
    expect(despues.filter((e) => idsAntes.has(e.id))).toHaveLength(ALUMNOS)
  })

  it('todo en una transacción, no 30: un solo lote en la outbox', async () => {
    await abrirCaptura(trimestre, actividad)
    // 30 filas encoladas, pero con el mismo instante: salieron de una sola
    // escritura.
    const pendientes = await db.outbox.toArray()
    expect(pendientes).toHaveLength(ALUMNOS)
    expect(new Set(pendientes.map((c) => c.at)).size).toBe(1)
  })

  it('en un trimestre cerrado no escribe nada, y no falla', async () => {
    // Abrir para consultar una actividad de un trimestre cerrado es legítimo.
    await abrirCaptura({ ...trimestre, estado: 'cerrado' }, actividad)
    expect(await repos.evaluacion.entregasDeActividad(actividad.actividad.id)).toEqual([])
  })
})

describe('alternarEntrega', () => {
  it('un toque marca no entregada, y devuelve cómo quedó', async () => {
    await abrirCaptura(trimestre, actividad)
    const fila = { alumno: alumno(1), entregada: true, registrado: true }

    expect(await alternarEntrega(trimestre, actividad, fila)).toBe(false)

    const entregas = await repos.evaluacion.entregasDeActividad(actividad.actividad.id)
    expect(entregas.find((e) => e.alumno_id === 'alumno-1')?.entregada).toBe(false)
  })

  it('otro toque la devuelve a entregada', async () => {
    await abrirCaptura(trimestre, actividad)
    await alternarEntrega(trimestre, actividad, {
      alumno: alumno(1),
      entregada: true,
      registrado: true,
    })

    expect(
      await alternarEntrega(trimestre, actividad, {
        alumno: alumno(1),
        entregada: false,
        registrado: true,
      }),
    ).toBe(true)
  })

  it('marcar dos veces al mismo alumno actualiza su registro, no crea otro', async () => {
    await abrirCaptura(trimestre, actividad)
    const antes = await repos.evaluacion.entregasDeActividad(actividad.actividad.id)
    const suyo = antes.find((e) => e.alumno_id === 'alumno-1')!

    await alternarEntrega(trimestre, actividad, {
      alumno: alumno(1),
      entregada: true,
      registrado: true,
    })

    const despues = await repos.evaluacion.entregasDeActividad(actividad.actividad.id)
    expect(despues).toHaveLength(ALUMNOS)
    expect(despues.find((e) => e.alumno_id === 'alumno-1')?.id).toBe(suyo.id)
  })

  it('no toca a los demás alumnos', async () => {
    await abrirCaptura(trimestre, actividad)
    await alternarEntrega(trimestre, actividad, {
      alumno: alumno(5),
      entregada: true,
      registrado: true,
    })

    const entregas = await repos.evaluacion.entregasDeActividad(actividad.actividad.id)
    expect(entregas.filter((e) => !e.entregada)).toHaveLength(1)
  })

  it('funciona sin haber abierto la captura: crea el registro que falta', async () => {
    // La pantalla materializa al abrir, pero el caso de uso no depende de que eso
    // haya terminado.
    await alternarEntrega(trimestre, actividad, {
      alumno: alumno(1),
      entregada: true,
      registrado: false,
    })

    const entregas = await repos.evaluacion.entregasDeActividad(actividad.actividad.id)
    expect(entregas).toHaveLength(1)
    expect(entregas[0]?.entregada).toBe(false)
  })

  it('encola el cambio', async () => {
    await abrirCaptura(trimestre, actividad)
    await db.outbox.clear()

    await alternarEntrega(trimestre, actividad, {
      alumno: alumno(1),
      entregada: true,
      registrado: true,
    })

    const pendientes = await db.outbox.toArray()
    expect(pendientes).toHaveLength(1)
    expect(pendientes[0]?.tabla).toBe('entregas')
    expect(pendientes[0]?.op).toBe('upsert')
  })

  it('un trimestre cerrado no admite capturar', async () => {
    await abrirCaptura(trimestre, actividad)

    await expect(
      alternarEntrega({ ...trimestre, estado: 'cerrado' }, actividad, {
        alumno: alumno(1),
        entregada: true,
        registrado: true,
      }),
    ).rejects.toThrow(/cerrado/)

    const entregas = await repos.evaluacion.entregasDeActividad(actividad.actividad.id)
    expect(entregas.every((e) => e.entregada)).toBe(true)
  })
})

describe('captura completa de un grupo', () => {
  it('30 alumnos con 4 no entregadas quedan en 26 / 30', async () => {
    // El camino real: abrir y tocar solo a los que no entregaron.
    await abrirCaptura(trimestre, actividad)

    for (const i of [3, 11, 17, 28]) {
      await alternarEntrega(trimestre, actividad, {
        alumno: alumno(i),
        entregada: true,
        registrado: true,
      })
    }

    const entregas = await repos.evaluacion.entregasDeActividad(actividad.actividad.id)
    const filas = filasDeEntrega(await repos.alumnos.lista(), entregas)
    expect(contarEntregadas(filas)).toEqual({ entregadas: 26, total: 30 })
    // Y son exactamente los que se tocaron.
    expect(filas.filter((f) => !f.entregada).map((f) => f.alumno.numero_lista)).toEqual([
      3, 11, 17, 28,
    ])
  })

  it('son 5 escrituras, no 34: una por apertura y una por toque', async () => {
    // El presupuesto de 15 segundos no aguanta una escritura por alumno más una
    // relectura por toque.
    await abrirCaptura(trimestre, actividad)
    const trasAbrir = new Set((await db.outbox.toArray()).map((c) => c.at)).size

    for (const i of [3, 11, 17, 28]) {
      await alternarEntrega(trimestre, actividad, {
        alumno: alumno(i),
        entregada: true,
        registrado: true,
      })
    }

    const lotes = new Set((await db.outbox.toArray()).map((c) => c.at)).size
    expect(trasAbrir).toBe(1)
    expect(lotes).toBeLessThanOrEqual(5)
  })
})
