import { describe, expect, it } from 'vitest'

import { plural } from './plural'

describe('plural', () => {
  it('uno lleva el singular', () => {
    // Es el caso que salió mal en el navegador: «1 días · 1 faltas».
    expect(plural(1, 'día', 'días')).toBe('día')
    expect(plural(1, 'falta', 'faltas')).toBe('falta')
  })

  it('cero lleva el plural, como en español', () => {
    // «0 días», no «0 día».
    expect(plural(0, 'día', 'días')).toBe('días')
  })

  it('más de uno lleva el plural', () => {
    expect(plural(2, 'día', 'días')).toBe('días')
    expect(plural(30, 'alumno', 'alumnos')).toBe('alumnos')
  })
})
