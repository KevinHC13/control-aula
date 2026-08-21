import { describe, expect, it } from 'vitest'

import { equiposPara, mezclar, repartir, tamanos } from './equipos'

const treinta = Array.from({ length: 30 }, (_, i) => i + 1)

describe('tamanos', () => {
  it('reparte el sobrante: 30 en 4 equipos son 8, 8, 7 y 7', () => {
    // Nunca 8, 8, 8 y 6: un equipo de dos contra tres de ocho no es un reparto.
    expect(tamanos(30, 4)).toEqual([8, 8, 7, 7])
  })

  it('cuando divide exacto, todos iguales', () => {
    expect(tamanos(30, 5)).toEqual([6, 6, 6, 6, 6])
  })

  it('la suma es siempre el total: nadie se queda fuera', () => {
    for (const equipos of [2, 3, 4, 6, 7, 11]) {
      const suma = tamanos(30, equipos).reduce((a, b) => a + b, 0)
      expect(suma, `${equipos} equipos`).toBe(30)
    }
  })

  it('la diferencia entre el más grande y el más chico nunca pasa de uno', () => {
    for (const equipos of [3, 4, 7, 8, 9]) {
      const reparto = tamanos(30, equipos)
      expect(Math.max(...reparto) - Math.min(...reparto), `${equipos} equipos`).toBeLessThanOrEqual(1)
    }
  })

  it('pedir más equipos que alumnos no arma equipos vacíos', () => {
    // Salen tantos equipos como alumnos, de uno. Quien llama compara para decirlo.
    expect(tamanos(3, 10)).toEqual([1, 1, 1])
  })

  it('sin alumnos o sin equipos no hay reparto, y no falla', () => {
    expect(tamanos(0, 4)).toEqual([])
    expect(tamanos(30, 0)).toEqual([])
    expect(tamanos(30, -2)).toEqual([])
  })
})

describe('equiposPara', () => {
  it('de 4 en 4 con 30 alumnos son 8 equipos', () => {
    // El último quedaría de 2, y `tamanos` lo vuelve a repartir.
    expect(equiposPara(30, 4)).toBe(8)
  })

  it('es el mismo dato visto al revés', () => {
    expect(tamanos(30, equiposPara(30, 4))).toEqual([4, 4, 4, 4, 4, 4, 3, 3])
  })

  it('con cero o menos no divide entre cero', () => {
    expect(equiposPara(30, 0)).toBe(0)
    expect(equiposPara(0, 4)).toBe(0)
  })
})

describe('mezclar', () => {
  it('no pierde ni repite a nadie', () => {
    const mezclado = mezclar(treinta, 0.42)
    expect(mezclado).toHaveLength(30)
    expect([...mezclado].sort((a, b) => a - b)).toEqual(treinta)
  })

  it('la misma semilla da la misma mezcla', () => {
    expect(mezclar(treinta, 0.42)).toEqual(mezclar(treinta, 0.42))
  })

  it('otra semilla da otra mezcla', () => {
    // Es lo que hace que «volver a sortear» sirva de algo.
    expect(mezclar(treinta, 0.42)).not.toEqual(mezclar(treinta, 0.77))
  })

  it('mezcla de verdad: no devuelve el mismo orden', () => {
    expect(mezclar(treinta, 0.42)).not.toEqual(treinta)
  })

  it('con uno o ninguno no falla', () => {
    expect(mezclar([], 0.5)).toEqual([])
    expect(mezclar(['solo'], 0.5)).toEqual(['solo'])
  })
})

describe('repartir', () => {
  it('arma los equipos con los tamaños de tamanos', () => {
    const equipos = repartir(treinta, 4, 0.42)
    expect(equipos.map((e) => e.length)).toEqual([8, 8, 7, 7])
  })

  it('cada alumno queda en exactamente un equipo', () => {
    const equipos = repartir(treinta, 4, 0.42)
    const todos = equipos.flat()
    expect(todos).toHaveLength(30)
    expect(new Set(todos).size).toBe(30)
  })

  it('la misma semilla arma los mismos equipos', () => {
    expect(repartir(treinta, 4, 0.42)).toEqual(repartir(treinta, 4, 0.42))
  })

  it('otra semilla arma otros equipos', () => {
    expect(repartir(treinta, 4, 0.42)).not.toEqual(repartir(treinta, 4, 0.77))
  })

  it('sin alumnos no arma nada', () => {
    expect(repartir([], 4, 0.42)).toEqual([])
  })
})
