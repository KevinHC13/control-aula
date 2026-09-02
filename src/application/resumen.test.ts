import { describe, expect, it } from 'vitest'

import type { CalificacionDeAlumno } from '@/application/calificaciones'
import { comoCalificacion } from '@/domain/calculo'
import type { Alumno, RegistroAsistencia } from '@/domain/entities'
import type { EstadoAsistencia } from '@/domain/values'

import { resumenDelGrupo, UMBRALES } from './resumen'

const base = { updated_at: '2026-09-01T00:00:00.000Z', deleted_at: null }

const alumno = (n: number): Alumno => ({
  id: `alumno-${n}`,
  ...base,
  nombre: `Apellido${n}, Nombre`,
  ciclo_id: null,
  numero_lista: n,
  fecha_nacimiento: null,
  curp: null,
  sexo: null,
})

const dia = (n: number, fecha: string, estado: EstadoAsistencia): RegistroAsistencia => ({
  id: `asis-${n}-${fecha}`,
  ...base,
  alumno_id: `alumno-${n}`,
  fecha,
  estado,
})

/** Los días de un alumno, en fechas consecutivas de septiembre. */
function dias(n: number, estados: EstadoAsistencia[]): RegistroAsistencia[] {
  return estados.map((estado, i) =>
    dia(n, `2026-09-${String(i + 1).padStart(2, '0')}`, estado),
  )
}

const calificacion = (n: number, general: number | null): CalificacionDeAlumno => ({
  alumno: alumno(n),
  criterios: [],
  general,
  pesoConsiderado: general === null ? 0 : 100,
  porCampo: {},
})

const DOS = [alumno(1), alumno(2)]

describe('resumenDelGrupo', () => {
  it('cuenta días, faltas y retardos por alumno', () => {
    const { filas } = resumenDelGrupo(
      [alumno(1)],
      dias(1, ['presente', 'ausente', 'retardo', 'justificada']),
      [],
    )

    expect(filas[0]?.dias).toBe(4)
    // Solo `ausente` es falta: retardo y justificada cuentan como asistencia.
    expect(filas[0]?.ausencias).toBe(1)
    expect(filas[0]?.retardos).toBe(1)
    expect(filas[0]?.porcentaje).toBe(75)
  })

  it('el porcentaje coincide con un conteo a mano', () => {
    // 8 de 10 días: 80 %.
    const estados: EstadoAsistencia[] = [
      'presente',
      'presente',
      'presente',
      'presente',
      'presente',
      'presente',
      'retardo',
      'justificada',
      'ausente',
      'ausente',
    ]

    expect(resumenDelGrupo([alumno(1)], dias(1, estados), []).filas[0]?.porcentaje).toBe(80)
  })

  it('sin días capturados el porcentaje es —, no 100 ni 0', () => {
    // `porcentajeAsistencia` devuelve 100 sin registros, y para el resumen eso
    // sería asistencia perfecta inventada.
    const { filas, asistencia } = resumenDelGrupo(DOS, [], [])

    expect(filas[0]?.porcentaje).toBeNull()
    expect(asistencia).toBeNull()
  })

  it('sin calificaciones el promedio es —, no 0.0', () => {
    const { filas, promedio } = resumenDelGrupo(DOS, dias(1, ['presente']), [])

    expect(comoCalificacion(filas[0]?.promedio ?? null)).toBe('—')
    expect(comoCalificacion(promedio)).toBe('—')
  })

  it('el promedio del grupo es el de quienes tienen calificación', () => {
    // Media captura no puede hundir al grupo (D-019): el que no tiene no entra en
    // el promedio, en vez de entrar como cero.
    const { promedio } = resumenDelGrupo(DOS, [], [calificacion(1, 0.9)])

    expect(comoCalificacion(promedio)).toBe('9.0')
  })

  it('la asistencia del grupo es sobre todos los registros', () => {
    // Tres presentes y uno ausente entre los dos alumnos: 75 %.
    const { asistencia } = resumenDelGrupo(
      DOS,
      [...dias(1, ['presente', 'presente']), ...dias(2, ['presente', 'ausente'])],
      [],
    )

    expect(asistencia).toBe(75)
  })

  it('cuenta los días distintos capturados, no los registros', () => {
    const { diasCapturados } = resumenDelGrupo(
      DOS,
      [...dias(1, ['presente', 'presente']), ...dias(2, ['presente', 'presente'])],
      [],
    )

    expect(diasCapturados).toBe(2)
  })

  it('marca al de asistencia baja', () => {
    // 1 falta de 5 días es 80 %, debajo del umbral de arranque.
    const { filas, enRiesgo } = resumenDelGrupo(
      [alumno(1)],
      dias(1, ['ausente', 'presente', 'presente', 'presente', 'presente']),
      [],
    )

    expect(UMBRALES.asistencia).toBe(90)
    expect(filas[0]?.riesgo).toBe(true)
    expect(enRiesgo).toBe(1)
  })

  it('marca al de promedio bajo, comparando en base 10', () => {
    // El umbral es 6.0 y la cadena de cálculo viaja en base 1: sin convertir, un
    // 9.0 se compararía como 0.9 y el grupo entero saldría marcado.
    const asistenciaPerfecta = dias(1, ['presente', 'presente'])

    expect(
      resumenDelGrupo([alumno(1)], asistenciaPerfecta, [calificacion(1, 0.55)]).filas[0]
        ?.riesgo,
    ).toBe(true)
    expect(
      resumenDelGrupo([alumno(1)], asistenciaPerfecta, [calificacion(1, 0.9)]).filas[0]
        ?.riesgo,
    ).toBe(false)
  })

  it('no marca a nadie sin días capturados', () => {
    // Marcar por falta de datos volvería el aviso ruido las dos primeras semanas.
    const { filas, enRiesgo } = resumenDelGrupo(DOS, [], [])

    expect(filas.every((f) => !f.riesgo)).toBe(true)
    expect(enRiesgo).toBe(0)
  })

  it('saca a todo el grupo, con datos o sin ellos', () => {
    const { filas } = resumenDelGrupo(DOS, dias(1, ['presente']), [calificacion(1, 0.8)])

    expect(filas).toHaveLength(2)
    expect(filas[1]?.dias).toBe(0)
    expect(filas[1]?.promedio).toBeNull()
  })

  it('ignora registros de un alumno que no está en la lista', () => {
    const { filas, asistencia } = resumenDelGrupo([alumno(1)], dias(9, ['ausente']), [])

    expect(filas[0]?.dias).toBe(0)
    // La cifra del grupo sí los cuenta: es sobre los registros que hay.
    expect(asistencia).toBe(0)
  })
})
