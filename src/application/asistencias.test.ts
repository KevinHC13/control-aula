import { describe, expect, it } from 'vitest'

import type { Alumno, RegistroAsistencia } from '@/domain/entities'
import type { EstadoAsistencia, Sexo } from '@/domain/values'

import { armarAsistenciasDeLaSemana, asistenciasComoDocumento } from './asistencias'

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

describe('armarAsistenciasDeLaSemana', () => {
  it('parte las asistencias de la semana en niños, niñas y sin asignar', () => {
    const reporte = armarAsistenciasDeLaSemana(
      GRUPO,
      [...pasarLista('2026-09-07', [1, 4]), ...pasarLista('2026-09-08', [2, 5, 6])],
      LUNES,
    )

    // Doce posibles: seis alumnos por dos días. Faltaron cinco.
    expect(reporte.asistencias).toBe(7)
    expect(reporte.asistieron).toEqual({ ninos: 4, ninas: 2, sinAsignar: 1 })
  })

  it('la falta se parte por sexo igual que la asistencia', () => {
    // Desglosar una y dejar la otra en bruto se lee como si a la segunda le
    // faltara el dato (D-032).
    const reporte = armarAsistenciasDeLaSemana(
      GRUPO,
      [...pasarLista('2026-09-07', [1, 4]), ...pasarLista('2026-09-08', [2, 5, 6])],
      LUNES,
    )

    expect(reporte.faltas).toBe(5)
    expect(reporte.faltaron).toEqual({ ninos: 2, ninas: 2, sinAsignar: 1 })
    expect(reporte.dias[0]?.faltaron).toEqual({ ninos: 1, ninas: 1, sinAsignar: 0 })
  })

  it('los dos cortes se reparten lo posible, sin solaparse', () => {
    // Es lo que permite enseñarlos juntos sin que nadie compruebe que cuadran.
    const reporte = armarAsistenciasDeLaSemana(
      GRUPO,
      [...pasarLista('2026-09-07', [1, 4]), ...pasarLista('2026-09-08', [2])],
      LUNES,
    )

    for (const cual of ['ninos', 'ninas', 'sinAsignar'] as const) {
      expect(reporte.asistieron[cual] + reporte.faltaron[cual]).toBe(
        reporte.dias.reduce(
          (total, d) => total + d.asistieron[cual] + d.faltaron[cual],
          0,
        ),
      )
    }
    expect(reporte.asistencias + reporte.faltas).toBe(reporte.posibles)
  })

  it('la asistencia y la falta suman lo posible, cada día y en la semana', () => {
    // Es lo que permite escribir la cifra como «10 / 12» sin un tercer recuento.
    const reporte = armarAsistenciasDeLaSemana(
      GRUPO,
      [...pasarLista('2026-09-07', [1, 4]), ...pasarLista('2026-09-08', [2])],
      LUNES,
    )

    expect(reporte.asistencias + reporte.faltas).toBe(reporte.posibles)
    expect(reporte.posibles).toBe(12)
    for (const d of reporte.dias) {
      expect(d.asistencias + d.faltas).toBe(d.posibles)
    }
  })

  it('cuenta asistencias y no alumnos: el que viene dos días suma dos', () => {
    const reporte = armarAsistenciasDeLaSemana(
      GRUPO,
      [...pasarLista('2026-09-07', [1, 2, 3, 4, 5]), ...pasarLista('2026-09-08', [1, 2, 3, 4, 5])],
      LUNES,
    )

    // Solo el 6 vino, los dos días.
    expect(reporte.asistencias).toBe(2)
    expect(reporte.asistieron.sinAsignar).toBe(2)
  })

  it('los días suman exactamente el total de la semana', () => {
    const reporte = armarAsistenciasDeLaSemana(
      GRUPO,
      [
        ...pasarLista('2026-09-07', [1, 4]),
        ...pasarLista('2026-09-08', [2]),
        ...pasarLista('2026-09-09', [1, 5, 6]),
      ],
      LUNES,
    )

    const sumado = (campo: 'asistencias' | 'faltas' | 'posibles') =>
      reporte.dias.reduce((total, d) => total + d[campo], 0)
    const sumadoDelCorte = (cual: 'asistieron' | 'faltaron', que: 'ninos' | 'ninas' | 'sinAsignar') =>
      reporte.dias.reduce((total, d) => total + d[cual][que], 0)

    expect(sumado('asistencias')).toBe(reporte.asistencias)
    expect(sumado('faltas')).toBe(reporte.faltas)
    expect(sumado('posibles')).toBe(reporte.posibles)
    for (const cual of ['asistieron', 'faltaron'] as const) {
      for (const que of ['ninos', 'ninas', 'sinAsignar'] as const) {
        expect(sumadoDelCorte(cual, que)).toBe(reporte[cual][que])
      }
    }
  })

  it('devuelve los días en orden, del lunes en adelante', () => {
    const reporte = armarAsistenciasDeLaSemana(
      GRUPO,
      [
        ...pasarLista('2026-09-09', [1]),
        ...pasarLista('2026-09-07', [1]),
        ...pasarLista('2026-09-11', [1]),
      ],
      LUNES,
    )

    expect(reporte.dias.map((d) => d.fecha)).toEqual(['2026-09-07', '2026-09-09', '2026-09-11'])
  })

  it('un día sin registros no sale en cero: no sale', () => {
    // El martes es festivo y nadie pasó lista. Un cero diría «no vino nadie».
    const reporte = armarAsistenciasDeLaSemana(
      GRUPO,
      [...pasarLista('2026-09-07', [1]), ...pasarLista('2026-09-09', [2])],
      LUNES,
    )

    expect(reporte.dias.map((d) => d.fecha)).toEqual(['2026-09-07', '2026-09-09'])
  })

  it('una semana sin pasar lista devuelve la semana vacía, no un cero', () => {
    const reporte = armarAsistenciasDeLaSemana(GRUPO, [], LUNES)

    expect(reporte.dias).toEqual([])
    expect(reporte.asistencias).toBe(0)
    expect(reporte.posibles).toBe(0)
  })

  it('una semana en la que vinieron todos no tiene faltas', () => {
    const reporte = armarAsistenciasDeLaSemana(GRUPO, pasarLista('2026-09-07', []), LUNES)

    expect(reporte.dias).toHaveLength(1)
    expect(reporte.asistencias).toBe(6)
    expect(reporte.faltas).toBe(0)
  })

  it('el retardo y la justificada son asistencia', () => {
    // La misma regla que el contador diario: asistir es no estar ausente.
    const reporte = armarAsistenciasDeLaSemana(
      GRUPO,
      [
        dia(1, '2026-09-07', 'retardo'),
        dia(2, '2026-09-07', 'justificada'),
        dia(3, '2026-09-07', 'ausente'),
      ],
      LUNES,
    )

    // El 4, el 5 y el 6 no tienen registro y salen presentes: cinco asistencias.
    expect(reporte.asistencias).toBe(5)
    expect(reporte.asistieron.ninos).toBe(2)
    expect(reporte.faltas).toBe(1)
    expect(reporte.faltaron).toEqual({ ninos: 1, ninas: 0, sinAsignar: 0 })
  })

  it('dice quiénes faltaron cada día, aunque la cifra sea de asistencias', () => {
    const reporte = armarAsistenciasDeLaSemana(GRUPO, pasarLista('2026-09-07', [4, 1]), LUNES)

    expect(reporte.dias[0]?.ausentes.map((a) => a.numero_lista)).toEqual([1, 4])
  })

  it('los nombres salen en el orden del grupo, que es el alfabético', () => {
    // El grupo llega ordenado por el adaptador (D-030) y `filasDelDia` lo
    // conserva, así que la lista de ausentes sale igual sin ordenar aquí.
    const reporte = armarAsistenciasDeLaSemana(GRUPO, pasarLista('2026-09-07', [5, 2, 6]), LUNES)

    expect(reporte.dias[0]?.ausentes.map((a) => a.nombre)).toEqual([
      'Apellido2, Nombre',
      'Apellido5, Nombre',
      'Apellido6, Nombre',
    ])
  })

  it('la lista de nombres y la cifra de faltas no pueden discrepar', () => {
    const reporte = armarAsistenciasDeLaSemana(
      GRUPO,
      [
        ...pasarLista('2026-09-07', [1, 4, 5]),
        dia(2, '2026-09-08', 'retardo'),
        dia(3, '2026-09-08', 'ausente'),
      ],
      LUNES,
    )

    for (const d of reporte.dias) {
      expect(d.ausentes).toHaveLength(d.faltas)
    }
  })

  it('un retardo no aparece entre los nombres', () => {
    const reporte = armarAsistenciasDeLaSemana(
      GRUPO,
      [dia(1, '2026-09-07', 'retardo'), dia(2, '2026-09-07', 'ausente')],
      LUNES,
    )

    expect(reporte.dias[0]?.ausentes.map((a) => a.numero_lista)).toEqual([2])
  })

  it('un día sin faltas no trae nombres', () => {
    const reporte = armarAsistenciasDeLaSemana(GRUPO, pasarLista('2026-09-07', []), LUNES)

    expect(reporte.dias[0]?.ausentes).toEqual([])
  })

  it('el que no tiene sexo se dice aparte, no se reparte', () => {
    const reporte = armarAsistenciasDeLaSemana(
      GRUPO,
      pasarLista('2026-09-07', [1, 2, 3, 4, 5]),
      LUNES,
    )

    expect(reporte.asistieron).toEqual({ ninos: 0, ninas: 0, sinAsignar: 1 })
    expect(reporte.faltaron).toEqual({ ninos: 3, ninas: 2, sinAsignar: 0 })
    expect(reporte.asistencias).toBe(1)
  })

  it('el rango de la semana va del lunes al domingo', () => {
    expect(armarAsistenciasDeLaSemana(GRUPO, [], LUNES)).toMatchObject({
      desde: '2026-09-07',
      hasta: '2026-09-13',
    })
  })

  it('deja fuera lo que cae fuera de la semana, aunque se lo pasen', () => {
    // La pura tiene que dar lo mismo le entreguen la semana justa o el mes.
    const reporte = armarAsistenciasDeLaSemana(
      GRUPO,
      [
        ...pasarLista('2026-09-06', [1, 2, 3]),
        ...pasarLista('2026-09-07', [1]),
        ...pasarLista('2026-09-14', [1, 2]),
      ],
      LUNES,
    )

    expect(reporte.dias.map((d) => d.fecha)).toEqual(['2026-09-07'])
    expect(reporte.asistencias).toBe(5)
  })

  it('el que ya no está en el grupo no asiste ni falta', () => {
    // `asistenciasDeLaSemana` lee `lista()`, que no trae a los dados de baja: sus
    // registros viejos siguen en la base y no deben sumar.
    const reporte = armarAsistenciasDeLaSemana(
      GRUPO,
      [...pasarLista('2026-09-07', [1]), dia(99, '2026-09-07', 'ausente')],
      LUNES,
    )

    expect(reporte.posibles).toBe(6)
    expect(reporte.asistencias).toBe(5)
    expect(reporte.faltas).toBe(1)
  })
})

describe('asistenciasComoDocumento', () => {
  const TEXTOS = {
    periodo: 'del 7 al 11 de septiembre de 2026',
    grupo: '3.º B',
    asistieron: 'Asistieron 4 niños · 3 niñas · 2 sin asignar',
    faltaron: 'Faltaron 2 niños · 1 niña',
    dias: [
      {
        fecha: 'lunes, 7 de septiembre',
        asistieron: 'Asistieron 2 niños · 1 niña · 1 sin asignar',
        faltaron: 'Faltaron 1 niño · 1 niña',
      },
      {
        fecha: 'martes, 8 de septiembre',
        asistieron: 'Asistieron 2 niños · 2 niñas · 1 sin asignar',
        faltaron: 'Faltaron 1 niño',
      },
    ],
    nota: 'El retardo y la justificada cuentan como asistencia.',
  }

  const reporte = () =>
    armarAsistenciasDeLaSemana(
      GRUPO,
      [...pasarLista('2026-09-07', [1, 4]), ...pasarLista('2026-09-08', [2])],
      LUNES,
    )

  it('lleva el grupo y el periodo en el subtítulo', () => {
    // Una hoja impresa se separa de su iPad: sin el grupo, «del 7 al 11» no dice
    // de quién es.
    expect(asistenciasComoDocumento(reporte(), TEXTOS).subtitulo).toBe(
      '3.º B · del 7 al 11 de septiembre de 2026',
    )
  })

  it('sin nombre de grupo no deja un separador suelto', () => {
    expect(asistenciasComoDocumento(reporte(), { ...TEXTOS, grupo: '  ' }).subtitulo).toBe(
      'del 7 al 11 de septiembre de 2026',
    )
  })

  it('la cifra grande lleva su denominador: «138» sola no se puede juzgar', () => {
    const doc = asistenciasComoDocumento(reporte(), TEXTOS)
    const cifra = doc.bloques.find((b) => b.tipo === 'cifra')

    expect(cifra).toMatchObject({ valor: '9 / 12', leyenda: 'asistencias esta semana' })
  })

  it('las dos cuentas van debajo de la cifra, enteras y con su verbo', () => {
    // Desglosar una y dejar la otra en bruto se lee como si a la segunda le
    // faltara el dato (D-032).
    const doc = asistenciasComoDocumento(reporte(), TEXTOS)
    const cifra = doc.bloques.find((b) => b.tipo === 'cifra')

    expect(cifra).toMatchObject({
      detalle: 'Asistieron 4 niños · 3 niñas · 2 sin asignar — Faltaron 2 niños · 1 niña',
    })
  })

  it('una sola asistencia se dice en singular', () => {
    const uno = armarAsistenciasDeLaSemana(
      GRUPO,
      [dia(1, '2026-09-07', 'presente')],
      LUNES,
    )
    const cifra = asistenciasComoDocumento(uno, TEXTOS).bloques.find((b) => b.tipo === 'cifra')

    // Un solo registro no hace un día de un solo alumno: el resto sale presente.
    expect(cifra).toMatchObject({ valor: '6 / 6', leyenda: 'asistencias esta semana' })
  })

  it('la tabla trae un renglón por día, con la fecha ya escrita', () => {
    const doc = asistenciasComoDocumento(reporte(), TEXTOS)
    const tabla = doc.bloques.find((b) => b.tipo === 'tabla')

    expect(tabla?.encabezados).toEqual({ izquierda: 'día', derecha: 'asisten' })
    expect(tabla?.filas).toEqual([
      {
        etiqueta: 'lunes, 7 de septiembre',
        valor: '4',
        detalle: 'Asistieron 2 niños · 1 niña · 1 sin asignar — Faltaron 1 niño · 1 niña',
        lineas: [' 1 · Apellido1, Nombre', ' 4 · Apellido4, Nombre'],
      },
      {
        etiqueta: 'martes, 8 de septiembre',
        valor: '5',
        detalle: 'Asistieron 2 niños · 2 niñas · 1 sin asignar — Faltaron 1 niño',
        lineas: [' 2 · Apellido2, Nombre'],
      },
    ])
  })

  it('cada día lleva los nombres de quienes faltaron, con el número por delante', () => {
    const doc = asistenciasComoDocumento(reporte(), TEXTOS)
    const tabla = doc.bloques.find((b) => b.tipo === 'tabla')

    // El número va primero porque es por donde se cotejan estas faltas contra la
    // lista de la escuela, que va numerada.
    expect(tabla?.filas[0]?.lineas).toEqual([' 1 · Apellido1, Nombre', ' 4 · Apellido4, Nombre'])
    expect(tabla?.filas[1]?.lineas).toEqual([' 2 · Apellido2, Nombre'])
  })

  it('un día en que vinieron todos no arrastra un detalle vacío ni un hueco', () => {
    const doc = asistenciasComoDocumento(
      armarAsistenciasDeLaSemana(GRUPO, pasarLista('2026-09-07', []), LUNES),
      {
        ...TEXTOS,
        asistieron: '',
        faltaron: '',
        dias: [{ fecha: 'lunes, 7 de septiembre', asistieron: '', faltaron: '' }],
      },
    )
    const tabla = doc.bloques.find((b) => b.tipo === 'tabla')

    expect(tabla?.filas).toEqual([{ etiqueta: 'lunes, 7 de septiembre', valor: '6' }])
    // Ni un `lineas: []`, que en el PDF sería un hueco sin explicación.
    expect(doc.bloques.find((b) => b.tipo === 'cifra')).not.toHaveProperty('detalle')
  })

  it('una semana sin faltas no deja el separador de las dos frases colgando', () => {
    const doc = asistenciasComoDocumento(
      armarAsistenciasDeLaSemana(GRUPO, pasarLista('2026-09-07', []), LUNES),
      {
        ...TEXTOS,
        faltaron: '',
        dias: [{ fecha: 'lunes', asistieron: 'Asistieron 3 niños', faltaron: '' }],
      },
    )

    expect(doc.bloques.find((b) => b.tipo === 'cifra')).toMatchObject({
      detalle: 'Asistieron 4 niños · 3 niñas · 2 sin asignar',
    })
    expect(doc.bloques.find((b) => b.tipo === 'tabla')?.filas[0]).toMatchObject({
      detalle: 'Asistieron 3 niños',
    })
  })

  it('el criterio va en la hoja: un número sin su definición no se puede defender', () => {
    const doc = asistenciasComoDocumento(reporte(), TEXTOS)

    expect(doc.bloques.find((b) => b.tipo === 'nota')).toMatchObject({
      texto: 'El retardo y la justificada cuentan como asistencia.',
    })
  })
})
