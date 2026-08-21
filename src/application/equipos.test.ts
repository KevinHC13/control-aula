import { describe, expect, it } from 'vitest'

import type { FilaAsistencia } from '@/application/asistencia'
import type { Alumno } from '@/domain/entities'
import type { EstadoAsistencia } from '@/domain/values'

import { alumnosParaEquipos, cuantosEquipos, formarEquipos } from './equipos'

const alumno = (n: number): Alumno => ({
  id: `alumno-${n}`,
  nombre: `Apellido${n}, Nombre`,
  numero_lista: n,
  fecha_nacimiento: null,
  updated_at: '2026-08-24T00:00:00.000Z',
  deleted_at: null,
})

const fila = (n: number, estado: EstadoAsistencia = 'presente'): FilaAsistencia => ({
  alumno: alumno(n),
  estado,
  registrado: true,
})

const treinta = Array.from({ length: 30 }, (_, i) => alumno(i + 1))

describe('alumnosParaEquipos', () => {
  it('con solo los presentes entran presentes y retardos', () => {
    const filas = [fila(1), fila(2, 'retardo'), fila(3, 'ausente'), fila(4, 'justificada')]

    // La misma regla del sorteo: armar un equipo con quien no vino es armar un
    // equipo de tres.
    expect(alumnosParaEquipos(filas, true).map((a) => a.numero_lista)).toEqual([1, 2])
  })

  it('con todo el grupo entran todos, vinieran o no', () => {
    // Es lo que sirve para planear de un día para otro.
    const filas = [fila(1), fila(2, 'ausente'), fila(3, 'justificada')]
    expect(alumnosParaEquipos(filas, false)).toHaveLength(3)
  })
})

describe('cuantosEquipos', () => {
  it('por número de equipos, los que pidió', () => {
    expect(cuantosEquipos(30, 'equipos', 4)).toBe(4)
  })

  it('por niños por equipo, los que salgan', () => {
    expect(cuantosEquipos(30, 'por_equipo', 4)).toBe(8)
  })

  it('nunca más equipos que alumnos', () => {
    // Es lo que permite decirlo en pantalla en vez de pintar tarjetas vacías.
    expect(cuantosEquipos(3, 'equipos', 10)).toBe(3)
  })

  it('sin alumnos no hay equipos', () => {
    expect(cuantosEquipos(0, 'equipos', 4)).toBe(0)
  })
})

describe('formarEquipos', () => {
  it('arma los equipos pedidos, numerados desde 1', () => {
    const equipos = formarEquipos(treinta, 'equipos', 4, 0.42)

    expect(equipos.map((e) => e.numero)).toEqual([1, 2, 3, 4])
    expect(equipos.map((e) => e.integrantes.length)).toEqual([8, 8, 7, 7])
  })

  it('por niños por equipo reparte el sobrante igual', () => {
    const equipos = formarEquipos(treinta, 'por_equipo', 4, 0.42)

    expect(equipos).toHaveLength(8)
    expect(equipos.map((e) => e.integrantes.length)).toEqual([4, 4, 4, 4, 4, 4, 3, 3])
  })

  it('nadie queda fuera ni repetido', () => {
    const integrantes = formarEquipos(treinta, 'equipos', 7, 0.42).flatMap((e) => e.integrantes)

    expect(integrantes).toHaveLength(30)
    expect(new Set(integrantes.map((a) => a.id)).size).toBe(30)
  })

  it('volver a sortear da un reparto distinto', () => {
    const uno = formarEquipos(treinta, 'equipos', 4, 0.42)
    const otro = formarEquipos(treinta, 'equipos', 4, 0.77)

    expect(uno[0]?.integrantes.map((a) => a.id)).not.toEqual(
      otro[0]?.integrantes.map((a) => a.id),
    )
  })

  it('pedir más equipos que alumnos no arma equipos vacíos', () => {
    const equipos = formarEquipos([alumno(1), alumno(2)], 'equipos', 6, 0.42)

    expect(equipos).toHaveLength(2)
    expect(equipos.every((e) => e.integrantes.length === 1)).toBe(true)
  })

  it('sin alumnos no arma nada, y no falla', () => {
    expect(formarEquipos([], 'equipos', 4, 0.42)).toEqual([])
  })
})
