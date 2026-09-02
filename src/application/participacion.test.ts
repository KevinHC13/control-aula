import { describe, expect, it } from 'vitest'

import type { Alumno, Participacion } from '@/domain/entities'

import { filasDeParticipacion, totalDelDia } from './participacion'

const alumno = (n: number): Alumno => ({
  id: `alumno-${n}`,
  nombre: `Apellido${n}, Nombre`,
  ciclo_id: null,
  numero_lista: n,
  fecha_nacimiento: null,
  curp: null,
  sexo: null,
  updated_at: '2026-08-24T00:00:00.000Z',
  deleted_at: null,
})

const marca = (alumnoId: string, fecha: string, cantidad: number): Participacion => ({
  id: `${alumnoId}-${fecha}`,
  alumno_id: alumnoId,
  fecha,
  cantidad,
  updated_at: `${fecha}T18:00:00.000Z`,
  deleted_at: null,
})

describe('filasDeParticipacion', () => {
  it('saca a todo el grupo, con y sin marcas', () => {
    const filas = filasDeParticipacion([alumno(1), alumno(2)], [marca('alumno-2', '2026-09-10', 2)], [])

    expect(filas).toHaveLength(2)
    expect(filas[0]?.delDia).toBe(0)
    expect(filas[1]?.delDia).toBe(2)
  })

  it('suma los días del trimestre por alumno', () => {
    const filas = filasDeParticipacion(
      [alumno(1)],
      [marca('alumno-1', '2026-09-10', 2)],
      [
        marca('alumno-1', '2026-09-08', 1),
        marca('alumno-1', '2026-09-09', 3),
        marca('alumno-1', '2026-09-10', 2),
      ],
    )

    expect(filas[0]?.delDia).toBe(2)
    expect(filas[0]?.delTrimestre).toBe(6)
  })

  it('un día fuera de todo trimestre sigue contando el día, no el trimestre', () => {
    // Vacaciones o un puente: marcar es un dato aunque no vaya a calificar.
    const filas = filasDeParticipacion([alumno(1)], [marca('alumno-1', '2026-12-22', 1)], [])

    expect(filas[0]?.delDia).toBe(1)
    expect(filas[0]?.delTrimestre).toBe(0)
  })

  it('ignora marcas de un alumno que no está en la lista', () => {
    const filas = filasDeParticipacion([alumno(1)], [marca('alumno-9', '2026-09-10', 4)], [])

    expect(filas).toHaveLength(1)
    expect(filas[0]?.delDia).toBe(0)
  })

  it('una fila en cero es lo mismo que ninguna fila', () => {
    // Deshacer deja la fila en cero en vez de borrarla; al calificar significan
    // lo mismo.
    const filas = filasDeParticipacion([alumno(1)], [marca('alumno-1', '2026-09-10', 0)], [])
    expect(filas[0]?.delDia).toBe(0)
  })
})

describe('totalDelDia', () => {
  it('cuenta participaciones y de cuántos alumnos, que no es lo mismo', () => {
    // Doce participaciones de tres alumnos es una clase donde participaron los
    // mismos de siempre, y eso es lo que el criterio existe para hacer visible.
    const filas = filasDeParticipacion(
      [alumno(1), alumno(2), alumno(3), alumno(4)],
      [
        marca('alumno-1', '2026-09-10', 6),
        marca('alumno-2', '2026-09-10', 4),
        marca('alumno-3', '2026-09-10', 2),
      ],
      [],
    )

    expect(totalDelDia(filas)).toEqual({ participaciones: 12, alumnos: 3 })
  })

  it('sin marcas, cero y cero', () => {
    const filas = filasDeParticipacion([alumno(1), alumno(2)], [], [])
    expect(totalDelDia(filas)).toEqual({ participaciones: 0, alumnos: 0 })
  })

  it('una fila en cero no cuenta como alumno que participó', () => {
    const filas = filasDeParticipacion([alumno(1)], [marca('alumno-1', '2026-09-10', 0)], [])
    expect(totalDelDia(filas)).toEqual({ participaciones: 0, alumnos: 0 })
  })
})
