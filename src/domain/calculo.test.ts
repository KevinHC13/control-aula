import { describe, expect, it } from 'vitest'

import {
  aBase10,
  calificacionDeCriterio,
  calificacionDeTrimestre,
  comoCalificacion,
  valorConRubrica,
  valorCriterio,
  valorDeEvaluacion,
  valorExamenGeneral,
  valorExamenPorCampo,
  valorSinRubrica,
} from './calculo'
import type { Nivel } from './values'

const EXCELENTE: Nivel = 0
const BIEN: Nivel = 1
const REGULAR: Nivel = 2
const MAL: Nivel = 3

describe('valorConRubrica', () => {
  it('todo en Excelente da 10.0', () => {
    expect(comoCalificacion(valorConRubrica([EXCELENTE, EXCELENTE]))).toBe('10.0')
  })

  it('todo en Bien da 8.3', () => {
    expect(comoCalificacion(valorConRubrica([BIEN, BIEN, BIEN]))).toBe('8.3')
  })

  it('todo en Regular da 6.7', () => {
    expect(comoCalificacion(valorConRubrica([REGULAR, REGULAR]))).toBe('6.7')
  })

  it('todo en Mal da 0.0, no un piso de 5', () => {
    expect(comoCalificacion(valorConRubrica([MAL, MAL, MAL, MAL]))).toBe('0.0')
  })

  it('tres Excelente y un Mal queda por debajo de todo en Bien', () => {
    // El acantilado de «Mal» es deliberado: codifica que el trabajo no vale nada,
    // no que valga poco (docs/DATA-MODEL.md).
    const mezcla = valorConRubrica([EXCELENTE, EXCELENTE, EXCELENTE, MAL])
    expect(comoCalificacion(mezcla)).toBe('7.5')
    expect(mezcla!).toBeLessThan(valorConRubrica([BIEN, BIEN, BIEN, BIEN])!)
  })

  it('usa el valor del nivel, no su índice', () => {
    // Con el índice, «Excelente» (0) valdría cero y «Mal» (3) lo máximo.
    expect(valorConRubrica([EXCELENTE])).toBe(1)
    expect(valorConRubrica([MAL])).toBe(0)
  })

  it('sin renglones no hay valor: null, nunca 0', () => {
    expect(valorConRubrica([])).toBeNull()
  })

  it('no redondea', () => {
    expect(valorConRubrica([BIEN])).toBeCloseTo(2.5 / 3, 12)
  })
})

describe('valorDeEvaluacion', () => {
  it('con todos los renglones calificados devuelve el promedio', () => {
    expect(
      comoCalificacion(valorDeEvaluacion({ a: BIEN, b: BIEN }, ['a', 'b'])),
    ).toBe('8.3')
  })

  it('una captura a medias no produce calificación', () => {
    // Se excluye, igual que una actividad sin ningún registro: promediar tres
    // renglones de cuatro daría un número que se ve final sacado de menos
    // evidencia que el de los demás.
    expect(valorDeEvaluacion({ a: EXCELENTE }, ['a', 'b'])).toBeNull()
  })

  it('sin nada capturado tampoco', () => {
    expect(valorDeEvaluacion({}, ['a'])).toBeNull()
  })

  it('el nivel de un renglón que ya no existe no completa ni cuenta', () => {
    expect(valorDeEvaluacion({ a: EXCELENTE, viejo: MAL }, ['a', 'b'])).toBeNull()
    expect(valorDeEvaluacion({ a: EXCELENTE, viejo: MAL }, ['a'])).toBe(1)
  })

  it('respeta el orden de los renglones vivos, no el del mapa', () => {
    // El promedio no depende del orden, pero sí de que se lean los renglones
    // vivos: si se leyera el mapa, un renglón borrado entraría al cálculo.
    expect(valorDeEvaluacion({ b: MAL, a: EXCELENTE }, ['a', 'b'])).toBe(0.5)
  })
})

describe('valorSinRubrica', () => {
  it('entregada vale todo y no entregada vale nada', () => {
    expect(valorSinRubrica(true)).toBe(1)
    expect(valorSinRubrica(false)).toBe(0)
    expect(comoCalificacion(valorSinRubrica(false))).toBe('0.0')
  })
})

describe('valorCriterio', () => {
  it('es el promedio simple de sus actividades', () => {
    expect(valorCriterio([1, 0])).toBe(0.5)
  })

  it('sin actividades devuelve null, nunca 0', () => {
    expect(valorCriterio([])).toBeNull()
  })
})

describe('calificacionDeCriterio', () => {
  // El ejemplo de docs/DATA-MODEL.md: dos actividades de Lenguajes sin rúbrica
  // —una entregada y otra no— y una de Saberes con rúbrica en Bien, Excelente,
  // Regular, Bien.
  const conRubrica = valorConRubrica([BIEN, EXCELENTE, REGULAR, BIEN])!
  const actividades = [
    { campo: 'lenguajes' as const, valor: valorSinRubrica(true) },
    { campo: 'lenguajes' as const, valor: valorSinRubrica(false) },
    { campo: 'saberes_pensamiento_cientifico' as const, valor: conRubrica },
  ]

  it('reproduce el ejemplo del modelo de datos', () => {
    const { general, porCampo } = calificacionDeCriterio(actividades)
    expect(comoCalificacion(porCampo.lenguajes ?? null)).toBe('5.0')
    expect(comoCalificacion(porCampo.saberes_pensamiento_cientifico ?? null)).toBe('8.3')
    expect(comoCalificacion(general)).toBe('6.1')
  })

  it('el general NO es el promedio de los promedios por campo', () => {
    const { general, porCampo } = calificacionDeCriterio(actividades)
    const promedioDeLosPromedios =
      ((porCampo.lenguajes ?? 0) + (porCampo.saberes_pensamiento_cientifico ?? 0)) / 2

    // 0.611 contra 0.667: el campo con dos actividades pesa el doble, y así debe
    // ser —todas las actividades del criterio valen lo mismo—.
    expect(general).toBeCloseTo(0.6111, 4)
    expect(comoCalificacion(promedioDeLosPromedios)).toBe('6.7')
    expect(general).not.toBeCloseTo(promedioDeLosPromedios, 4)
  })

  it('un campo con seis actividades pesa el triple que uno con dos', () => {
    const seis = Array.from({ length: 6 }, () => ({
      campo: 'lenguajes' as const,
      valor: 1,
    }))
    const dos = Array.from({ length: 2 }, () => ({
      campo: 'humano_comunitario' as const,
      valor: 0,
    }))

    expect(calificacionDeCriterio([...seis, ...dos]).general).toBe(0.75)
  })

  it('solo aparecen los campos con actividades', () => {
    const { porCampo } = calificacionDeCriterio([{ campo: 'lenguajes', valor: 1 }])
    expect(Object.keys(porCampo)).toEqual(['lenguajes'])
  })

  it('sin actividades, el general es null y no hay campos', () => {
    expect(calificacionDeCriterio([])).toEqual({ general: null, porCampo: {} })
  })
})

describe('valorExamenPorCampo', () => {
  it('es aciertos sobre preguntas', () => {
    expect(comoCalificacion(valorExamenPorCampo(18, 20))).toBe('9.0')
  })

  it('cero aciertos es un dato: 0.0, no null', () => {
    expect(valorExamenPorCampo(0, 20)).toBe(0)
    expect(comoCalificacion(valorExamenPorCampo(0, 20))).toBe('0.0')
  })

  it('sin captura no hay valor', () => {
    expect(valorExamenPorCampo(undefined, 20)).toBeNull()
  })

  it('sin preguntas no hay división', () => {
    expect(valorExamenPorCampo(0, 0)).toBeNull()
  })
})

describe('valorExamenGeneral', () => {
  it('usa aciertos totales sobre preguntas totales', () => {
    // 27 de 50, no el promedio de 60% y 46.7%.
    const valor = valorExamenGeneral(
      { lenguajes: 18, saberes_pensamiento_cientifico: 9 },
      { lenguajes: 30, saberes_pensamiento_cientifico: 20 },
    )
    expect(valor).toBeCloseTo(27 / 50, 12)
    expect(comoCalificacion(valor)).toBe('5.4')
  })

  it('un campo con más preguntas pesa más', () => {
    const totales = valorExamenGeneral(
      { lenguajes: 30, humano_comunitario: 0 },
      { lenguajes: 30, humano_comunitario: 10 },
    )
    // Por totales: 30 de 40 = 7.5. Promediando campos daría 5.0.
    expect(comoCalificacion(totales)).toBe('7.5')
  })

  it('un examen a medias no produce calificación', () => {
    expect(
      valorExamenGeneral({ lenguajes: 18 }, { lenguajes: 20, humano_comunitario: 10 }),
    ).toBeNull()
  })

  it('los campos sin preguntas no estorban', () => {
    expect(
      comoCalificacion(valorExamenGeneral({ lenguajes: 10 }, { lenguajes: 20, humano_comunitario: 0 })),
    ).toBe('5.0')
  })

  it('sin preguntas en ningún campo devuelve null', () => {
    expect(valorExamenGeneral({}, {})).toBeNull()
  })
})

describe('calificacionDeTrimestre', () => {
  it('pondera por los pesos', () => {
    const { valor, pesoConsiderado } = calificacionDeTrimestre([
      { peso: 40, valor: 1 },
      { peso: 30, valor: 0.5 },
      { peso: 30, valor: 0 },
    ])
    expect(pesoConsiderado).toBe(100)
    expect(comoCalificacion(valor)).toBe('5.5')
  })

  it('normaliza sobre los pesos que sí aportan', () => {
    // A mitad del trimestre, con solo Tareas capturado al 100%, el alumno lleva
    // 10.0 de lo que se ha calificado. Sin normalizar saldría 4.0.
    const { valor, pesoConsiderado } = calificacionDeTrimestre([
      { peso: 40, valor: 1 },
      { peso: 60, valor: null },
    ])
    expect(comoCalificacion(valor)).toBe('10.0')
    expect(pesoConsiderado).toBe(40)
  })

  it('con todos los criterios capturados, normalizar no cambia nada', () => {
    const pesos = [
      { peso: 50, valor: 0.8 },
      { peso: 50, valor: 0.6 },
    ]
    const sinNormalizar = pesos.reduce((acc, p) => acc + (p.valor ?? 0) * (p.peso / 100), 0)
    expect(calificacionDeTrimestre(pesos).valor).toBeCloseTo(sinNormalizar, 12)
  })

  it('un peso de 0 no aporta aunque tenga valor', () => {
    const { valor, pesoConsiderado } = calificacionDeTrimestre([
      { peso: 0, valor: 1 },
      { peso: 100, valor: 0.5 },
    ])
    expect(valor).toBe(0.5)
    expect(pesoConsiderado).toBe(100)
  })

  it('sin nada capturado no hay calificación, y se dice sobre cuánto', () => {
    expect(calificacionDeTrimestre([{ peso: 100, valor: null }])).toEqual({
      valor: null,
      pesoConsiderado: 0,
    })
    expect(calificacionDeTrimestre([])).toEqual({ valor: null, pesoConsiderado: 0 })
  })

  it('funciona con pesos que todavía no suman 100', () => {
    // Los pesos solo tienen que cerrar para cerrar el trimestre; mientras se
    // editan, cualquier suma es válida.
    const { valor, pesoConsiderado } = calificacionDeTrimestre([
      { peso: 20, valor: 1 },
      { peso: 20, valor: 0 },
    ])
    expect(valor).toBe(0.5)
    expect(pesoConsiderado).toBe(40)
  })
})

describe('aBase10 y comoCalificacion', () => {
  it('aBase10 no redondea: es el único paso que puede no hacerlo', () => {
    expect(aBase10(2.5 / 3)).toBeCloseTo(8.3333, 4)
  })

  it('presenta con un decimal', () => {
    expect(comoCalificacion(2.5 / 3)).toBe('8.3')
    expect(comoCalificacion(0.86)).toBe('8.6')
    expect(comoCalificacion(0.84)).toBe('8.4')
  })

  it('no hay piso de escala: menos de 5 se muestra tal cual', () => {
    expect(comoCalificacion(0.3)).toBe('3.0')
    expect(comoCalificacion(0)).toBe('0.0')
  })

  it('sin dato muestra una raya, no un cero', () => {
    expect(comoCalificacion(null)).toBe('—')
  })

  it('nunca muestra el porcentaje', () => {
    // La cifra que ve la maestra es base 10; el porcentaje solo existe como peso.
    expect(comoCalificacion(0.611)).toBe('6.1')
  })
})
