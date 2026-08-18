import { describe, expect, it } from 'vitest'

import {
  comoDate,
  diasDelMes,
  fechaLocal,
  fechaMas,
  huecosIniciales,
  mesDe,
  mesMas,
  rangoDelMes,
  ultimosDias,
  ventanaDeDias,
} from './fechas'

describe('fechaLocal', () => {
  it('la zona de las pruebas está fijada, o esta suite no prueba nada', () => {
    // Con TZ=UTC, una implementación con `toISOString().slice(0, 10)` pasaría
    // todas las pruebas de abajo. La zona se fija en vite.config.ts.
    expect(new Date().getTimezoneOffset()).not.toBe(0)
  })

  it('da la fecha del dispositivo, no la de UTC', () => {
    // Este instante es 01:00 del 19 en UTC y 19:00 del 18 en México. El día del
    // salón es el 18; `toISOString().slice(0, 10)` daría el 19.
    const tarde = new Date('2026-08-19T01:00:00.000Z')

    expect(fechaLocal(tarde)).toBe('2026-08-18')
    expect(fechaLocal(tarde)).not.toBe(tarde.toISOString().slice(0, 10))
  })

  it('la madrugada tampoco se corre de día', () => {
    // 00:30 del 18 en México son las 06:30 del 18 en UTC: aquí coinciden, y es
    // el caso que la implementación ingenua acierta por casualidad.
    expect(fechaLocal(new Date('2026-08-18T06:30:00.000Z'))).toBe('2026-08-18')
  })

  it('rellena mes y día con cero', () => {
    expect(fechaLocal(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('la medianoche pertenece al día que empieza', () => {
    expect(fechaLocal(new Date(2026, 7, 18, 0, 0, 0))).toBe('2026-08-18')
    expect(fechaLocal(new Date(2026, 7, 18, 23, 59, 59))).toBe('2026-08-18')
  })
})

describe('fechaMas', () => {
  it('avanza y retrocede días', () => {
    expect(fechaMas('2026-08-18', 1)).toBe('2026-08-19')
    expect(fechaMas('2026-08-18', -1)).toBe('2026-08-17')
    expect(fechaMas('2026-08-18', 0)).toBe('2026-08-18')
  })

  it('cruza fin de mes y fin de año', () => {
    expect(fechaMas('2026-08-31', 1)).toBe('2026-09-01')
    expect(fechaMas('2026-12-31', 1)).toBe('2027-01-01')
    expect(fechaMas('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('acierta en año bisiesto', () => {
    expect(fechaMas('2028-02-28', 1)).toBe('2028-02-29')
    expect(fechaMas('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('retroceder una semana desde el lunes cae en el lunes anterior', () => {
    expect(fechaMas('2026-08-17', -7)).toBe('2026-08-10')
  })
})

describe('ultimosDias', () => {
  it('termina en la fecha dada y va en orden ascendente', () => {
    expect(ultimosDias('2026-08-18', 3)).toEqual(['2026-08-16', '2026-08-17', '2026-08-18'])
  })

  it('cruza el inicio de mes hacia atrás', () => {
    expect(ultimosDias('2026-09-01', 2)).toEqual(['2026-08-31', '2026-09-01'])
  })

  it('uno solo es el día dado', () => {
    expect(ultimosDias('2026-08-18', 1)).toEqual(['2026-08-18'])
  })
})

describe('comoDate', () => {
  it('cae al mediodía local, no a medianoche', () => {
    const d = comoDate('2026-08-18')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(7)
    expect(d.getDate()).toBe(18)
    expect(d.getHours()).toBe(12)
  })

  it('ida y vuelta con fechaLocal no cambia el día', () => {
    for (const fecha of ['2026-01-01', '2026-04-05', '2026-10-25', '2026-12-31']) {
      expect(fechaLocal(comoDate(fecha))).toBe(fecha)
    }
  })
})

describe('ventanaDeDias', () => {
  const HOY = '2026-08-18'

  it('deja el seleccionado al centro cuando está lejos de hoy', () => {
    expect(ventanaDeDias('2026-08-10', HOY, 5)).toEqual([
      '2026-08-08',
      '2026-08-09',
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
    ])
  })

  it('con cuantos par deja una casilla más a la izquierda', () => {
    expect(ventanaDeDias('2026-08-10', HOY, 4)).toEqual([
      '2026-08-08',
      '2026-08-09',
      '2026-08-10',
      '2026-08-11',
    ])
  })

  it('con hoy seleccionado, hoy es el último y no hay futuro', () => {
    const dias = ventanaDeDias(HOY, HOY, 7)
    expect(dias.at(-1)).toBe(HOY)
    expect(dias.filter((d) => d > HOY)).toEqual([])
  })

  it('cerca de hoy tampoco revela futuro', () => {
    const dias = ventanaDeDias('2026-08-17', HOY, 7)
    expect(dias.at(-1)).toBe(HOY)
  })

  it('un seleccionado futuro sigue estando en la ventana', () => {
    const dias = ventanaDeDias('2026-08-25', HOY, 5)
    expect(dias.at(-1)).toBe('2026-08-25')
    expect(dias).toContain('2026-08-25')
  })

  it('siempre mide cuantos y siempre contiene al seleccionado', () => {
    for (const cuantos of [1, 2, 3, 5, 7, 12, 18]) {
      for (const dia of ['2026-06-01', '2026-08-01', '2026-08-17', HOY]) {
        const dias = ventanaDeDias(dia, HOY, cuantos)
        expect(dias).toHaveLength(cuantos)
        expect(dias).toContain(dia)
      }
    }
  })

  it('cruza el inicio de mes sin huecos', () => {
    expect(ventanaDeDias('2026-09-01', '2026-09-30', 3)).toEqual([
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
    ])
  })
})

describe('mesDe', () => {
  it('recorta la fecha al mes', () => {
    expect(mesDe('2026-08-18')).toBe('2026-08')
  })
})

describe('mesMas', () => {
  it('avanza y retrocede meses', () => {
    expect(mesMas('2026-08', 1)).toBe('2026-09')
    expect(mesMas('2026-08', -1)).toBe('2026-07')
    expect(mesMas('2026-08', 0)).toBe('2026-08')
  })

  it('cruza el año en los dos sentidos', () => {
    expect(mesMas('2026-12', 1)).toBe('2027-01')
    expect(mesMas('2026-01', -1)).toBe('2025-12')
  })

  it('desde enero no se salta febrero', () => {
    // El bug clásico: `setMonth` sobre el 31 de enero devuelve marzo.
    expect(mesMas('2026-01', 1)).toBe('2026-02')
  })
})

describe('rangoDelMes', () => {
  it('acierta el último día de meses de 30, 31, 28 y 29', () => {
    expect(rangoDelMes('2026-09')).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' })
    expect(rangoDelMes('2026-08')).toEqual({ desde: '2026-08-01', hasta: '2026-08-31' })
    expect(rangoDelMes('2026-02')).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' })
    expect(rangoDelMes('2028-02')).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' })
  })

  it('diciembre no se cae al pedir el mes siguiente', () => {
    expect(rangoDelMes('2026-12')).toEqual({ desde: '2026-12-01', hasta: '2026-12-31' })
  })
})

describe('diasDelMes', () => {
  it('da todos los días en orden ascendente', () => {
    const dias = diasDelMes('2026-02')
    expect(dias).toHaveLength(28)
    expect(dias[0]).toBe('2026-02-01')
    expect(dias.at(-1)).toBe('2026-02-28')
  })

  it('el bisiesto tiene 29', () => {
    expect(diasDelMes('2028-02')).toHaveLength(29)
  })

  it('un mes de 31 tiene 31', () => {
    expect(diasDelMes('2026-08')).toHaveLength(31)
  })
})

describe('huecosIniciales', () => {
  it('un mes que empieza en lunes no lleva huecos', () => {
    // 2026-06-01 es lunes.
    expect(huecosIniciales('2026-06')).toBe(0)
  })

  it('un mes que empieza en domingo lleva seis', () => {
    // 2026-02-01 es domingo.
    expect(huecosIniciales('2026-02')).toBe(6)
  })

  it('un mes que empieza en sábado lleva cinco', () => {
    // 2026-08-01 es sábado.
    expect(huecosIniciales('2026-08')).toBe(5)
  })
})
