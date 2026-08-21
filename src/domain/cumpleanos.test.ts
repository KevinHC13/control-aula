import { describe, expect, it } from 'vitest'

import {
  dentroDeLaVentana,
  diasHasta,
  diaYMes,
  edadEn,
  proximoCumpleanos,
} from './cumpleanos'

describe('diaYMes', () => {
  it('deja el día y el mes, que es lo que se repite cada año', () => {
    expect(diaYMes('2017-03-14')).toBe('03-14')
  })
})

describe('edadEn', () => {
  it('el día del cumpleaños ya cumplió', () => {
    expect(edadEn('2017-03-14', '2026-03-14')).toBe(9)
  })

  it('antes de su cumpleaños todavía no cumple', () => {
    // No es una resta de años: quien nació en marzo tiene 8 en enero de 2026.
    expect(edadEn('2017-03-14', '2026-01-10')).toBe(8)
  })

  it('después de su cumpleaños ya cumplió', () => {
    expect(edadEn('2017-03-14', '2026-12-31')).toBe(9)
  })

  it('un día antes todavía no', () => {
    expect(edadEn('2017-03-14', '2026-03-13')).toBe(8)
  })
})

describe('proximoCumpleanos', () => {
  it('si todavía no pasa este año, es este año', () => {
    expect(proximoCumpleanos('2017-07-02', '2026-06-30')).toBe('2026-07-02')
  })

  it('el mismo día cuenta como el próximo', () => {
    // Sin esto, el cumpleaños de hoy se saltaría al año siguiente y no habría
    // aviso justo el día que importa.
    expect(proximoCumpleanos('2017-07-02', '2026-07-02')).toBe('2026-07-02')
  })

  it('si ya pasó, es el del año siguiente', () => {
    expect(proximoCumpleanos('2017-07-02', '2026-07-03')).toBe('2027-07-02')
  })

  it('el de enero visto en diciembre cae en el año siguiente', () => {
    // Es el caso que un slice del año en curso se comería.
    expect(proximoCumpleanos('2017-01-19', '2026-12-28')).toBe('2027-01-19')
  })

  it('un 29 de febrero cae en marzo los años que no son bisiestos', () => {
    // No festejar es peor que festejar un día después, y es lo que hace la mayoría
    // de los calendarios.
    expect(proximoCumpleanos('2016-02-29', '2026-01-01')).toBe('2026-03-01')
    // En bisiesto, en su día.
    expect(proximoCumpleanos('2016-02-29', '2028-01-01')).toBe('2028-02-29')
  })

  it('la edad se cuenta sobre el año que le toca', () => {
    const fecha = proximoCumpleanos('2017-01-19', '2026-12-28')
    expect(edadEn('2017-01-19', fecha)).toBe(10)
  })
})

describe('diasHasta', () => {
  it('cero es hoy', () => {
    expect(diasHasta('2026-09-10', '2026-09-10')).toBe(0)
  })

  it('cuenta los días entre dos fechas', () => {
    expect(diasHasta('2026-09-10', '2026-09-13')).toBe(3)
  })

  it('cruza el cambio de mes y de año', () => {
    expect(diasHasta('2026-08-30', '2026-09-02')).toBe(3)
    expect(diasHasta('2026-12-30', '2027-01-02')).toBe(3)
  })
})

describe('dentroDeLaVentana', () => {
  it('hoy entra', () => {
    expect(dentroDeLaVentana('2026-09-10', '2026-09-10', 7)).toBe(true)
  })

  it('el sexto día siguiente entra y el séptimo ya no', () => {
    // Con 7 la ventana es hoy y los seis siguientes: la semana que viene, no los
    // siete días que empiezan mañana.
    expect(dentroDeLaVentana('2026-09-10', '2026-09-16', 7)).toBe(true)
    expect(dentroDeLaVentana('2026-09-10', '2026-09-17', 7)).toBe(false)
  })

  it('ayer no entra', () => {
    expect(dentroDeLaVentana('2026-09-10', '2026-09-09', 7)).toBe(false)
  })
})
