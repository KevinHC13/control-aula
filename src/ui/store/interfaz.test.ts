import { beforeEach, describe, expect, it } from 'vitest'

import { fechaLocal } from '@/domain/fechas'

import { useInterfaz } from './interfaz'

const inicial = useInterfaz.getState()

beforeEach(() => {
  useInterfaz.setState(inicial, true)
})

describe('contenido del store', () => {
  it('solo guarda estado de interfaz: ningún dato del salón', () => {
    const claves = Object.keys(useInterfaz.getState())

    // Alumnos, asistencia, calificaciones y notas viven en IndexedDB y se leen
    // por hook. Copiarlos aquí produce una interfaz que miente en silencio.
    for (const prohibida of [
      'alumnos',
      'asistencia',
      'calificaciones',
      'notas',
      'registros',
      'grupo',
    ]) {
      expect(claves, `el store guarda ${prohibida}`).not.toContain(prohibida)
    }
  })

  it('guarda exactamente lo declarado, nada más', () => {
    expect(Object.keys(useInterfaz.getState()).sort()).toEqual(
      ['diaSeleccionado', 'irA', 'pestanaActiva', 'seleccionarDia'].sort(),
    )
  })

  it('ningún valor del estado es una colección de registros', () => {
    for (const [clave, valor] of Object.entries(useInterfaz.getState())) {
      expect(Array.isArray(valor), `${clave} es un arreglo`).toBe(false)
    }
  })
})

describe('estado inicial', () => {
  it('abre en asistencia, que es la pantalla del camino diario', () => {
    expect(useInterfaz.getState().pestanaActiva).toBe('asistencia')
  })

  it('arranca en el día de hoy, en la zona del dispositivo', () => {
    expect(useInterfaz.getState().diaSeleccionado).toBe(fechaLocal(new Date()))
  })
})

describe('acciones', () => {
  it('irA cambia de pestaña', () => {
    useInterfaz.getState().irA('notas')
    expect(useInterfaz.getState().pestanaActiva).toBe('notas')
  })

  it('seleccionarDia cambia el día sin tocar la pestaña', () => {
    useInterfaz.getState().irA('grupo')
    useInterfaz.getState().seleccionarDia('2026-03-02')

    expect(useInterfaz.getState().diaSeleccionado).toBe('2026-03-02')
    expect(useInterfaz.getState().pestanaActiva).toBe('grupo')
  })
})
