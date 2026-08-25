import { describe, expect, it } from 'vitest'

import type { Alumno } from '@/domain/entities'
import type { Fecha } from '@/domain/values'

import { cumpleanosDeHoy, cumpleanosProximos } from './cumpleanos'

const alumno = (n: number, nacimiento: Fecha | null): Alumno => ({
  id: `alumno-${n}`,
  nombre: `Apellido${n}, Nombre${n}`,
  ciclo_id: null,
  numero_lista: n,
  fecha_nacimiento: nacimiento,
  updated_at: '2026-08-24T00:00:00.000Z',
  deleted_at: null,
})

const HOY: Fecha = '2026-09-10'

describe('cumpleanosProximos', () => {
  it('trae el de hoy con la edad que cumple', () => {
    const proximos = cumpleanosProximos([alumno(1, '2017-09-10')], HOY)

    expect(proximos).toHaveLength(1)
    expect(proximos[0]?.faltan).toBe(0)
    expect(proximos[0]?.cumple).toBe(9)
  })

  it('trae los de la semana y deja fuera lo que ya pasó', () => {
    const proximos = cumpleanosProximos(
      [
        alumno(1, '2017-09-09'), // ayer
        alumno(2, '2017-09-10'), // hoy
        alumno(3, '2017-09-14'), // en cuatro días
        alumno(4, '2017-09-20'), // en diez
      ],
      HOY,
    )

    expect(proximos.map((c) => c.alumno.numero_lista)).toEqual([2, 3])
  })

  it('ordena del más próximo al más lejano', () => {
    const proximos = cumpleanosProximos(
      [alumno(1, '2017-09-15'), alumno(2, '2017-09-11'), alumno(3, '2017-09-10')],
      HOY,
    )

    expect(proximos.map((c) => c.faltan)).toEqual([0, 1, 5])
  })

  it('a igual día, por número de lista', () => {
    const proximos = cumpleanosProximos([alumno(7, '2017-09-12'), alumno(2, '2017-09-12')], HOY)

    expect(proximos.map((c) => c.alumno.numero_lista)).toEqual([2, 7])
  })

  it('un alumno sin fecha de nacimiento no aparece, y no falla', () => {
    // Es lo más común en una lista cargada de un PDF que no traía fechas.
    const proximos = cumpleanosProximos([alumno(1, null), alumno(2, '2017-09-10')], HOY)

    expect(proximos).toHaveLength(1)
    expect(proximos[0]?.alumno.numero_lista).toBe(2)
  })

  it('sin cumpleaños en la semana devuelve la lista vacía', () => {
    // Y con eso la pantalla no pinta nada: la mayoría de las semanas es este caso.
    expect(cumpleanosProximos([alumno(1, '2017-12-25')], HOY)).toEqual([])
  })

  it('la ventana cruza el fin de año', () => {
    const proximos = cumpleanosProximos([alumno(1, '2017-01-02')], '2026-12-30')

    expect(proximos).toHaveLength(1)
    expect(proximos[0]?.fecha).toBe('2027-01-02')
    // Cumple los que le tocan en 2027, no en 2026.
    expect(proximos[0]?.cumple).toBe(10)
    expect(proximos[0]?.faltan).toBe(3)
  })

  it('sin alumnos no hay cumpleaños', () => {
    expect(cumpleanosProximos([], HOY)).toEqual([])
  })
})

describe('cumpleanosDeHoy', () => {
  it('solo los de hoy', () => {
    const proximos = cumpleanosProximos(
      [alumno(1, '2017-09-10'), alumno(2, '2017-09-12')],
      HOY,
    )

    expect(cumpleanosDeHoy(proximos).map((c) => c.alumno.numero_lista)).toEqual([1])
  })

  it('dos el mismo día salen los dos', () => {
    const proximos = cumpleanosProximos(
      [alumno(1, '2017-09-10'), alumno(2, '2018-09-10')],
      HOY,
    )

    expect(cumpleanosDeHoy(proximos)).toHaveLength(2)
    // Y cada uno con su edad: no todos cumplen lo mismo.
    expect(cumpleanosDeHoy(proximos).map((c) => c.cumple)).toEqual([9, 8])
  })
})
