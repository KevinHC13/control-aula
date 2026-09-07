import { describe, expect, it } from 'vitest'

import type { Alumno } from './entities'
import { porNombre } from './orden'

// Nombres inventados: en el repositorio no va un solo nombre real del salón.
const alumno = (numero_lista: number, nombre: string): Alumno => ({
  id: `alumno-${numero_lista}`,
  ciclo_id: null,
  nombre,
  numero_lista,
  fecha_nacimiento: null,
  curp: null,
  sexo: null,
  updated_at: '2026-09-07T08:00:00.000Z',
  deleted_at: null,
})

const ordenados = (grupo: Alumno[]): string[] =>
  [...grupo].sort(porNombre).map((a) => a.nombre)

describe('porNombre', () => {
  it('ordena por apellido y no por número de lista', () => {
    expect(
      ordenados([
        alumno(3, 'Cruz Herrera, Regina'),
        alumno(1, 'Aguilar Mendoza, Bruno'),
        alumno(2, 'Barrera Solís, Diego'),
      ]),
    ).toEqual(['Aguilar Mendoza, Bruno', 'Barrera Solís, Diego', 'Cruz Herrera, Regina'])
  })

  it('el que se dio de alta después va donde le toca, no al final', () => {
    expect(
      ordenados([
        alumno(1, 'Aguilar Mendoza, Bruno'),
        alumno(2, 'Cruz Herrera, Regina'),
        alumno(39, 'Aguirre Nava, Zoe'),
      ]),
    ).toEqual(['Aguilar Mendoza, Bruno', 'Aguirre Nava, Zoe', 'Cruz Herrera, Regina'])
  })

  it('un apellido acentuado va donde suena, no después de la Z', () => {
    expect(
      ordenados([
        alumno(1, 'Barrera Solís, Diego'),
        alumno(2, 'Ávila Ponce, Mariana'),
        alumno(3, 'Aguilar Mendoza, Bruno'),
      ]),
    ).toEqual(['Aguilar Mendoza, Bruno', 'Ávila Ponce, Mariana', 'Barrera Solís, Diego'])
  })

  it('la eñe va entre la ene y la o, como en español', () => {
    expect(
      ordenados([
        alumno(1, 'Ordaz Lima, Sofía'),
        alumno(2, 'Núñez Vega, Emilio'),
        alumno(3, 'Nava Ríos, Paula'),
      ]),
    ).toEqual(['Nava Ríos, Paula', 'Núñez Vega, Emilio', 'Ordaz Lima, Sofía'])
  })

  it('no le importan las mayúsculas: una lista a gritos se ordena igual', () => {
    expect(
      ordenados([
        alumno(1, 'CRUZ HERRERA, REGINA'),
        alumno(2, 'aguilar mendoza, bruno'),
      ]),
    ).toEqual(['aguilar mendoza, bruno', 'CRUZ HERRERA, REGINA'])
  })

  it('dos homónimos desempatan por número, para no bailar entre lecturas', () => {
    const primero = alumno(7, 'Cruz Herrera, Regina')
    const segundo = alumno(22, 'Cruz Herrera, Regina')

    expect(porNombre(segundo, primero)).toBeGreaterThan(0)
    expect(porNombre(primero, segundo)).toBeLessThan(0)
    expect([segundo, primero].sort(porNombre).map((a) => a.numero_lista)).toEqual([7, 22])
  })
})
