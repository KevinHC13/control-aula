// IndexedDB no existe en node: fake-indexeddb la provee en memoria.
import 'fake-indexeddb/auto'

import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from '@/data/dexie/db'
import type { ActividadConEstado } from '@/data/ports/evaluacion'
import type {
  Alumno,
  EvaluacionRubrica,
  RubricaCriterio,
  Trimestre,
} from '@/domain/entities'
import type { Id, Nivel } from '@/domain/values'

import {
  calificarRenglon,
  contarCalificados,
  filasDeCalificacion,
  siguienteSinCalificar,
} from './calificacion'

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
    nombre: 'Maqueta del sistema solar',
    campo: 'saberes_pensamiento_cientifico',
    ejes: [],
    fecha: '2026-09-01',
    rubrica_id: 'rubrica-1',
  },
  registros: 0,
}

const alumno = (i: number): Alumno => ({
  id: `alumno-${i}`,
  updated_at: '2026-08-17T00:00:00.000Z',
  deleted_at: null,
  nombre: `Apellido${String(i).padStart(2, '0')}, Nombre`,
  numero_lista: i,
  fecha_nacimiento: null,
})

const renglon = (i: number): RubricaCriterio => ({
  id: `renglon-${i}`,
  updated_at: '2026-08-30T00:00:00.000Z',
  deleted_at: null,
  rubrica_id: 'rubrica-1',
  nombre: `Renglón ${i}`,
  descriptores: ['Muy bien', 'Bien', 'Regular', 'Mal'],
  orden: i,
})

const evaluacion = (alumnoId: string, niveles: Record<Id, Nivel>): EvaluacionRubrica => ({
  id: `eval-${alumnoId}`,
  updated_at: '2026-09-01T00:00:00.000Z',
  deleted_at: null,
  actividad_id: actividad.actividad.id,
  alumno_id: alumnoId,
  niveles,
})

const DOS_RENGLONES = [renglon(1), renglon(2)]

beforeEach(async () => {
  await db.open()
  await db.eval_rubrica.clear()
  await db.outbox.clear()
})

afterAll(() => {
  db.close()
})

describe('filasDeCalificacion', () => {
  it('sin captura, nadie está calificado y no hay nivel elegido', () => {
    const filas = filasDeCalificacion([alumno(1), alumno(2)], [], DOS_RENGLONES)
    expect(filas.every((f) => !f.completa)).toBe(true)
    expect(filas.every((f) => f.capturados === 0)).toBe(true)
    expect(filas[0]?.niveles).toEqual({})
  })

  it('cuenta los renglones capturados y marca completa solo con todos', () => {
    const filas = filasDeCalificacion(
      [alumno(1), alumno(2)],
      [
        evaluacion('alumno-1', { 'renglon-1': 0, 'renglon-2': 3 }),
        evaluacion('alumno-2', { 'renglon-1': 1 }),
      ],
      DOS_RENGLONES,
    )
    expect(filas[0]?.capturados).toBe(2)
    expect(filas[0]?.completa).toBe(true)
    expect(filas[1]?.capturados).toBe(1)
    expect(filas[1]?.completa).toBe(false)
  })

  it('el nivel 0 es un nivel elegido, no un hueco', () => {
    const filas = filasDeCalificacion(
      [alumno(1)],
      [evaluacion('alumno-1', { 'renglon-1': 0, 'renglon-2': 0 })],
      DOS_RENGLONES,
    )
    expect(filas[0]?.completa).toBe(true)
  })

  it('ignora los niveles de renglones que la rúbrica ya no tiene', () => {
    // Editar una rúbrica conserva el id de sus renglones, pero puede quitarlos:
    // lo capturado en el que se fue sigue guardado y no califica al que llegó.
    const filas = filasDeCalificacion(
      [alumno(1)],
      [evaluacion('alumno-1', { 'renglon-1': 1, 'renglon-9': 2 })],
      DOS_RENGLONES,
    )
    expect(filas[0]?.capturados).toBe(1)
    expect(filas[0]?.completa).toBe(false)
  })

  it('conserva el orden del grupo, no el de los registros', () => {
    const filas = filasDeCalificacion(
      [alumno(1), alumno(2), alumno(3)],
      [evaluacion('alumno-3', { 'renglon-1': 0 }), evaluacion('alumno-1', { 'renglon-1': 0 })],
      DOS_RENGLONES,
    )
    expect(filas.map((f) => f.alumno.numero_lista)).toEqual([1, 2, 3])
  })

  it('es pura: no lee la base', async () => {
    const antes = await db.eval_rubrica.count()
    filasDeCalificacion([alumno(1)], [], DOS_RENGLONES)
    expect(await db.eval_rubrica.count()).toBe(antes)
  })
})

describe('contarCalificados', () => {
  it('cuenta los completos sobre el total del grupo', () => {
    const filas = filasDeCalificacion(
      [alumno(1), alumno(2), alumno(3)],
      [
        evaluacion('alumno-1', { 'renglon-1': 0, 'renglon-2': 0 }),
        evaluacion('alumno-2', { 'renglon-1': 0 }),
      ],
      DOS_RENGLONES,
    )
    // El de a medias no cuenta: «12 de 30» es de calificados, no de tocados.
    expect(contarCalificados(filas)).toEqual({ calificados: 1, total: 3 })
  })

  it('sin grupo devuelve cero de cero', () => {
    expect(contarCalificados([])).toEqual({ calificados: 0, total: 0 })
  })
})

describe('siguienteSinCalificar', () => {
  const filas = (completos: number[]) =>
    filasDeCalificacion(
      [alumno(1), alumno(2), alumno(3), alumno(4)],
      completos.map((i) => evaluacion(`alumno-${i}`, { 'renglon-1': 0, 'renglon-2': 0 })),
      DOS_RENGLONES,
    )

  it('desde -1 devuelve el primero que falta', () => {
    expect(siguienteSinCalificar(filas([1]), -1)).toBe(1)
  })

  it('salta a los que ya están calificados', () => {
    expect(siguienteSinCalificar(filas([2, 3]), 0)).toBe(3)
  })

  it('da la vuelta al llegar al final', () => {
    // Calificó del 2 al 4 y dejó al 1 para cuando trajera el trabajo.
    expect(siguienteSinCalificar(filas([2, 3, 4]), 3)).toBe(0)
  })

  it('no se queda en el actual si ese es el que falta', () => {
    // Sigue faltando el 2, pero «siguiente» avanza: quedarse ahí sería no hacer
    // nada al toque.
    expect(siguienteSinCalificar(filas([1, 3]), 1)).toBe(3)
  })

  it('con uno solo pendiente vuelve a él, incluso desde él mismo', () => {
    expect(siguienteSinCalificar(filas([1, 2, 4]), 2)).toBe(2)
  })

  it('cuando ya no falta nadie devuelve null', () => {
    expect(siguienteSinCalificar(filas([1, 2, 3, 4]), 0)).toBe(null)
  })

  it('sin grupo devuelve null, no falla', () => {
    expect(siguienteSinCalificar([], -1)).toBe(null)
  })
})

describe('calificarRenglon', () => {
  const filaDe = (niveles: Record<Id, Nivel>) =>
    filasDeCalificacion([alumno(1)], [evaluacion('alumno-1', niveles)], DOS_RENGLONES)[0]!

  it('escribe al toque, sin botón de Guardar', async () => {
    await calificarRenglon(trimestre, actividad, filaDe({}), 'renglon-1', 2)

    const guardadas = await db.eval_rubrica.toArray()
    expect(guardadas).toHaveLength(1)
    expect(guardadas[0]?.niveles).toEqual({ 'renglon-1': 2 })
  })

  it('conserva lo que ya estaba capturado en los otros renglones', async () => {
    await calificarRenglon(trimestre, actividad, filaDe({}), 'renglon-1', 0)
    await calificarRenglon(
      trimestre,
      actividad,
      filaDe({ 'renglon-1': 0 }),
      'renglon-2',
      3,
    )

    const guardadas = await db.eval_rubrica.toArray()
    expect(guardadas).toHaveLength(1)
    expect(guardadas[0]?.niveles).toEqual({ 'renglon-1': 0, 'renglon-2': 3 })
  })

  it('corregir el nivel no deja dos registros', async () => {
    await calificarRenglon(trimestre, actividad, filaDe({}), 'renglon-1', 1)
    await calificarRenglon(trimestre, actividad, filaDe({ 'renglon-1': 1 }), 'renglon-1', 0)

    const guardadas = await db.eval_rubrica.toArray()
    expect(guardadas).toHaveLength(1)
    expect(guardadas[0]?.niveles).toEqual({ 'renglon-1': 0 })
  })

  it('encola el cambio para sincronizar', async () => {
    await calificarRenglon(trimestre, actividad, filaDe({}), 'renglon-1', 1)

    const pendientes = await db.outbox.toArray()
    expect(pendientes).toHaveLength(1)
    expect(pendientes[0]?.tabla).toBe('eval_rubrica')
  })

  it('un trimestre cerrado rechaza la escritura', async () => {
    const cerrado: Trimestre = {
      ...trimestre,
      estado: 'cerrado',
      cerrado_en: '2026-11-28T00:00:00.000Z',
    }

    await expect(
      calificarRenglon(cerrado, actividad, filaDe({}), 'renglon-1', 0),
    ).rejects.toThrow(/cerrado/)
    expect(await db.eval_rubrica.count()).toBe(0)
  })
})
