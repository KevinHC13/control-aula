import { describe, expect, it } from 'vitest'

import { curpValido, fechaDeCurp, normalizarCurp } from './curp'

// CURP inventadas: la forma es real, las personas no (docs/CLAUDE.md, «Datos
// reales»). Se construyen a mano para poder mover una sola posición por prueba.
const NIÑA = 'AUVG160520MNLRLRA3' // 20 de mayo de 2016
const NIÑO = 'PEGJ151102HNLRRVA2' // 2 de noviembre de 2015

describe('fechaDeCurp', () => {
  it('lee los seis dígitos de en medio', () => {
    expect(fechaDeCurp(NIÑA)).toBe('2016-05-20')
    expect(fechaDeCurp(NIÑO)).toBe('2015-11-02')
  })

  it('con letra en la homoclave nació del 2000 en adelante', () => {
    // Es el caso de cualquier alumno de primaria hoy.
    expect(fechaDeCurp('MARL050101HNLRRSA1')).toBe('2005-01-01')
  })

  it('con dígito en la homoclave nació en los 1900', () => {
    // La misma fecha impresa, otro siglo: es lo que evita que la maestra
    // aparezca naciendo el año que viene.
    expect(fechaDeCurp('MARL850101HNLRRS81')).toBe('1985-01-01')
  })

  it('una fecha que no existe no es una fecha', () => {
    // 31 de febrero: el documento se leyó mal, no hay que inventarle un día.
    expect(fechaDeCurp('AUVG160231MNLRLRA3')).toBeNull()
  })

  it('lo que no tiene forma de CURP no da fecha', () => {
    expect(fechaDeCurp('')).toBeNull()
    expect(fechaDeCurp('12938032')).toBeNull() // una matrícula
    expect(fechaDeCurp('AUVG160520MNLRLRA')).toBeNull() // 17 caracteres
    expect(fechaDeCurp('auvg160520mnlrlra3')).toBeNull() // minúsculas sin normalizar
  })
})

describe('curpValido', () => {
  it('acepta las bien formadas', () => {
    expect(curpValido(NIÑA)).toBe(true)
    expect(curpValido(NIÑO)).toBe(true)
  })

  it('rechaza lo que solo se le parece', () => {
    expect(curpValido('AUVG160520XNLRLRA3')).toBe(false) // sexo que no es H ni M
    expect(curpValido('ABVG160520MNLRLRA3')).toBe(false) // segunda letra consonante
    expect(curpValido('AUVG160231MNLRLRA3')).toBe(false) // fecha imposible
    expect(curpValido('')).toBe(false)
  })
})

describe('normalizarCurp', () => {
  it('sube a mayúsculas y quita los espacios que trae un OCR', () => {
    expect(normalizarCurp(' auvg 160520 mnlrlra3 ')).toBe('AUVG160520MNLRLRA3')
  })
})
