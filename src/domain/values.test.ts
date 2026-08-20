import { describe, expect, it } from 'vitest'

import { CAMPOS_FORMATIVOS, NIVEL_MAXIMO, NIVELES, VALOR_NIVEL } from './values'

describe('niveles de rúbrica', () => {
  it('hay un valor por nivel', () => {
    // Las dos tablas son paralelas y se indexan con el mismo número. Si se
    // desalinean, una rúbrica califica con el valor del nivel de al lado.
    expect(VALOR_NIVEL).toHaveLength(NIVELES.length)
  })

  it('van de mejor a peor, sin empates', () => {
    const ordenados = [...VALOR_NIVEL].sort((a, b) => b - a)
    expect([...VALOR_NIVEL]).toEqual(ordenados)
    expect(new Set(VALOR_NIVEL).size).toBe(VALOR_NIVEL.length)
  })

  it('NIVEL_MAXIMO es el valor del mejor nivel', () => {
    // Es el divisor de valorConRubrica(): si no coincide con el máximo real, un
    // trabajo perfecto deja de dar 10.
    expect(NIVEL_MAXIMO).toBe(Math.max(...VALOR_NIVEL))
    expect(VALOR_NIVEL[0]).toBe(NIVEL_MAXIMO)
  })

  it('«Mal» vale 0: es un acantilado deliberado, no un valor bajo', () => {
    // Codifica que el trabajo no vale nada, no que valga poco
    // (docs/DECISIONES.md D-015).
    expect(NIVELES.at(-1)).toBe('Mal')
    expect(VALOR_NIVEL.at(-1)).toBe(0)
  })

  it('en base 10, los tres niveles superiores caben en menos de dos puntos', () => {
    const base10 = VALOR_NIVEL.map((v) => (v / NIVEL_MAXIMO) * 10)
    const [excelente = 0, bien = 0, regular = 0] = base10
    expect(excelente).toBeCloseTo(10)
    expect(excelente - regular).toBeLessThan(4)
    expect(excelente - bien).toBeLessThan(2)
    // Y de Regular a Mal se cae el acantilado.
    expect(regular).toBeGreaterThan(6)
  })
})

describe('campos formativos', () => {
  it('son cuatro y no se repiten', () => {
    expect(CAMPOS_FORMATIVOS).toHaveLength(4)
    expect(new Set(CAMPOS_FORMATIVOS).size).toBe(4)
  })
})
