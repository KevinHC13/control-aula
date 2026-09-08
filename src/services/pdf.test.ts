import { describe, expect, it } from 'vitest'

import { construirPdf, type DocumentoPdf, medir, repartirEnLineas } from './pdf'

/**
 * Lo que estas pruebas cuidan es que el archivo **abra**. Un PDF con la tabla de
 * posiciones corrida no se abre a medias: no se abre, y eso no se ve hasta que
 * alguien lo intenta en el iPad.
 *
 * Por eso se lee el archivo generado como texto y se comprueban las posiciones
 * una por una contra dónde está de verdad cada objeto.
 */

const FECHA = new Date(2026, 8, 7, 10, 30, 0)

const texto = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  return Array.from(bytes, (b) => String.fromCharCode(b)).join('')
}

const documento = (bloques: DocumentoPdf['bloques']): DocumentoPdf => ({
  titulo: 'Faltas de la semana',
  subtitulo: 'del 7 al 11 de septiembre de 2026',
  bloques,
})

const TABLA = (cuantas: number): DocumentoPdf['bloques'] => [
  {
    tipo: 'tabla',
    encabezados: { izquierda: 'día', derecha: 'faltas' },
    filas: Array.from({ length: cuantas }, (_, i) => ({
      etiqueta: `Renglón número ${i + 1}`,
      detalle: '1 niño · 1 niña',
      valor: String(i),
    })),
  },
]

describe('construirPdf', () => {
  it('empieza por la firma del formato y termina por su marca de fin', async () => {
    const contenido = await texto(construirPdf(documento(TABLA(3)), FECHA))

    expect(contenido.startsWith('%PDF-1.4')).toBe(true)
    expect(contenido.trimEnd().endsWith('%%EOF')).toBe(true)
  })

  it('la tabla de posiciones apunta a donde está cada objeto', async () => {
    // Es la prueba que de verdad importa: si una posición miente, el lector no
    // abre el archivo y no dice por qué.
    const contenido = await texto(construirPdf(documento(TABLA(4)), FECHA))

    // Desde `\nxref`, no desde `lastIndexOf('xref')`: eso cae en el `startxref`
    // de abajo, que va después de la tabla.
    const xref = contenido.slice(contenido.lastIndexOf('\nxref\n'))
    const posiciones = [...xref.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]))

    expect(posiciones.length).toBeGreaterThan(4)
    posiciones.forEach((posicion, i) => {
      expect(contenido.slice(posicion, posicion + 12)).toContain(`${i + 1} 0 obj`)
    })
  })

  it('startxref apunta al inicio de la tabla', async () => {
    const contenido = await texto(construirPdf(documento(TABLA(2)), FECHA))
    const declarado = Number(/startxref\n(\d+)/.exec(contenido)?.[1])

    expect(contenido.slice(declarado, declarado + 4)).toBe('xref')
  })

  it('el /Length de cada flujo es el que mide de verdad', async () => {
    const contenido = await texto(construirPdf(documento(TABLA(3)), FECHA))

    const flujos = [...contenido.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)endstream/g)]
    expect(flujos.length).toBeGreaterThan(0)
    for (const flujo of flujos) {
      expect(flujo[2]!.length).toBe(Number(flujo[1]))
    }
  })

  it('declara tantas páginas como hijos tiene', async () => {
    const contenido = await texto(construirPdf(documento(TABLA(60)), FECHA))

    const kids = /\/Kids \[([^\]]*)\]/.exec(contenido)?.[1] ?? ''
    const count = Number(/\/Count (\d+)/.exec(contenido)?.[1])

    expect(kids.split('0 R').filter((p) => p.trim() !== '').length).toBe(count)
    // Sesenta renglones no caben en una hoja: si esto da 1, la paginación no
    // está partiendo nada y el resto se está dibujando fuera del papel.
    expect(count).toBeGreaterThan(1)
  })

  it('una tabla larga repite su encabezado en cada página', async () => {
    const contenido = await texto(construirPdf(documento(TABLA(60)), FECHA))
    const veces = [...contenido.matchAll(/\(faltas\)/g)].length

    expect(veces).toBeGreaterThan(1)
  })

  it('nada se dibuja fuera del papel', async () => {
    // Es el defecto que no se ve hasta abrir el archivo: un bloque que descuenta
    // menos alto del que ocupa se sale por abajo, y lo que se sale no existe.
    const contenido = await texto(
      construirPdf(
        documento([
          { tipo: 'cifra', valor: '4', leyenda: 'faltas esta semana', detalle: '2 niños' },
          ...TABLA(40),
          { tipo: 'nota', texto: 'Solo cuenta quien no vino. '.repeat(12) },
        ]),
        FECHA,
      ),
    )

    const posiciones = [...contenido.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/g)]
    expect(posiciones.length).toBeGreaterThan(40)
    for (const [, x, alto] of posiciones) {
      expect(Number(x)).toBeGreaterThanOrEqual(56)
      expect(Number(alto)).toBeGreaterThanOrEqual(0)
      expect(Number(alto)).toBeLessThanOrEqual(841.89)
    }
  })

  it('la cifra grande no se encima con su leyenda', async () => {
    // Una cifra de 26 puntos ocupa hacia arriba desde su línea base, así que la
    // leyenda tiene que ir bastante más abajo que 26 puntos menos su alto.
    const contenido = await texto(
      construirPdf(
        documento([{ tipo: 'cifra', valor: '4', leyenda: 'faltas esta semana' }]),
        FECHA,
      ),
    )

    const cifra = /1 0 0 1 [\d.]+ ([\d.]+) Tm \(4\)/.exec(contenido)
    const leyenda = /1 0 0 1 [\d.]+ ([\d.]+) Tm \(faltas esta semana\)/.exec(contenido)

    expect(Number(cifra?.[1]) - Number(leyenda?.[1])).toBeGreaterThanOrEqual(14)
  })

  it('una lista de nombres larga se parte entre páginas', async () => {
    // Un día en que faltó medio grupo no cabe en lo que queda de hoja. Perderlo
    // sin avisar sería peor que partirlo, y ese es justo el fallo que no se ve
    // hasta abrir el archivo.
    const contenido = await texto(
      construirPdf(
        documento([
          {
            tipo: 'tabla',
            encabezados: { izquierda: 'día', derecha: 'faltas' },
            filas: [
              {
                etiqueta: 'lunes, 7 de septiembre',
                valor: '80',
                lineas: Array.from({ length: 80 }, (_, i) => `${i + 1} · Apellido, Nombre`),
              },
            ],
          },
        ]),
        FECHA,
      ),
    )

    expect(Number(/\/Count (\d+)/.exec(contenido)?.[1])).toBeGreaterThan(1)
    for (const [, , alto] of contenido.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/g)) {
      expect(Number(alto)).toBeGreaterThanOrEqual(0)
    }
  })

  it('los nombres van sangrados, no alineados con el día', async () => {
    const contenido = await texto(
      construirPdf(
        documento([
          {
            tipo: 'tabla',
            encabezados: { izquierda: 'día', derecha: 'faltas' },
            filas: [{ etiqueta: 'lunes', valor: '1', lineas: ['1 · Aguilar, Bruno'] }],
          },
        ]),
        FECHA,
      ),
    )

    const dia = /1 0 0 1 ([\d.]+) [\d.]+ Tm \(lunes\)/.exec(contenido)
    const nombre = /1 0 0 1 ([\d.]+) [\d.]+ Tm \(1 .* Aguilar, Bruno\)/.exec(contenido)

    expect(Number(nombre?.[1])).toBeGreaterThan(Number(dia?.[1]))
  })

  it('un documento corto cabe en una sola página', async () => {
    const contenido = await texto(construirPdf(documento(TABLA(3)), FECHA))

    expect(Number(/\/Count (\d+)/.exec(contenido)?.[1])).toBe(1)
  })

  it('ningún byte se sale de Latin-1, que es lo que corre las posiciones', async () => {
    const blob = construirPdf(
      documento([
        { tipo: 'cifra', valor: '4', leyenda: 'faltas', detalle: '2 niños · 1 niña' },
        { tipo: 'nota', texto: 'Ávila, Núñez, «así» —y un guion largo—. Y un emoji: 🙂' },
      ]),
      FECHA,
    )
    const bytes = new Uint8Array(await blob.arrayBuffer())

    expect(bytes.every((b) => b <= 0xff)).toBe(true)
    expect(bytes.length).toBe((await texto(blob)).length)
  })

  it('los acentos del español se escriben tal cual, no se pierden', async () => {
    const contenido = await texto(
      construirPdf(documento([{ tipo: 'seccion', texto: 'Ávila Núñez' }]), FECHA),
    )

    expect(contenido).toContain('(Ávila Núñez)')
  })

  it('lo que no cabe en Latin-1 se sustituye, no rompe el archivo', async () => {
    const contenido = await texto(
      construirPdf(documento([{ tipo: 'seccion', texto: 'Hola 🙂' }]), FECHA),
    )

    expect(contenido).toContain('(Hola ?)')
  })

  it('escapa los tres caracteres que significan algo dentro de un literal', async () => {
    const contenido = await texto(
      construirPdf(documento([{ tipo: 'seccion', texto: 'a(b)c\\d' }]), FECHA),
    )

    expect(contenido).toContain('(a\\(b\\)c\\\\d)')
  })

  it('el título viaja a las propiedades del archivo', async () => {
    const contenido = await texto(construirPdf(documento([]), FECHA))

    expect(contenido).toContain('/Title (Faltas de la semana)')
    expect(contenido).toContain('/CreationDate (D:20260907103000)')
  })

  it('un documento sin bloques no falla: es una hoja con su encabezado', async () => {
    const contenido = await texto(construirPdf(documento([]), FECHA))

    expect(Number(/\/Count (\d+)/.exec(contenido)?.[1])).toBe(1)
    expect(contenido).toContain('(Faltas de la semana)')
  })
})

describe('medir', () => {
  it('mide en puntos, proporcional al tamaño', () => {
    // La «i» es angosta y la «M» ancha: si midieran igual, la columna de la
    // derecha saldría corrida y nadie sabría por qué.
    expect(medir('i', 10)).toBeLessThan(medir('M', 10))
    expect(medir('hola', 20)).toBeCloseTo(medir('hola', 10) * 2, 5)
  })

  it('una letra acentuada mide lo mismo que su letra', () => {
    expect(medir('á', 11)).toBe(medir('a', 11))
    expect(medir('ñ', 11)).toBe(medir('n', 11))
  })

  it('la negrita no mide igual que la normal', () => {
    expect(medir('Faltas', 11, true)).toBeGreaterThan(medir('Faltas', 11))
  })

  it('el vacío mide cero', () => {
    expect(medir('', 11)).toBe(0)
  })
})

describe('repartirEnLineas', () => {
  it('corta por palabras, sin partir ninguna', () => {
    const lineas = repartirEnLineas('uno dos tres cuatro cinco seis siete', 60, 9)

    expect(lineas.length).toBeGreaterThan(1)
    expect(lineas.join(' ')).toBe('uno dos tres cuatro cinco seis siete')
  })

  it('lo que cabe en un renglón se queda en uno', () => {
    expect(repartirEnLineas('uno dos', 400, 9)).toEqual(['uno dos'])
  })

  it('una palabra más larga que el renglón sale entera, no partida', () => {
    expect(repartirEnLineas('anticonstitucionalmente', 10, 9)).toEqual([
      'anticonstitucionalmente',
    ])
  })

  it('un texto vacío no da ningún renglón', () => {
    expect(repartirEnLineas('   ', 100, 9)).toEqual([])
  })
})
