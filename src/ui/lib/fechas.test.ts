import { describe, expect, it } from 'vitest'

import { comoDiaConAnio, comoDiaConNombre, comoDiaCorto, comoRango } from './fechas'

describe('fechas como se leen', () => {
  it('escribe el día y el mes con letra', () => {
    expect(comoDiaCorto('2026-08-29')).toBe('29 de agosto')
  })

  it('agrega el año cuando se pide', () => {
    expect(comoDiaConAnio('2026-08-29')).toBe('29 de agosto de 2026')
  })

  it('nombra el día de la semana, que es lo que dicta un lector de pantalla', () => {
    expect(comoDiaConNombre('2026-08-29')).toBe('sábado, 29 de agosto')
  })

  // El día se toma de la fecha tal cual y no del instante UTC: sin eso, un
  // '2026-08-29' se leería como el 28 en cualquier máquina al oeste de Greenwich.
  it('no se corre un día por la zona horaria', () => {
    expect(comoDiaCorto('2026-01-01')).toBe('1 de enero')
    expect(comoDiaCorto('2026-12-31')).toBe('31 de diciembre')
  })

  it('en un rango del mismo año, el año se dice una sola vez', () => {
    expect(comoRango('2026-08-26', '2026-11-20')).toBe(
      'del 26 de agosto al 20 de noviembre de 2026',
    )
  })

  it('en un rango que cruza el año, se dicen los dos', () => {
    expect(comoRango('2026-11-24', '2027-03-13')).toBe(
      'del 24 de noviembre de 2026 al 13 de marzo de 2027',
    )
  })
})
