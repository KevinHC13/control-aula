import { describe, expect, it } from 'vitest'

import { comoDate, fechaLocal, fechaMas, ultimosDias } from './fechas'

describe('fechaLocal', () => {
  it('la zona de las pruebas está fijada, o esta suite no prueba nada', () => {
    // Con TZ=UTC, una implementación con `toISOString().slice(0, 10)` pasaría
    // todas las pruebas de abajo. La zona se fija en vite.config.ts.
    expect(new Date().getTimezoneOffset()).not.toBe(0)
  })

  it('da la fecha del dispositivo, no la de UTC', () => {
    // Este instante es 01:00 del 19 en UTC y 19:00 del 18 en México. El día del
    // salón es el 18; `toISOString().slice(0, 10)` daría el 19.
    const tarde = new Date('2026-08-19T01:00:00.000Z')

    expect(fechaLocal(tarde)).toBe('2026-08-18')
    expect(fechaLocal(tarde)).not.toBe(tarde.toISOString().slice(0, 10))
  })

  it('la madrugada tampoco se corre de día', () => {
    // 00:30 del 18 en México son las 06:30 del 18 en UTC: aquí coinciden, y es
    // el caso que la implementación ingenua acierta por casualidad.
    expect(fechaLocal(new Date('2026-08-18T06:30:00.000Z'))).toBe('2026-08-18')
  })

  it('rellena mes y día con cero', () => {
    expect(fechaLocal(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('la medianoche pertenece al día que empieza', () => {
    expect(fechaLocal(new Date(2026, 7, 18, 0, 0, 0))).toBe('2026-08-18')
    expect(fechaLocal(new Date(2026, 7, 18, 23, 59, 59))).toBe('2026-08-18')
  })
})

describe('fechaMas', () => {
  it('avanza y retrocede días', () => {
    expect(fechaMas('2026-08-18', 1)).toBe('2026-08-19')
    expect(fechaMas('2026-08-18', -1)).toBe('2026-08-17')
    expect(fechaMas('2026-08-18', 0)).toBe('2026-08-18')
  })

  it('cruza fin de mes y fin de año', () => {
    expect(fechaMas('2026-08-31', 1)).toBe('2026-09-01')
    expect(fechaMas('2026-12-31', 1)).toBe('2027-01-01')
    expect(fechaMas('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('acierta en año bisiesto', () => {
    expect(fechaMas('2028-02-28', 1)).toBe('2028-02-29')
    expect(fechaMas('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('retroceder una semana desde el lunes cae en el lunes anterior', () => {
    expect(fechaMas('2026-08-17', -7)).toBe('2026-08-10')
  })
})

describe('ultimosDias', () => {
  it('termina en la fecha dada y va en orden ascendente', () => {
    expect(ultimosDias('2026-08-18', 3)).toEqual(['2026-08-16', '2026-08-17', '2026-08-18'])
  })

  it('cruza el inicio de mes hacia atrás', () => {
    expect(ultimosDias('2026-09-01', 2)).toEqual(['2026-08-31', '2026-09-01'])
  })

  it('uno solo es el día dado', () => {
    expect(ultimosDias('2026-08-18', 1)).toEqual(['2026-08-18'])
  })
})

describe('comoDate', () => {
  it('cae al mediodía local, no a medianoche', () => {
    const d = comoDate('2026-08-18')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(7)
    expect(d.getDate()).toBe(18)
    expect(d.getHours()).toBe(12)
  })

  it('ida y vuelta con fechaLocal no cambia el día', () => {
    for (const fecha of ['2026-01-01', '2026-04-05', '2026-10-25', '2026-12-31']) {
      expect(fechaLocal(comoDate(fecha))).toBe(fecha)
    }
  })
})
