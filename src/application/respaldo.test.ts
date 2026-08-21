import { describe, expect, it } from 'vitest'

import {
  type ArchivoDeRespaldo,
  contarRegistros,
  leerRespaldo,
  MARCA,
  nombreDeArchivo,
} from './respaldo'

const archivo = (extra: Partial<ArchivoDeRespaldo> = {}): ArchivoDeRespaldo => ({
  app: MARCA,
  esquema: 3,
  generado_en: '2026-12-18T20:00:00.000Z',
  tablas: {
    alumnos: [{ id: 'alumno-1' }, { id: 'alumno-2' }],
    asistencia: [{ id: 'asistencia-1' }],
  },
  ...extra,
})

describe('nombreDeArchivo', () => {
  it('lleva la fecha del dispositivo, para que se ordene solo en Archivos', () => {
    expect(nombreDeArchivo('2026-12-18')).toBe('palomita-2026-12-18.json')
  })
})

describe('contarRegistros', () => {
  it('suma las filas de todas las tablas', () => {
    expect(contarRegistros(archivo())).toBe(3)
  })

  it('un respaldo de una base vacía cuenta cero, no falla', () => {
    expect(contarRegistros(archivo({ tablas: {} }))).toBe(0)
  })
})

describe('leerRespaldo', () => {
  it('acepta un archivo del mismo esquema', () => {
    const leido = leerRespaldo(JSON.stringify(archivo()), 3)

    expect(leido.esquema).toBe(3)
    expect(contarRegistros(leido)).toBe(3)
  })

  it('acepta un respaldo de un esquema más viejo', () => {
    // Trae menos tablas y menos campos, y los que falten se leen como ausentes:
    // es lo mismo que hace la app con los datos de antes de cada migración.
    expect(leerRespaldo(JSON.stringify(archivo({ esquema: 2 })), 3).esquema).toBe(2)
  })

  it('rechaza un respaldo de un esquema más nuevo, y dice por qué', () => {
    // Sus filas pueden traer campos que esta versión no sabe leer. Escribirlas a
    // medias es peor que no restaurar.
    expect(() => leerRespaldo(JSON.stringify(archivo({ esquema: 4 })), 3)).toThrow(
      /versión más nueva/,
    )
  })

  it('rechaza un JSON que no es un respaldo de la app', () => {
    expect(() => leerRespaldo(JSON.stringify({ hola: 'mundo' }), 3)).toThrow(
      /no es un respaldo/,
    )
  })

  it('rechaza un archivo que no es JSON', () => {
    // El caso real: eligió el PDF de la lista en lugar del respaldo.
    expect(() => leerRespaldo('%PDF-1.7 …', 3)).toThrow(/no es un JSON válido/)
  })

  it('rechaza un respaldo sin versión de esquema', () => {
    const sinEsquema = { app: MARCA, generado_en: '', tablas: {} }
    expect(() => leerRespaldo(JSON.stringify(sinEsquema), 3)).toThrow(/de qué versión/)
  })

  it('rechaza tablas que no son listas de filas', () => {
    const roto = { ...archivo(), tablas: { alumnos: { id: 'alumno-1' } } }
    expect(() => leerRespaldo(JSON.stringify(roto), 3)).toThrow(/formato esperado/)
  })

  it('un respaldo sin fecha se puede leer: la fecha es adorno, las tablas no', () => {
    const sinFecha = { ...archivo(), generado_en: 42 }
    expect(leerRespaldo(JSON.stringify(sinFecha), 3).generado_en).toBe('')
  })
})
