import { describe, expect, it } from 'vitest'

import type { RegistroAsistencia } from './entities'
import {
  cuentaComoAsistencia,
  enRiesgo,
  porcentajeAsistencia,
  promedioDe,
  siguienteEstado,
  UMBRAL_ASISTENCIA,
  UMBRAL_PROMEDIO,
} from './rules'
import { CICLO_ESTADOS, type EstadoAsistencia } from './values'

const registro = (estado: EstadoAsistencia): RegistroAsistencia => ({
  id: 'id-de-prueba',
  updated_at: '2026-08-18T00:00:00.000Z',
  deleted_at: null,
  alumno_id: 'alumno-de-prueba',
  fecha: '2026-08-18',
  estado,
})

describe('cuentaComoAsistencia', () => {
  it('cuenta retardo y justificada como asistencia', () => {
    expect(cuentaComoAsistencia('retardo')).toBe(true)
    expect(cuentaComoAsistencia('justificada')).toBe(true)
    expect(cuentaComoAsistencia('presente')).toBe(true)
  })

  it('solo ausente no cuenta', () => {
    expect(cuentaComoAsistencia('ausente')).toBe(false)
  })
})

describe('siguienteEstado', () => {
  it('avanza en el orden del ciclo', () => {
    expect(siguienteEstado('presente')).toBe('ausente')
    expect(siguienteEstado('ausente')).toBe('retardo')
    expect(siguienteEstado('retardo')).toBe('justificada')
    expect(siguienteEstado('justificada')).toBe('presente')
  })

  it('cierra sobre sí mismo: un toque por estado regresa al inicio', () => {
    let estado: EstadoAsistencia = 'presente'
    for (let i = 0; i < CICLO_ESTADOS.length; i++) estado = siguienteEstado(estado)
    expect(estado).toBe('presente')
  })
})

describe('porcentajeAsistencia', () => {
  it('sin registros devuelve 100, no NaN', () => {
    // Un alumno del que todavía no hay datos no es un alumno con cero asistencia.
    expect(porcentajeAsistencia([])).toBe(100)
  })

  it('retardo y justificada suman al porcentaje', () => {
    expect(
      porcentajeAsistencia([
        registro('presente'),
        registro('retardo'),
        registro('justificada'),
        registro('ausente'),
      ]),
    ).toBe(75)
  })

  it('todos presentes es 100 y todos ausentes es 0', () => {
    expect(porcentajeAsistencia([registro('presente'), registro('presente')])).toBe(100)
    expect(porcentajeAsistencia([registro('ausente')])).toBe(0)
  })

  it('no redondea: el formato lo decide la interfaz', () => {
    expect(porcentajeAsistencia([registro('presente'), registro('ausente'), registro('ausente')]))
      .toBeCloseTo(33.333, 3)
  })
})

describe('promedioDe', () => {
  it('sin calificaciones devuelve null, nunca 0', () => {
    // Un alumno sin calificaciones capturadas no es un alumno reprobado.
    expect(promedioDe([])).toBeNull()
  })

  it('distingue un cero real de la ausencia de datos', () => {
    expect(promedioDe([0])).toBe(0)
  })

  it('promedia sin redondear', () => {
    expect(promedioDe([10])).toBe(10)
    expect(promedioDe([5, 10])).toBe(7.5)
    expect(promedioDe([8, 9, 10])).toBeCloseTo(9, 10)
  })
})

describe('enRiesgo', () => {
  it('no marca riesgo con asistencia y promedio buenos', () => {
    expect(enRiesgo(100, 10)).toBe(false)
  })

  it('marca riesgo por asistencia o por promedio', () => {
    expect(enRiesgo(UMBRAL_ASISTENCIA - 0.1, 10)).toBe(true)
    expect(enRiesgo(100, UMBRAL_PROMEDIO - 0.1)).toBe(true)
  })

  it('el umbral exacto no es riesgo', () => {
    expect(enRiesgo(UMBRAL_ASISTENCIA, UMBRAL_PROMEDIO)).toBe(false)
  })

  it('un promedio null no es riesgo: es ausencia de datos, no un dato malo', () => {
    expect(enRiesgo(100, null)).toBe(false)
  })
})
