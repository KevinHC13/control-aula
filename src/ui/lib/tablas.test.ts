import { describe, expect, it } from 'vitest'

import { resumirPorTabla } from './tablas'

describe('el resumen de lo guardado', () => {
  it('traduce el nombre de la tabla a lo que guarda', () => {
    expect(resumirPorTabla({ alumnos: 30 })).toEqual([{ etiqueta: 'Alumnos', cuantas: 30 }])
  })

  // Las tres formas de calificar son «calificaciones» para quien lee: nadie tiene
  // un `eval_rubrica`.
  it('suma las tres formas de calificar en un solo renglón', () => {
    expect(
      resumirPorTabla({ entregas: 30, eval_rubrica: 90, resultados_examen: 30 }),
    ).toEqual([{ etiqueta: 'Calificaciones', cuantas: 150 }])
  })

  it('junta las ocho tablas de configuración', () => {
    const resumen = resumirPorTabla({ ciclos: 1, trimestres: 3, criterios: 5, rubricas: 2 })
    expect(resumen).toEqual([{ etiqueta: 'Configuración de la evaluación', cuantas: 11 }])
  })

  // Siete renglones en cero esconden los dos que importan.
  it('no enseña lo que está en cero', () => {
    expect(resumirPorTabla({ alumnos: 30, asistencia: 0, bitacora: 0 })).toEqual([
      { etiqueta: 'Alumnos', cuantas: 30 },
    ])
  })

  it('sin nada que contar, no hay renglones', () => {
    expect(resumirPorTabla({})).toEqual([])
    expect(resumirPorTabla({ alumnos: 0 })).toEqual([])
  })

  // Si el esquema crece y esto no, más vale un renglón genérico que un total que
  // no cuadra con la suma de lo que se enseña.
  it('una tabla que no conoce no desaparece: se suma aparte', () => {
    expect(resumirPorTabla({ alumnos: 30, tabla_del_futuro: 7 })).toEqual([
      { etiqueta: 'Alumnos', cuantas: 30 },
      { etiqueta: 'Otra información', cuantas: 7 },
    ])
  })

  it('el resumen suma exactamente lo mismo que el conteo', () => {
    const conteo = {
      alumnos: 30,
      asistencia: 600,
      entregas: 90,
      eval_rubrica: 120,
      ciclos: 1,
      trimestres: 3,
      loQueSea: 4,
    }
    const total = Object.values(conteo).reduce((a, b) => a + b, 0)

    expect(resumirPorTabla(conteo).reduce((a, r) => a + r.cuantas, 0)).toBe(total)
  })
})
