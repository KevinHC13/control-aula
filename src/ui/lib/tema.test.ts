import { describe, expect, it } from 'vitest'

import {
  colorDe,
  COLORES,
  escalaDe,
  leerApariencia,
  POR_OMISION,
  tocaOscuro,
} from './tema'

describe('lo guardado nunca deja la aplicación sin color', () => {
  it('sin nada guardado, la apariencia de siempre', () => {
    expect(leerApariencia(null)).toEqual(POR_OMISION)
    expect(leerApariencia('')).toEqual(POR_OMISION)
  })

  it('con basura que no es JSON', () => {
    expect(leerApariencia('{{{')).toEqual(POR_OMISION)
    expect(leerApariencia('no soy json')).toEqual(POR_OMISION)
  })

  it('con un JSON que no es un objeto', () => {
    expect(leerApariencia('42')).toEqual(POR_OMISION)
    expect(leerApariencia('null')).toEqual(POR_OMISION)
    expect(leerApariencia('["azul"]')).toEqual(POR_OMISION)
  })

  // El caso de una versión futura que quitó un color, o de alguien que editó
  // localStorage a mano: el campo malo cae solo y los demás sobreviven.
  it('un campo inválido no se lleva a los demás', () => {
    const leido = leerApariencia(
      JSON.stringify({ color: 'fucsia', modo: 'oscuro', tamano: 'gigante' }),
    )

    expect(leido.color).toBe(POR_OMISION.color)
    expect(leido.tamano).toBe(POR_OMISION.tamano)
    expect(leido.modo).toBe('oscuro')
  })

  it('lee entera una apariencia válida', () => {
    const guardada = {
      color: 'vino',
      modo: 'claro' as const,
      tamano: 'grande' as const,
      cuadricula: false,
      nombreDelGrupo: '3.º B',
    }

    expect(leerApariencia(JSON.stringify(guardada))).toEqual(guardada)
  })

  it('recorta un nombre de grupo desmedido en vez de rechazarlo', () => {
    const leido = leerApariencia(JSON.stringify({ nombreDelGrupo: 'a'.repeat(500) }))
    expect(leido.nombreDelGrupo.length).toBe(40)
  })
})

describe('el color', () => {
  it('cae en el de siempre si el guardado ya no está en la lista', () => {
    expect(colorDe({ ...POR_OMISION, color: 'inventado' })).toBe(COLORES[0])
  })

  // El azul de la marca nace valiendo el azul del bicolor: sin elegir nada, la
  // aplicación se ve exactamente como se veía antes de que esto existiera.
  it('el de siempre es el azul del lápiz bicolor', () => {
    expect(colorDe(POR_OMISION).claro).toBe('#1b4f9c')
  })

  it('todos traen los dos tonos, y ninguno repite el identificador', () => {
    for (const color of COLORES) {
      expect(color.claro, color.id).toMatch(/^#[0-9a-f]{6}$/)
      expect(color.oscuro, color.id).toMatch(/^#[0-9a-f]{6}$/)
    }
    expect(new Set(COLORES.map((c) => c.id)).size).toBe(COLORES.length)
  })
})

describe('cuándo toca pintar oscuro', () => {
  it('el modo elegido manda sobre lo que diga el dispositivo', () => {
    expect(tocaOscuro({ ...POR_OMISION, modo: 'oscuro' }, false)).toBe(true)
    expect(tocaOscuro({ ...POR_OMISION, modo: 'claro' }, true)).toBe(false)
  })

  it('«según el iPad» sigue al dispositivo', () => {
    expect(tocaOscuro({ ...POR_OMISION, modo: 'sistema' }, true)).toBe(true)
    expect(tocaOscuro({ ...POR_OMISION, modo: 'sistema' }, false)).toBe(false)
  })
})

describe('el tamaño de texto', () => {
  // Nunca por debajo del 100 %: 16 px es el piso que evita el zoom automático de
  // Safari al enfocar un campo. Este ajuste solo puede subir.
  it('nunca encoge', () => {
    const escalas = (['normal', 'grande', 'mayor'] as const).map((tamano) =>
      Number.parseFloat(escalaDe({ ...POR_OMISION, tamano })),
    )

    expect(escalas).toEqual([100, 112.5, 125])
  })
})
