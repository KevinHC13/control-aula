import { describe, expect, it } from 'vitest'

import type { FilaAsistencia } from '@/application/asistencia'
import type { FilaParticipacion } from '@/application/participacion'
import type { Alumno } from '@/domain/entities'
import type { EstadoAsistencia } from '@/domain/values'

import { candidatosPresentes, sortearEntre } from './sorteo'

const alumno = (n: number): Alumno => ({
  id: `alumno-${n}`,
  nombre: `Apellido${n}, Nombre`,
  ciclo_id: null,
  numero_lista: n,
  fecha_nacimiento: null,
  curp: null,
  updated_at: '2026-08-24T00:00:00.000Z',
  deleted_at: null,
})

const fila = (n: number, estado: EstadoAsistencia): FilaAsistencia => ({
  alumno: alumno(n),
  estado,
  registrado: true,
})

const conParticipaciones = (n: number, delTrimestre: number): FilaParticipacion => ({
  alumno: alumno(n),
  delDia: 0,
  delTrimestre,
})

describe('candidatosPresentes', () => {
  it('entran presentes y retardos', () => {
    const candidatos = candidatosPresentes([fila(1, 'presente'), fila(2, 'retardo')], [])

    expect(candidatos.map((c) => c.alumno.numero_lista)).toEqual([1, 2])
  })

  it('no entra el ausente', () => {
    expect(candidatosPresentes([fila(1, 'ausente')], [])).toHaveLength(0)
  })

  it('no entra la falta justificada, aunque cuente como asistencia', () => {
    // Es el único lugar de la app donde justificada y presente no son lo mismo:
    // cuenta para el porcentaje, pero el niño no está en el salón (D-021).
    expect(candidatosPresentes([fila(1, 'justificada')], [])).toHaveLength(0)
  })

  it('trae lo que cada uno lleva participado en el trimestre', () => {
    const candidatos = candidatosPresentes(
      [fila(1, 'presente'), fila(2, 'presente')],
      [conParticipaciones(1, 4)],
    )

    expect(candidatos[0]?.participaciones).toBe(4)
    // Sin fila de participación es cero, no un hueco.
    expect(candidatos[1]?.participaciones).toBe(0)
  })

  it('un día sin nadie presente no deja candidatos', () => {
    const candidatos = candidatosPresentes(
      [fila(1, 'ausente'), fila(2, 'justificada')],
      [],
    )
    expect(candidatos).toHaveLength(0)
  })
})

describe('sortearEntre', () => {
  it('sin candidatos devuelve null en vez de sortear entre nadie', () => {
    expect(sortearEntre([], 0.5)).toBeNull()
  })

  it('devuelve al alumno completo, no solo su id', () => {
    const candidatos = candidatosPresentes([fila(7, 'presente')], [])
    expect(sortearEntre(candidatos, 0.3)?.alumno.numero_lista).toBe(7)
  })

  it('favorece a quien menos ha participado', () => {
    // Pesos 5 y 1: el primer tramo se lleva cinco sextos.
    const candidatos = candidatosPresentes(
      [fila(1, 'presente'), fila(2, 'presente')],
      [conParticipaciones(1, 0), conParticipaciones(2, 4)],
    )

    expect(sortearEntre(candidatos, 0.1)?.alumno.numero_lista).toBe(1)
    expect(sortearEntre(candidatos, 0.95)?.alumno.numero_lista).toBe(2)
  })

  it('el mismo azar y los mismos candidatos dan el mismo resultado', () => {
    // Es lo que permite que la ruleta se pueda saltar sin cambiar a quién le tocó:
    // el sorteado se decide antes de la animación.
    const candidatos = candidatosPresentes(
      [fila(1, 'presente'), fila(2, 'presente'), fila(3, 'retardo')],
      [],
    )

    expect(sortearEntre(candidatos, 0.42)?.alumno.id).toBe(
      sortearEntre(candidatos, 0.42)?.alumno.id,
    )
  })
})
