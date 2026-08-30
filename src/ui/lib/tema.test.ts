import { describe, expect, it } from 'vitest'

import {
  ajustarParaContraste,
  colorDe,
  COLORES,
  contraste,
  escalaDe,
  esHexValido,
  fondoDe,
  leerApariencia,
  LINEAS,
  marcaDe,
  normalizarHex,
  PAPELES,
  POR_OMISION,
  PROPIO,
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
      propio: '#1b4f9c',
      modo: 'claro' as const,
      tamano: 'grande' as const,
      papel: 'amarillo' as const,
      lineas: 'renglones' as const,
      nombreDelGrupo: '3.º B',
    }

    expect(leerApariencia(JSON.stringify(guardada))).toEqual(guardada)
  })

  it('recorta un nombre de grupo desmedido en vez de rechazarlo', () => {
    const leido = leerApariencia(JSON.stringify({ nombreDelGrupo: 'a'.repeat(500) }))
    expect(leido.nombreDelGrupo.length).toBe(40)
  })

  it('un color libre corrupto cae al de siempre, sin tocar lo demás', () => {
    const leido = leerApariencia(JSON.stringify({ color: PROPIO, propio: 'no-es-color' }))

    expect(leido.color).toBe(PROPIO)
    expect(leido.propio).toBe(POR_OMISION.propio)
  })
})

// El fondo pasó de un interruptor a tres opciones. Quien ya tenía una preferencia
// guardada no la pierde.
describe('la preferencia vieja del fondo se migra sola', () => {
  it('el interruptor encendido era la cuadrícula', () => {
    expect(leerApariencia(JSON.stringify({ cuadricula: true })).lineas).toBe('cuadricula')
  })

  it('el interruptor apagado era sin líneas', () => {
    expect(leerApariencia(JSON.stringify({ cuadricula: false })).lineas).toBe('ninguna')
  })

  it('lo nuevo gana sobre lo viejo si están los dos', () => {
    const leido = leerApariencia(JSON.stringify({ cuadricula: false, lineas: 'renglones' }))
    expect(leido.lineas).toBe('renglones')
  })
})

describe('leer un color escrito a mano', () => {
  it('acepta las formas en que una persona lo teclea', () => {
    expect(normalizarHex('#1B4F9C')).toBe('#1b4f9c')
    expect(normalizarHex('1b4f9c')).toBe('#1b4f9c')
    expect(normalizarHex('  #F0A  ')).toBe('#ff00aa')
  })

  it('rechaza lo que no es un color', () => {
    for (const malo of ['', 'azul', '#12345', '#gggggg', '#1b4f9c9']) {
      expect(normalizarHex(malo), malo).toBeNull()
      expect(esHexValido(malo), malo).toBe(false)
    }
  })
})

describe('el contraste', () => {
  it('negro contra blanco es el máximo, y un color contra sí mismo el mínimo', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contraste('#1b4f9c', '#1b4f9c')).toBeCloseTo(1, 5)
  })

  it('no depende del orden', () => {
    expect(contraste('#1b4f9c', '#fbfaf7')).toBeCloseTo(contraste('#fbfaf7', '#1b4f9c'), 5)
  })

  // Es la razón de no usar la «claridad» de HSL: los dos tienen L = 50 % y el
  // amarillo es mucho más luminoso. Ajustar por claridad dejaría pasar un amarillo
  // ilegible con texto blanco encima.
  it('distingue un amarillo de un azul que HSL considera igual de claros', () => {
    expect(contraste('#ffff00', '#ffffff')).toBeLessThan(1.2)
    expect(contraste('#0000ff', '#ffffff')).toBeGreaterThan(8)
  })
})

describe('ningún color elegido puede volver ilegible la pantalla', () => {
  const PAPEL_CLARO = '#fbfaf7'
  const PAPEL_OSCURO = '#15181b'

  it('deja en paz un color que ya contrasta', () => {
    expect(ajustarParaContraste('#1b4f9c', PAPEL_CLARO)).toBe('#1b4f9c')
  })

  it('oscurece lo justo un color demasiado claro para el papel', () => {
    const ajustado = ajustarParaContraste('#ffff00', PAPEL_CLARO)
    expect(contraste(ajustado, PAPEL_CLARO)).toBeGreaterThanOrEqual(4.5)
  })

  it('aclara un color demasiado oscuro para el fondo oscuro', () => {
    const ajustado = ajustarParaContraste('#1b4f9c', PAPEL_OSCURO)
    expect(contraste(ajustado, PAPEL_OSCURO)).toBeGreaterThanOrEqual(4.5)
  })

  // Lo importante es que sigue siendo el color que se pidió: quien elige amarillo
  // obtiene un amarillo, no un gris ni un café.
  it('conserva el tono al ajustarlo', () => {
    const ajustado = ajustarParaContraste('#ffff00', PAPEL_CLARO)
    const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(ajustado.slice(i, i + 2), 16))

    expect(r).toBeGreaterThan(b!)
    expect(g).toBeGreaterThan(b!)
  })

  // La prueba que de verdad importa: **cualquier** color, en **cualquier** papel y
  // en los dos modos, termina legible. Sin esto, ofrecer un color libre sería
  // ofrecer una manera de romper la aplicación.
  it('cualquier color del espectro queda legible, en los dos papeles y los dos modos', () => {
    const extremos = [
      '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
      '#ffff00', '#00ffff', '#ff00ff', '#808080', '#fcf3d0',
    ]

    for (const papel of PAPELES) {
      for (const oscuro of [false, true]) {
        const fondo = fondoDe({ ...POR_OMISION, papel: papel.id }, oscuro)

        for (const elegido of extremos) {
          const marca = marcaDe(
            { ...POR_OMISION, papel: papel.id, color: PROPIO, propio: elegido },
            oscuro,
          )
          expect(
            contraste(marca, fondo),
            `${elegido} sobre papel ${papel.id} en ${oscuro ? 'oscuro' : 'claro'}`,
          ).toBeGreaterThanOrEqual(4.5)
        }
      }
    }
  })
})

describe('el color', () => {
  it('cae en el de siempre si el guardado ya no está en la lista', () => {
    expect(colorDe({ ...POR_OMISION, color: 'inventado' })).toBe(COLORES[0])
  })

  // El azul de la marca nace valiendo el azul del bicolor: sin elegir nada, la
  // aplicación se ve exactamente como se veía antes de que esto existiera.
  it('el de siempre es el azul del lápiz bicolor', () => {
    expect(marcaDe(POR_OMISION, false)).toBe('#1b4f9c')
  })

  it('todos los de la lista traen los dos tonos, y ninguno repite el identificador', () => {
    for (const color of COLORES) {
      expect(color.claro, color.id).toMatch(/^#[0-9a-f]{6}$/)
      expect(color.oscuro, color.id).toMatch(/^#[0-9a-f]{6}$/)
    }
    expect(new Set(COLORES.map((c) => c.id)).size).toBe(COLORES.length)
  })

  // Los seis están escogidos a mano; esto es lo que avisa si alguien retoca uno.
  it('los seis de la lista contrastan con el papel de los dos modos', () => {
    for (const color of COLORES) {
      expect(contraste(color.claro, '#fbfaf7'), color.id).toBeGreaterThanOrEqual(4.5)
      expect(contraste(color.oscuro, '#15181b'), color.id).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('el papel', () => {
  it('el amarillo es más cálido que el blanco y sigue siendo papel', () => {
    const amarillo = fondoDe({ ...POR_OMISION, papel: 'amarillo' }, false)
    const [r, , b] = [1, 3, 5].map((i) => Number.parseInt(amarillo.slice(i, i + 2), 16))

    expect(r).toBeGreaterThan(b!)
    // La tinta tiene que seguir leyéndose encima, que es para lo que sirve el papel.
    expect(contraste(amarillo, '#1e2124')).toBeGreaterThanOrEqual(4.5)
  })

  it('en oscuro los dos papeles son oscuros', () => {
    for (const papel of PAPELES) {
      const fondo = fondoDe({ ...POR_OMISION, papel: papel.id }, true)
      expect(contraste(fondo, '#eceef0'), papel.id).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('las tres opciones de líneas tienen nombre', () => {
    expect(LINEAS.map((l) => l.id)).toEqual(['ninguna', 'cuadricula', 'renglones'])
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
