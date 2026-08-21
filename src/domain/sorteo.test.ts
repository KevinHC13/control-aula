import { describe, expect, it } from 'vitest'

import { type Candidato, elegirPonderado, pesoDeCandidato } from './sorteo'

const candidato = (id: string, participaciones: number): Candidato => ({ id, participaciones })

describe('pesoDeCandidato', () => {
  it('quien no ha participado pesa más que quien va a la cabeza', () => {
    // Con un máximo de 5: 6 contra 1, así que sale seis veces menos seguido.
    expect(pesoDeCandidato(0, 5)).toBe(6)
    expect(pesoDeCandidato(5, 5)).toBe(1)
  })

  it('el que va a la cabeza nunca pesa cero: el sorteo favorece, no excluye', () => {
    expect(pesoDeCandidato(5, 5)).toBeGreaterThan(0)
    // Ni siquiera si de algún modo pasa del máximo.
    expect(pesoDeCandidato(9, 5)).toBeGreaterThan(0)
  })

  it('con el grupo empatado, todos pesan lo mismo', () => {
    // Es el sorteo uniforme: el caso en que ponderar no cambia nada.
    expect(pesoDeCandidato(3, 3)).toBe(pesoDeCandidato(3, 3))
    expect(pesoDeCandidato(0, 0)).toBe(1)
  })
})

describe('elegirPonderado', () => {
  it('sin candidatos devuelve null, que es un resultado normal', () => {
    expect(elegirPonderado([], 0.5)).toBeNull()
  })

  it('con un solo candidato, sale ese', () => {
    expect(elegirPonderado([candidato('a', 4)], 0.9)).toBe('a')
  })

  it('reparte los tramos por peso, en orden', () => {
    // Pesos 3 y 1 sobre un total de 4: el primero se lleva [0, 0.75).
    const dos = [candidato('a', 0), candidato('b', 2)]

    expect(elegirPonderado(dos, 0)).toBe('a')
    expect(elegirPonderado(dos, 0.74)).toBe('a')
    expect(elegirPonderado(dos, 0.76)).toBe('b')
    expect(elegirPonderado(dos, 0.99)).toBe('b')
  })

  it('con todos empatados, los tramos son iguales', () => {
    const tres = [candidato('a', 1), candidato('b', 1), candidato('c', 1)]

    expect(elegirPonderado(tres, 0.1)).toBe('a')
    expect(elegirPonderado(tres, 0.5)).toBe('b')
    expect(elegirPonderado(tres, 0.9)).toBe('c')
  })

  it('un azar en 1 o pasado no se sale del arreglo', () => {
    const dos = [candidato('a', 0), candidato('b', 0)]
    expect(elegirPonderado(dos, 1)).toBe('b')
    expect(elegirPonderado(dos, 5)).toBe('b')
    expect(elegirPonderado(dos, -1)).toBe('a')
  })

  it('sobre muchos tiros, quien menos ha participado sale más', () => {
    // La razón de ser del sorteo ponderado: treinta tiros uniformes repiten, y
    // los niños lo notan antes que nadie.
    const grupo = [candidato('nunca', 0), candidato('siempre', 9)]
    const cuenta = { nunca: 0, siempre: 0 }

    for (let i = 0; i < 1000; i++) {
      const salio = elegirPonderado(grupo, i / 1000)
      if (salio === 'nunca') cuenta.nunca++
      else cuenta.siempre++
    }

    // Pesos 10 y 1: diez a uno.
    expect(cuenta.nunca).toBeGreaterThan(cuenta.siempre * 5)
  })
})
