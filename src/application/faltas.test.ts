import { describe, expect, it } from 'vitest'

import type { Alumno, RegistroAsistencia } from '@/domain/entities'
import type { EstadoAsistencia, Sexo } from '@/domain/values'

import { armarFaltasDeLaSemana, faltasComoDocumento } from './faltas'

const base = { updated_at: '2026-09-01T00:00:00.000Z', deleted_at: null }

// La semana del lunes 7 al domingo 13 de septiembre de 2026.
const LUNES = '2026-09-07'

// Nombres inventados: en el repositorio no va un solo nombre real del salón.
const alumno = (n: number, sexo: Sexo | null): Alumno => ({
  id: `alumno-${n}`,
  ...base,
  nombre: `Apellido${n}, Nombre`,
  ciclo_id: null,
  numero_lista: n,
  fecha_nacimiento: null,
  curp: null,
  sexo,
})

const dia = (n: number, fecha: string, estado: EstadoAsistencia): RegistroAsistencia => ({
  id: `asis-${n}-${fecha}`,
  ...base,
  alumno_id: `alumno-${n}`,
  fecha,
  estado,
})

/** Tres niños, dos niñas y uno sin asignar. */
const GRUPO = [
  alumno(1, 'H'),
  alumno(2, 'H'),
  alumno(3, 'H'),
  alumno(4, 'M'),
  alumno(5, 'M'),
  alumno(6, null),
]

/** Un día entero pasado, con quien faltó dicho por número de lista. */
function pasarLista(fecha: string, faltaron: number[]): RegistroAsistencia[] {
  return GRUPO.map((a) =>
    dia(a.numero_lista, fecha, faltaron.includes(a.numero_lista) ? 'ausente' : 'presente'),
  )
}

describe('armarFaltasDeLaSemana', () => {
  it('parte las faltas de la semana en niños, niñas y sin asignar', () => {
    const reporte = armarFaltasDeLaSemana(
      GRUPO,
      [...pasarLista('2026-09-07', [1, 4]), ...pasarLista('2026-09-08', [2, 5, 6])],
      LUNES,
    )

    expect(reporte.faltas).toBe(5)
    expect(reporte.ninos).toBe(2)
    expect(reporte.ninas).toBe(2)
    expect(reporte.sinAsignar).toBe(1)
  })

  it('cuenta faltas y no alumnos: el que falta dos días suma dos', () => {
    const reporte = armarFaltasDeLaSemana(
      GRUPO,
      [...pasarLista('2026-09-07', [1]), ...pasarLista('2026-09-08', [1])],
      LUNES,
    )

    expect(reporte.faltas).toBe(2)
    expect(reporte.ninos).toBe(2)
  })

  it('los días suman exactamente el total de la semana', () => {
    const reporte = armarFaltasDeLaSemana(
      GRUPO,
      [
        ...pasarLista('2026-09-07', [1, 4]),
        ...pasarLista('2026-09-08', [2]),
        ...pasarLista('2026-09-09', [1, 5, 6]),
      ],
      LUNES,
    )

    const sumado = (campo: 'faltas' | 'ninos' | 'ninas' | 'sinAsignar') =>
      reporte.dias.reduce((total, d) => total + d[campo], 0)

    expect(sumado('faltas')).toBe(reporte.faltas)
    expect(sumado('ninos')).toBe(reporte.ninos)
    expect(sumado('ninas')).toBe(reporte.ninas)
    expect(sumado('sinAsignar')).toBe(reporte.sinAsignar)
  })

  it('devuelve los días en orden, del lunes en adelante', () => {
    const reporte = armarFaltasDeLaSemana(
      GRUPO,
      [
        ...pasarLista('2026-09-09', [1]),
        ...pasarLista('2026-09-07', [1]),
        ...pasarLista('2026-09-11', [1]),
      ],
      LUNES,
    )

    expect(reporte.dias.map((d) => d.fecha)).toEqual([
      '2026-09-07',
      '2026-09-09',
      '2026-09-11',
    ])
  })

  it('un día sin registros no sale en cero: no sale', () => {
    // El martes es festivo y nadie pasó lista. Un cero diría «nadie faltó».
    const reporte = armarFaltasDeLaSemana(
      GRUPO,
      [...pasarLista('2026-09-07', [1]), ...pasarLista('2026-09-09', [2])],
      LUNES,
    )

    expect(reporte.dias.map((d) => d.fecha)).toEqual(['2026-09-07', '2026-09-09'])
  })

  it('una semana sin pasar lista devuelve la semana vacía, no un cero', () => {
    const reporte = armarFaltasDeLaSemana(GRUPO, [], LUNES)

    expect(reporte.dias).toEqual([])
    expect(reporte.faltas).toBe(0)
  })

  it('una semana en la que no faltó nadie tiene días y no tiene faltas', () => {
    const reporte = armarFaltasDeLaSemana(GRUPO, pasarLista('2026-09-07', []), LUNES)

    expect(reporte.dias).toHaveLength(1)
    expect(reporte.dias[0]?.faltas).toBe(0)
    expect(reporte.faltas).toBe(0)
  })

  it('un retardo y una justificada no son faltas', () => {
    // La misma regla que el contador diario: lo que se cuenta es quién no vino.
    const reporte = armarFaltasDeLaSemana(
      GRUPO,
      [
        dia(1, '2026-09-07', 'retardo'),
        dia(2, '2026-09-07', 'justificada'),
        dia(3, '2026-09-07', 'ausente'),
      ],
      LUNES,
    )

    expect(reporte.faltas).toBe(1)
    expect(reporte.ninos).toBe(1)
  })

  it('el que no tiene sexo se dice aparte, no se reparte', () => {
    const reporte = armarFaltasDeLaSemana(GRUPO, pasarLista('2026-09-07', [6]), LUNES)

    expect(reporte.sinAsignar).toBe(1)
    expect(reporte.ninos).toBe(0)
    expect(reporte.ninas).toBe(0)
    expect(reporte.faltas).toBe(1)
  })

  it('el rango de la semana va del lunes al domingo', () => {
    expect(armarFaltasDeLaSemana(GRUPO, [], LUNES)).toMatchObject({
      desde: '2026-09-07',
      hasta: '2026-09-13',
    })
  })

  it('deja fuera lo que cae fuera de la semana, aunque se lo pasen', () => {
    // La pura tiene que dar lo mismo le entreguen la semana justa o el mes.
    const reporte = armarFaltasDeLaSemana(
      GRUPO,
      [
        ...pasarLista('2026-09-06', [1, 2, 3]),
        ...pasarLista('2026-09-07', [1]),
        ...pasarLista('2026-09-14', [1, 2]),
      ],
      LUNES,
    )

    expect(reporte.dias.map((d) => d.fecha)).toEqual(['2026-09-07'])
    expect(reporte.faltas).toBe(1)
  })

  it('la falta de quien ya no está en el grupo no cuenta', () => {
    // `faltasDeLaSemana` lee `lista()`, que no trae a los dados de baja: sus
    // registros viejos siguen en la base y no deben sumar.
    const reporte = armarFaltasDeLaSemana(
      GRUPO,
      [...pasarLista('2026-09-07', [1]), dia(99, '2026-09-07', 'ausente')],
      LUNES,
    )

    expect(reporte.faltas).toBe(1)
  })
})

describe('faltasComoDocumento', () => {
  const TEXTOS = {
    periodo: 'del 7 al 11 de septiembre de 2026',
    grupo: '3.º B',
    porSexo: '2 niños · 1 niña',
    dias: [
      { fecha: 'lunes, 7 de septiembre', porSexo: '1 niño · 1 niña' },
      { fecha: 'martes, 8 de septiembre', porSexo: '1 niño' },
    ],
    nota: 'Solo cuenta quien no vino.',
  }

  const reporte = () =>
    armarFaltasDeLaSemana(
      GRUPO,
      [...pasarLista('2026-09-07', [1, 4]), ...pasarLista('2026-09-08', [2])],
      LUNES,
    )

  it('lleva el grupo y el periodo en el subtítulo', () => {
    // Una hoja impresa se separa de su iPad: sin el grupo, «del 7 al 11» no dice
    // de quién es.
    expect(faltasComoDocumento(reporte(), TEXTOS).subtitulo).toBe(
      '3.º B · del 7 al 11 de septiembre de 2026',
    )
  })

  it('sin nombre de grupo no deja un separador suelto', () => {
    expect(faltasComoDocumento(reporte(), { ...TEXTOS, grupo: '  ' }).subtitulo).toBe(
      'del 7 al 11 de septiembre de 2026',
    )
  })

  it('la cifra grande es el total de la semana, con su leyenda concordada', () => {
    const doc = faltasComoDocumento(reporte(), TEXTOS)
    const cifra = doc.bloques.find((b) => b.tipo === 'cifra')

    expect(cifra).toMatchObject({ valor: '3', leyenda: 'faltas esta semana' })
  })

  it('una sola falta se dice en singular', () => {
    const uno = armarFaltasDeLaSemana(GRUPO, pasarLista('2026-09-07', [1]), LUNES)
    const cifra = faltasComoDocumento(uno, TEXTOS).bloques.find((b) => b.tipo === 'cifra')

    expect(cifra).toMatchObject({ valor: '1', leyenda: 'falta esta semana' })
  })

  it('la tabla trae un renglón por día, con la fecha ya escrita', () => {
    const doc = faltasComoDocumento(reporte(), TEXTOS)
    const tabla = doc.bloques.find((b) => b.tipo === 'tabla')

    expect(tabla?.filas).toEqual([
      { etiqueta: 'lunes, 7 de septiembre', valor: '2', detalle: '1 niño · 1 niña' },
      { etiqueta: 'martes, 8 de septiembre', valor: '1', detalle: '1 niño' },
    ])
  })

  it('un día sin faltas no arrastra un detalle vacío', () => {
    const doc = faltasComoDocumento(
      armarFaltasDeLaSemana(GRUPO, pasarLista('2026-09-07', []), LUNES),
      { ...TEXTOS, porSexo: '', dias: [{ fecha: 'lunes, 7 de septiembre', porSexo: '' }] },
    )
    const tabla = doc.bloques.find((b) => b.tipo === 'tabla')

    expect(tabla?.filas).toEqual([{ etiqueta: 'lunes, 7 de septiembre', valor: '0' }])
    expect(doc.bloques.find((b) => b.tipo === 'cifra')).not.toHaveProperty('detalle')
  })

  it('el criterio va en la hoja: un número sin su definición no se puede defender', () => {
    const doc = faltasComoDocumento(reporte(), TEXTOS)

    expect(doc.bloques.find((b) => b.tipo === 'nota')).toMatchObject({
      texto: 'Solo cuenta quien no vino.',
    })
  })
})
