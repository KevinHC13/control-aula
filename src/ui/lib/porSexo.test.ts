import { describe, expect, it } from 'vitest'

import { frasePorSexo } from './porSexo'

describe('frasePorSexo', () => {
  it('dice las tres partes cuando las hay', () => {
    expect(frasePorSexo({ ninos: 2, ninas: 3, sinAsignar: 1 })).toBe(
      '2 niños · 3 niñas · 1 sin asignar',
    )
  })

  it('concuerda el singular', () => {
    expect(frasePorSexo({ ninos: 1, ninas: 1, sinAsignar: 0 })).toBe('1 niño · 1 niña')
  })

  it('omite las partes en cero y no deja un separador suelto', () => {
    expect(frasePorSexo({ ninos: 1, ninas: 0, sinAsignar: 0 })).toBe('1 niño')
    expect(frasePorSexo({ ninos: 0, ninas: 2, sinAsignar: 0 })).toBe('2 niñas')
  })

  it('el que no tiene sexo se dice aparte, no se reparte', () => {
    expect(frasePorSexo({ ninos: 0, ninas: 0, sinAsignar: 3 })).toBe('3 sin asignar')
  })

  it('sin nadie devuelve vacío, para poder esconder la línea', () => {
    expect(frasePorSexo({ ninos: 0, ninas: 0, sinAsignar: 0 })).toBe('')
  })
})
