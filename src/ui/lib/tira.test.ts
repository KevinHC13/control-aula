import { describe, expect, it } from 'vitest'

import { ANCHO_DIA, cuantosDiasCaben, SEPARACION } from './tira'

describe('cuantosDiasCaben', () => {
  it('las cajas que devuelve sí caben, y una más no cabría', () => {
    for (const ancho of [100, 302, 512, 1092, 1366]) {
      const n = cuantosDiasCaben(ancho)
      const ocupado = n * ANCHO_DIA + (n - 1) * SEPARACION
      expect(ocupado).toBeLessThanOrEqual(ancho)
      expect(ocupado + SEPARACION + ANCHO_DIA).toBeGreaterThan(ancho)
    }
  })

  it('un ancho de teléfono da unos cinco días', () => {
    // 390 px de iPhone, menos el padding de la pantalla y el botón de calendario.
    expect(cuantosDiasCaben(302)).toBe(5)
  })

  it('un iPad horizontal da toda la quincena', () => {
    expect(cuantosDiasCaben(1092)).toBe(19)
  })

  it('nunca devuelve cero, ni con ancho absurdo o sin medir', () => {
    expect(cuantosDiasCaben(20)).toBe(1)
    expect(cuantosDiasCaben(0)).toBe(1)
  })

  it('crece de forma monótona con el ancho', () => {
    expect(cuantosDiasCaben(500)).toBeGreaterThanOrEqual(cuantosDiasCaben(400))
  })
})
