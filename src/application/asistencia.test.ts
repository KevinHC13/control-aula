// IndexedDB no existe en node: fake-indexeddb la provee en memoria. Los casos de
// uso corren contra los adaptadores reales, no contra dobles: lo que importa
// verificar es justamente que la escritura llegue a la base.
import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '@/data/dexie/db'
import type { Alumno, RegistroAsistencia } from '@/domain/entities'
import type { EstadoAsistencia } from '@/domain/values'

import {
  asistenciaDelDia,
  contarPresentes,
  filasDelDia,
  marcarEstado,
  pasarLista,
  resumenDelMes,
} from './asistencia'

const HOY = '2026-08-18'

// Nombres inventados: en el repositorio no va un solo nombre real del salón.
const alumno = (numero_lista: number, nombre: string): Alumno => ({
  id: `alumno-${numero_lista}`,
  nombre,
  ciclo_id: null,
  numero_lista,
  fecha_nacimiento: null,
  updated_at: '2026-08-18T08:00:00.000Z',
  deleted_at: null,
})

const GRUPO = [
  alumno(1, 'Aguilar, Bruno'),
  alumno(2, 'Bautista, Ana'),
  alumno(3, 'Cruz, Regina'),
]

const registro = (alumnoId: string, estado: EstadoAsistencia): RegistroAsistencia => ({
  id: `reg-${alumnoId}`,
  alumno_id: alumnoId,
  fecha: HOY,
  estado,
  updated_at: '2026-08-18T08:00:00.000Z',
  deleted_at: null,
})

beforeEach(async () => {
  await db.open()
  await db.alumnos.clear()
  await db.asistencia.clear()
  await db.outbox.clear()
})

const enFecha = (
  alumnoId: string,
  fecha: string,
  estado: EstadoAsistencia,
): RegistroAsistencia => ({ ...registro(alumnoId, estado), id: `reg-${alumnoId}-${fecha}`, fecha })

describe('resumenDelMes', () => {
  it('un mes sin registros da todos los días sin registrar', () => {
    const dias = resumenDelMes('2026-08', [])

    expect(dias).toHaveLength(31)
    expect(dias.every((d) => !d.registrado)).toBe(true)
    expect(dias.every((d) => d.ausentes === 0 && d.total === 0)).toBe(true)
    expect(dias[0]?.fecha).toBe('2026-08-01')
    expect(dias.at(-1)?.fecha).toBe('2026-08-31')
  })

  it('cuenta ausentes y total del día', () => {
    const dias = resumenDelMes('2026-08', [
      enFecha('alumno-1', HOY, 'ausente'),
      enFecha('alumno-2', HOY, 'presente'),
      enFecha('alumno-3', HOY, 'ausente'),
    ])

    const dia = dias.find((d) => d.fecha === HOY)
    expect(dia).toEqual({ fecha: HOY, registrado: true, ausentes: 2, total: 3 })
  })

  it('retardo y justificada no son ausencias', () => {
    const dias = resumenDelMes('2026-08', [
      enFecha('alumno-1', HOY, 'retardo'),
      enFecha('alumno-2', HOY, 'justificada'),
    ])

    const dia = dias.find((d) => d.fecha === HOY)
    expect(dia?.ausentes).toBe(0)
    expect(dia?.registrado).toBe(true)
  })

  it('un día capturado sin faltas está registrado, no hueco', () => {
    const dias = resumenDelMes('2026-08', [enFecha('alumno-1', '2026-08-03', 'presente')])

    expect(dias.find((d) => d.fecha === '2026-08-03')?.registrado).toBe(true)
    expect(dias.find((d) => d.fecha === '2026-08-04')?.registrado).toBe(false)
  })

  it('los registros de otro mes no aparecen', () => {
    const dias = resumenDelMes('2026-08', [enFecha('alumno-1', '2026-09-01', 'ausente')])

    expect(dias.every((d) => !d.registrado)).toBe(true)
  })
})

describe('filasDelDia', () => {
  it('un día sin registros presenta a todos como presentes', () => {
    const filas = filasDelDia(GRUPO, [])

    expect(filas).toHaveLength(3)
    expect(filas.every((f) => f.estado === 'presente')).toBe(true)
    // Presentes por defecto, no porque alguien lo haya capturado.
    expect(filas.every((f) => !f.registrado)).toBe(true)
  })

  it('distingue lo capturado de lo asumido', () => {
    const filas = filasDelDia(GRUPO, [registro('alumno-2', 'presente')])

    expect(filas[1]?.registrado).toBe(true)
    expect(filas[0]?.registrado).toBe(false)
  })

  it('respeta el orden de la lista que recibe', () => {
    const filas = filasDelDia(GRUPO, [registro('alumno-3', 'ausente')])

    expect(filas.map((f) => f.alumno.numero_lista)).toEqual([1, 2, 3])
    expect(filas[2]?.estado).toBe('ausente')
  })

  it('ignora un registro de un alumno que no está en el grupo', () => {
    // Un alumno dado de baja no debe reaparecer en la lista del día.
    const filas = filasDelDia(GRUPO, [registro('alumno-99', 'ausente')])

    expect(filas).toHaveLength(3)
  })
})

describe('contarPresentes', () => {
  it('cuenta retardo y justificada como presentes', () => {
    const filas = filasDelDia(GRUPO, [
      registro('alumno-1', 'retardo'),
      registro('alumno-2', 'justificada'),
      registro('alumno-3', 'ausente'),
    ])

    expect(contarPresentes(filas)).toEqual({ presentes: 2, total: 3 })
  })

  it('un día sin capturar cuenta a todos', () => {
    expect(contarPresentes(filasDelDia(GRUPO, []))).toEqual({ presentes: 3, total: 3 })
  })
})

describe('marcarEstado', () => {
  it('avanza un paso en el ciclo y lo guarda', async () => {
    await db.alumnos.bulkPut(GRUPO)

    expect(await marcarEstado('alumno-1', HOY, 'presente')).toBe('ausente')
    expect(await marcarEstado('alumno-1', HOY, 'ausente')).toBe('retardo')
    expect(await marcarEstado('alumno-1', HOY, 'retardo')).toBe('justificada')
  })

  it('ciclar desde justificada devuelve presente', async () => {
    await db.alumnos.bulkPut(GRUPO)

    expect(await marcarEstado('alumno-1', HOY, 'justificada')).toBe('presente')

    const filas = await asistenciaDelDia(HOY)
    expect(filas[0]?.estado).toBe('presente')
    // Quedó registrado: es un presente capturado, no el valor por defecto.
    expect(filas[0]?.registrado).toBe(true)
  })

  it('cuatro toques dejan al alumno como estaba, con un solo registro', async () => {
    await db.alumnos.bulkPut(GRUPO)

    let estado: EstadoAsistencia = 'presente'
    for (let i = 0; i < 4; i++) estado = await marcarEstado('alumno-1', HOY, estado)

    expect(estado).toBe('presente')
    expect(await db.asistencia.count()).toBe(1)
  })
})

describe('asistenciaDelDia', () => {
  it('abrir un día sin registros no falla y no escribe nada', async () => {
    await db.alumnos.bulkPut(GRUPO)

    const filas = await asistenciaDelDia(HOY)

    expect(filas).toHaveLength(3)
    expect(filas.every((f) => f.estado === 'presente')).toBe(true)
    // Navegar entre días es de solo lectura.
    expect(await db.asistencia.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it('con el grupo vacío devuelve lista vacía', async () => {
    expect(await asistenciaDelDia(HOY)).toEqual([])
  })
})

describe('pasarLista', () => {
  it('deja registrado a todo el grupo en presente', async () => {
    await db.alumnos.bulkPut(GRUPO)

    await pasarLista(HOY)

    const filas = await asistenciaDelDia(HOY)
    expect(filas.every((f) => f.registrado && f.estado === 'presente')).toBe(true)
    expect(await db.asistencia.count()).toBe(3)
  })

  it('no toca lo ya capturado', async () => {
    await db.alumnos.bulkPut(GRUPO)
    await marcarEstado('alumno-2', HOY, 'presente') // queda ausente

    await pasarLista(HOY)

    const filas = await asistenciaDelDia(HOY)
    expect(filas[1]?.estado).toBe('ausente')
    expect(await db.asistencia.count()).toBe(3)
  })

  it('es idempotente: llamarlo dos veces no duplica ni revierte', async () => {
    await db.alumnos.bulkPut(GRUPO)

    await pasarLista(HOY)
    await marcarEstado('alumno-3', HOY, 'presente') // queda ausente
    await pasarLista(HOY)

    expect(await db.asistencia.count()).toBe(3)
    expect((await asistenciaDelDia(HOY))[2]?.estado).toBe('ausente')
  })

  it('encola un pendiente por registro creado, en una sola transacción', async () => {
    await db.alumnos.bulkPut(GRUPO)

    await pasarLista(HOY)
    expect(await db.outbox.count()).toBe(3)

    // La segunda pasada no crea nada, así que tampoco encola.
    await pasarLista(HOY)
    expect(await db.outbox.count()).toBe(3)
  })
})
