import { describe, expect, it } from 'vitest'

import {
  aceptaEscrituras,
  contieneFecha,
  descriptoresCompletos,
  nivelesCompletos,
  pesosSuman100,
  puedeCerrarse,
  rangoValido,
  rubricaCompleta,
  seTraslapan,
  sumaDePesos,
  traslapes,
  trimestreDeFecha,
} from './evaluacion'

const trimestre = (numero: number, inicio: string, fin: string, ciclo_id = 'ciclo-1') => ({
  ciclo_id,
  numero,
  inicio,
  fin,
})

const T1 = trimestre(1, '2026-08-24', '2026-11-27')
const T2 = trimestre(2, '2026-11-30', '2027-03-19')
const T3 = trimestre(3, '2027-03-22', '2027-07-16')

const pesos = (...valores: number[]) => valores.map((peso) => ({ peso }))

describe('sumaDePesos', () => {
  it('sin criterios da 0', () => {
    expect(sumaDePesos([])).toBe(0)
  })

  it('suma el total corriente que se muestra al editar', () => {
    expect(sumaDePesos(pesos(40, 30, 20))).toBe(90)
  })
})

describe('pesosSuman100', () => {
  it('acepta el reparto que cierra', () => {
    expect(pesosSuman100(pesos(40, 30, 20, 10))).toBe(true)
  })

  it('rechaza el que no cierra, por arriba y por abajo', () => {
    expect(pesosSuman100(pesos(40, 30, 20))).toBe(false)
    expect(pesosSuman100(pesos(60, 60))).toBe(false)
  })

  it('sin criterios no cierra: cero no es cien', () => {
    expect(pesosSuman100([])).toBe(false)
  })

  it('tolera el error de punto flotante de los tercios', () => {
    // 33.4 + 33.3 + 33.3 no da exactamente 100 en binario. Negarle el cierre por
    // eso sería un error que ella no podría corregir desde la pantalla.
    expect(33.4 + 33.3 + 33.3).not.toBe(100)
    expect(pesosSuman100(pesos(33.4, 33.3, 33.3))).toBe(true)
  })
})

describe('rangoValido', () => {
  it('acepta un trimestre que termina después de empezar', () => {
    expect(rangoValido(T1)).toBe(true)
  })

  it('acepta un rango de un solo día', () => {
    expect(rangoValido(trimestre(1, '2026-08-24', '2026-08-24'))).toBe(true)
  })

  it('rechaza el que termina antes de empezar', () => {
    expect(rangoValido(trimestre(1, '2026-11-27', '2026-08-24'))).toBe(false)
  })
})

describe('contieneFecha', () => {
  it('incluye los extremos', () => {
    expect(contieneFecha(T1, '2026-08-24')).toBe(true)
    expect(contieneFecha(T1, '2026-11-27')).toBe(true)
  })

  it('excluye el día de antes y el de después', () => {
    expect(contieneFecha(T1, '2026-08-23')).toBe(false)
    expect(contieneFecha(T1, '2026-11-28')).toBe(false)
  })

  it('compara por fecha, no por número de mes', () => {
    // Comparar cadenas ISO ordena bien; que lo haga es lo que sostiene todo lo
    // demás de este archivo.
    expect(contieneFecha(T1, '2026-09-02')).toBe(true)
    expect(contieneFecha(T1, '2027-01-15')).toBe(false)
  })
})

describe('trimestreDeFecha', () => {
  const ciclo = [T1, T2, T3]

  it('atribuye la fecha al trimestre que la contiene, sin elección manual', () => {
    expect(trimestreDeFecha('2026-09-15', ciclo)?.numero).toBe(1)
    expect(trimestreDeFecha('2027-01-20', ciclo)?.numero).toBe(2)
    expect(trimestreDeFecha('2027-05-05', ciclo)?.numero).toBe(3)
  })

  it('una fecha fuera de todo rango devuelve null y no falla', () => {
    // Vacaciones y puentes. El registro existe, pero no cuenta para ningún
    // trimestre.
    expect(trimestreDeFecha('2026-11-28', ciclo)).toBeNull()
    expect(trimestreDeFecha('2026-07-01', ciclo)).toBeNull()
    expect(trimestreDeFecha('2027-08-01', ciclo)).toBeNull()
  })

  it('sin trimestres configurados devuelve null, nunca falla', () => {
    expect(trimestreDeFecha('2026-09-15', [])).toBeNull()
  })
})

describe('seTraslapan', () => {
  it('dos trimestres consecutivos no se traslapan', () => {
    expect(seTraslapan(T1, T2)).toBe(false)
  })

  it('compartir un solo día ya es traslape', () => {
    expect(seTraslapan(T1, trimestre(2, '2026-11-27', '2027-03-19'))).toBe(true)
  })

  it('es simétrico', () => {
    const chocado = trimestre(2, '2026-11-01', '2027-03-19')
    expect(seTraslapan(T1, chocado)).toBe(seTraslapan(chocado, T1))
  })

  it('uno contenido en el otro se traslapa', () => {
    expect(seTraslapan(T1, trimestre(2, '2026-09-01', '2026-09-30'))).toBe(true)
  })
})

describe('traslapes', () => {
  it('un ciclo bien configurado no tiene ninguno', () => {
    expect(traslapes([T1, T2, T3])).toEqual([])
  })

  it('señala el par que choca, para poder decir cuál', () => {
    const chocado = trimestre(2, '2026-11-01', '2027-03-19')
    const pares = traslapes([T1, chocado, T3])
    expect(pares).toHaveLength(1)
    expect(pares[0]?.map((t) => t.numero)).toEqual([1, 2])
  })

  it('no compara trimestres de ciclos distintos', () => {
    // El T1 de un ciclo y el T3 del anterior pueden tener fechas cercanas o
    // incluso mal capturadas; son periodos de ciclos distintos y no chocan.
    const otroCiclo = trimestre(1, '2026-08-24', '2026-11-27', 'ciclo-2')
    expect(traslapes([T1, otroCiclo])).toEqual([])
  })

  it('con un solo trimestre no hay nada que comparar', () => {
    expect(traslapes([T1])).toEqual([])
    expect(traslapes([])).toEqual([])
  })
})

describe('aceptaEscrituras', () => {
  it('un trimestre abierto acepta', () => {
    expect(aceptaEscrituras({ estado: 'abierto' })).toBe(true)
  })

  it('uno cerrado rechaza: sus calificaciones ya salieron en una boleta', () => {
    expect(aceptaEscrituras({ estado: 'cerrado' })).toBe(false)
  })
})

describe('puedeCerrarse', () => {
  const abierto = { estado: 'abierto' } as const

  it('cierra cuando los pesos dan 100', () => {
    expect(puedeCerrarse(abierto, pesos(50, 30, 20))).toBe(true)
  })

  it('no cierra si los pesos no dan 100', () => {
    expect(puedeCerrarse(abierto, pesos(50, 30))).toBe(false)
  })

  it('no cierra sin criterios, aunque la suma sea cero', () => {
    // Cerrarlo escribiría un snapshot vacío, indistinguible después de un
    // trimestre bien cerrado en el que todos sacaron 0.
    expect(puedeCerrarse(abierto, [])).toBe(false)
  })

  it('un trimestre ya cerrado no se vuelve a cerrar', () => {
    expect(puedeCerrarse({ estado: 'cerrado' }, pesos(50, 30, 20))).toBe(false)
  })
})

describe('descriptoresCompletos', () => {
  it('acepta un descriptor por nivel', () => {
    expect(descriptoresCompletos(['Sin errores', 'Uno o dos', 'Varios', 'No se entiende'])).toBe(
      true,
    )
  })

  it('rechaza uno vacío o con solo espacios', () => {
    // Un nivel sin descriptor obliga a recordar en diciembre qué quiso decir
    // «Bien» en septiembre.
    expect(descriptoresCompletos(['a', 'b', '', 'd'])).toBe(false)
    expect(descriptoresCompletos(['a', 'b', '   ', 'd'])).toBe(false)
  })

  it('rechaza una cantidad distinta a la de niveles', () => {
    expect(descriptoresCompletos(['a', 'b', 'c'])).toBe(false)
    expect(descriptoresCompletos(['a', 'b', 'c', 'd', 'e'])).toBe(false)
    expect(descriptoresCompletos([])).toBe(false)
  })
})

describe('rubricaCompleta', () => {
  const renglon = { nombre: 'Ortografía', descriptores: ['a', 'b', 'c', 'd'] }

  it('acepta una rúbrica con nombre y un renglón completo', () => {
    expect(rubricaCompleta({ nombre: 'Trabajo escrito', criterios: [renglon] })).toBe(true)
  })

  it('rechaza la que no tiene nombre', () => {
    expect(rubricaCompleta({ nombre: '  ', criterios: [renglon] })).toBe(false)
  })

  it('rechaza la que no tiene renglones', () => {
    // Sin renglones no calificaría nada: sería una división entre cero que llega
    // hasta la pantalla de captura.
    expect(rubricaCompleta({ nombre: 'Trabajo escrito', criterios: [] })).toBe(false)
  })

  it('rechaza la que tiene un renglón sin nombre', () => {
    expect(
      rubricaCompleta({
        nombre: 'Trabajo escrito',
        criterios: [renglon, { nombre: '', descriptores: ['a', 'b', 'c', 'd'] }],
      }),
    ).toBe(false)
  })

  it('rechaza la que tiene un renglón con un descriptor vacío', () => {
    expect(
      rubricaCompleta({
        nombre: 'Trabajo escrito',
        criterios: [{ nombre: 'Claridad', descriptores: ['a', '', 'c', 'd'] }],
      }),
    ).toBe(false)
  })
})

describe('nivelesCompletos', () => {
  it('con un nivel por renglón, está completa', () => {
    expect(nivelesCompletos({ a: 0, b: 3 }, ['a', 'b'])).toBe(true)
  })

  it('a medias no cuenta como calificado', () => {
    // Un promedio sacado de un renglón de dos no se compara con el de nadie.
    expect(nivelesCompletos({ a: 0 }, ['a', 'b'])).toBe(false)
  })

  it('sin ningún nivel, no está completa', () => {
    expect(nivelesCompletos({}, ['a'])).toBe(false)
  })

  it('el nivel 0 cuenta: es «Excelente», no un hueco', () => {
    expect(nivelesCompletos({ a: 0 }, ['a'])).toBe(true)
  })

  it('los niveles de renglones que ya no están no completan nada', () => {
    // La rúbrica perdió el renglón `b` y ganó `c`: lo capturado en `b` sigue
    // guardado, pero no califica `c`.
    expect(nivelesCompletos({ a: 1, b: 2 }, ['a', 'c'])).toBe(false)
  })

  it('una rúbrica sin renglones nunca está completa', () => {
    // Decir que sí declararía calificado a todo el grupo sin un solo toque.
    expect(nivelesCompletos({}, [])).toBe(false)
  })
})
