import { describe, expect, it } from 'vitest'

import { aDatosAlumno, normalizarExtraccion } from './importacion'

const problema = (crudo: Parameters<typeof normalizarExtraccion>[0]) =>
  normalizarExtraccion(crudo).map((f) => f.problema)

describe('normalizarExtraccion', () => {
  it('limpia los espacios que deja un OCR de tabla', () => {
    const [fila] = normalizarExtraccion([
      { nombre: '  Gómez  Pérez,   Ana Sofía ', numero_lista: 1, fecha_nacimiento: '2015-03-15' },
    ])

    expect(fila?.nombre).toBe('Gómez Pérez, Ana Sofía')
    expect(fila?.problema).toBeUndefined()
  })

  it('numera por orden de aparición al que no trae número', () => {
    const filas = normalizarExtraccion([
      { nombre: 'Aguilar, Bruno' },
      { nombre: 'Bautista, Carla' },
      { nombre: 'Cruz, Diego' },
    ])

    expect(filas.map((f) => f.numero_lista)).toEqual([1, 2, 3])
    expect(filas.map((f) => f.problema)).toEqual([undefined, undefined, undefined])
  })

  it('marca el nombre vacío', () => {
    expect(problema([{ nombre: '   ', numero_lista: 1 }])).toEqual(['Falta el nombre'])
    expect(problema([{ numero_lista: 1 }])).toEqual(['Falta el nombre'])
  })

  it('marca los dos lados de un número repetido, no solo el segundo', () => {
    // Que se marquen ambos importa: la maestra no sabría cuál corregir.
    expect(
      problema([
        { nombre: 'Aguilar, Bruno', numero_lista: 7 },
        { nombre: 'Bautista, Carla', numero_lista: 7 },
        { nombre: 'Cruz, Diego', numero_lista: 8 },
      ]),
    ).toEqual(['Número de lista repetido', 'Número de lista repetido', undefined])
  })

  it('marca un número que no es un entero positivo', () => {
    expect(problema([{ nombre: 'Aguilar, Bruno', numero_lista: 0 }])).toEqual([
      'El número de lista no es válido',
    ])
    expect(problema([{ nombre: 'Aguilar, Bruno', numero_lista: -3 }])).toEqual([
      'El número de lista no es válido',
    ])
  })

  it('marca la fecha en formato del documento en vez de adivinar el día y el mes', () => {
    // "12/03/2015" es 12 de marzo o 3 de diciembre según quién la escribió.
    // Adivinar mal una fecha de nacimiento no se nota hasta que ya no importa.
    expect(problema([{ nombre: 'Aguilar, Bruno', numero_lista: 1, fecha_nacimiento: '12/03/2015' }])).toEqual([
      'La fecha debe ser AAAA-MM-DD',
    ])
  })

  it('marca una fecha con el formato bueno pero el día inexistente', () => {
    expect(problema([{ nombre: 'Aguilar, Bruno', numero_lista: 1, fecha_nacimiento: '2015-02-31' }])).toEqual([
      'La fecha debe ser AAAA-MM-DD',
    ])
  })

  it('acepta que falte la fecha: no todas las listas oficiales la traen', () => {
    expect(problema([{ nombre: 'Aguilar, Bruno', numero_lista: 1 }])).toEqual([undefined])
    expect(problema([{ nombre: 'Aguilar, Bruno', numero_lista: 1, fecha_nacimiento: null }])).toEqual([
      undefined,
    ])
  })

  it('una extracción sucia completa marca solo las filas malas', () => {
    const filas = normalizarExtraccion([
      { nombre: 'Aguilar Mendoza,  Bruno', numero_lista: 1, fecha_nacimiento: '2015-01-20' },
      { nombre: '', numero_lista: 2, fecha_nacimiento: '2015-04-02' },
      { nombre: 'Cruz Ríos, Diego', numero_lista: 3, fecha_nacimiento: '12/03/2015' },
      { nombre: 'De la Cruz, Elena', numero_lista: 3, fecha_nacimiento: null },
      { nombre: 'Fuentes, Gabriel', numero_lista: 5 },
    ])

    expect(filas.map((f) => f.problema !== undefined)).toEqual([false, true, true, true, false])
    expect(filas[0]?.nombre).toBe('Aguilar Mendoza, Bruno')
  })

  it('no devuelve la clave `problema` cuando la fila está bien', () => {
    // La pantalla de revisión resalta por presencia de la clave, no por su valor.
    const [fila] = normalizarExtraccion([{ nombre: 'Aguilar, Bruno', numero_lista: 1 }])
    expect(fila && 'problema' in fila).toBe(false)
  })
})

describe('aDatosAlumno', () => {
  it('la fecha vacía se guarda como dato ausente, no como cadena vacía', () => {
    expect(
      aDatosAlumno([
        { nombre: 'Aguilar, Bruno', numero_lista: 1, fecha_nacimiento: '' },
        { nombre: 'Bautista, Carla', numero_lista: 2, fecha_nacimiento: '2015-04-02' },
      ]),
    ).toEqual([
      { nombre: 'Aguilar, Bruno', numero_lista: 1, fecha_nacimiento: null },
      { nombre: 'Bautista, Carla', numero_lista: 2, fecha_nacimiento: '2015-04-02' },
    ])
  })

  it('no arrastra `problema` al dominio', () => {
    const [dato] = aDatosAlumno([
      { nombre: 'Aguilar, Bruno', numero_lista: 1, fecha_nacimiento: '', problema: 'algo' },
    ])
    expect(dato && 'problema' in dato).toBe(false)
  })
})
