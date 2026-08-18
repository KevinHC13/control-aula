import { describe, expect, it } from 'vitest'

import { fechaLocal, fechaMas } from './fechas'

describe('fechaLocal', () => {
  it('da la fecha del dispositivo, no la de UTC', () => {
    // 19:00 del 18 de agosto en México son las 01:00 del 19 en UTC. El día del
    // salón es el 18: `toISOString().slice(0, 10)` daría el 19.
    const tarde = new Date(2026, 7, 18, 19, 0, 0)
    expect(fechaLocal(tarde)).toBe('2026-08-18')
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
