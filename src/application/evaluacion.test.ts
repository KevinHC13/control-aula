// IndexedDB no existe en node: fake-indexeddb la provee en memoria.
import 'fake-indexeddb/auto'

import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from '@/data/dexie/db'
import type { Trimestre } from '@/domain/entities'

import {
  abrirCicloEscolar,
  ajustarFechasTrimestre,
  cicloEnCurso,
  guardarFechas,
  nombreDeCicloEn,
  type Periodo,
  periodosCompletos,
  periodosDe,
  periodosVacios,
  revisarPeriodos,
  trimestreDe,
} from './evaluacion'

const BUENOS: Periodo[] = [
  { numero: 1, inicio: '2026-08-24', fin: '2026-11-27' },
  { numero: 2, inicio: '2026-11-30', fin: '2027-03-19' },
  { numero: 3, inicio: '2027-03-22', fin: '2027-07-16' },
]

const trimestre = (numero: 1 | 2 | 3, inicio: string, fin: string): Trimestre => ({
  id: `trimestre-${numero}`,
  updated_at: '2026-08-24T00:00:00.000Z',
  deleted_at: null,
  ciclo_id: 'ciclo-1',
  numero,
  inicio,
  fin,
  estado: 'abierto',
  cerrado_en: null,
})

beforeEach(async () => {
  await db.open()
  await db.ciclos.clear()
  await db.trimestres.clear()
  await db.outbox.clear()
})

afterAll(() => {
  db.close()
})

describe('periodosVacios', () => {
  it('arranca con los tres trimestres en blanco', () => {
    expect(periodosVacios().map((p) => p.numero)).toEqual([1, 2, 3])
    expect(periodosVacios().every((p) => p.inicio === '' && p.fin === '')).toBe(true)
  })

  it('en blanco no está completo: no se puede guardar un ciclo sin fechas', () => {
    expect(periodosCompletos(revisarPeriodos(periodosVacios()))).toBe(false)
  })
})

describe('periodosDe', () => {
  it('trae las fechas ya configuradas, en orden', () => {
    const periodos = periodosDe([
      trimestre(3, '2027-03-22', '2027-07-16'),
      trimestre(1, '2026-08-24', '2026-11-27'),
    ])
    expect(periodos.map((p) => p.numero)).toEqual([1, 2, 3])
    expect(periodos[0]?.inicio).toBe('2026-08-24')
  })

  it('un trimestre que falta sale en blanco, no desaparece de la pantalla', () => {
    const periodos = periodosDe([trimestre(1, '2026-08-24', '2026-11-27')])
    expect(periodos).toHaveLength(3)
    expect(periodos[1]).toEqual({ numero: 2, inicio: '', fin: '' })
  })
})

describe('revisarPeriodos', () => {
  it('no marca nada cuando los tres están bien', () => {
    expect(revisarPeriodos(BUENOS).every((p) => p.problema === undefined)).toBe(true)
    expect(periodosCompletos(revisarPeriodos(BUENOS))).toBe(true)
  })

  it('marca el que le faltan fechas', () => {
    const revisados = revisarPeriodos([...BUENOS.slice(0, 2), { numero: 3, inicio: '', fin: '' }])
    expect(revisados[2]?.problema).toBe('Faltan las fechas')
    // Y no contagia a los que están bien.
    expect(revisados[0]?.problema).toBeUndefined()
  })

  it('marca un día que no existe', () => {
    const revisados = revisarPeriodos([
      { numero: 1, inicio: '2026-02-31', fin: '2026-11-27' },
      ...BUENOS.slice(1),
    ])
    expect(revisados[0]?.problema).toBe('La fecha debe ser AAAA-MM-DD')
  })

  it('marca el que termina antes de empezar', () => {
    const revisados = revisarPeriodos([
      { numero: 1, inicio: '2026-11-27', fin: '2026-08-24' },
      ...BUENOS.slice(1),
    ])
    expect(revisados[0]?.problema).toBe('Termina antes de empezar')
  })

  it('marca el traslape en las dos filas y dice con cuál choca', () => {
    // Corregir una tiene que apagar la marca de las dos, así que las dos se
    // marcan.
    const revisados = revisarPeriodos([
      { numero: 1, inicio: '2026-08-24', fin: '2026-12-15' },
      { numero: 2, inicio: '2026-11-30', fin: '2027-03-19' },
      BUENOS[2]!,
    ])
    expect(revisados[0]?.problema).toBe('Se traslapa con el trimestre 2')
    expect(revisados[1]?.problema).toBe('Se traslapa con el trimestre 1')
  })

  it('corregir el traslape apaga las dos marcas', () => {
    const corregidos = revisarPeriodos([
      { numero: 1, inicio: '2026-08-24', fin: '2026-11-27' },
      { numero: 2, inicio: '2026-11-30', fin: '2027-03-19' },
      BUENOS[2]!,
    ])
    expect(corregidos.every((p) => p.problema === undefined)).toBe(true)
  })

  it('un día de hueco entre trimestres es válido: no todo día es de clases', () => {
    const revisados = revisarPeriodos([
      { numero: 1, inicio: '2026-08-24', fin: '2026-11-27' },
      { numero: 2, inicio: '2026-12-07', fin: '2027-03-19' },
      BUENOS[2]!,
    ])
    expect(revisados.every((p) => p.problema === undefined)).toBe(true)
  })

  it('no toca el texto: solo lo juzga', () => {
    // Corre en cada tecla; recortar o reformatear ahí le pelearía al teclado.
    const crudo: Periodo[] = [{ numero: 1, inicio: '2026-8-2', fin: ' 2026-11-27' }]
    const revisados = revisarPeriodos(crudo)
    expect(revisados[0]?.inicio).toBe('2026-8-2')
    expect(revisados[0]?.fin).toBe(' 2026-11-27')
  })
})

describe('nombreDeCicloEn', () => {
  it('de agosto en adelante, el ciclo empieza ese año', () => {
    expect(nombreDeCicloEn('2026-08-24')).toBe('2026–2027')
    expect(nombreDeCicloEn('2026-12-15')).toBe('2026–2027')
  })

  it('antes de agosto, sigue el ciclo del año anterior', () => {
    expect(nombreDeCicloEn('2027-03-19')).toBe('2026–2027')
    expect(nombreDeCicloEn('2027-07-16')).toBe('2026–2027')
  })
})

describe('trimestreDe', () => {
  const ciclo = {
    ciclo: {
      id: 'ciclo-1',
      nombre: '2026–2027',
      estado: 'abierto' as const,
      updated_at: '2026-08-24T00:00:00.000Z',
      deleted_at: null,
    },
    trimestres: [
      trimestre(1, '2026-08-24', '2026-11-27'),
      trimestre(2, '2026-11-30', '2027-03-19'),
      trimestre(3, '2027-03-22', '2027-07-16'),
    ],
  }

  it('atribuye la fecha sin que nadie elija trimestre', () => {
    expect(trimestreDe('2026-09-15', ciclo)?.numero).toBe(1)
    expect(trimestreDe('2027-01-20', ciclo)?.numero).toBe(2)
  })

  it('una fecha fuera de todo rango devuelve null y no falla', () => {
    expect(trimestreDe('2026-11-28', ciclo)).toBeNull()
    expect(trimestreDe('2027-07-20', ciclo)).toBeNull()
  })

  it('sin ciclo configurado devuelve null y no falla', () => {
    expect(trimestreDe('2026-09-15', null)).toBeNull()
  })
})

describe('abrirCicloEscolar', () => {
  it('deja el ciclo en curso con sus tres trimestres', async () => {
    await abrirCicloEscolar('2026–2027', BUENOS)

    const enCurso = await cicloEnCurso()
    expect(enCurso?.ciclo.nombre).toBe('2026–2027')
    expect(enCurso?.trimestres.map((t) => t.inicio)).toEqual([
      '2026-08-24',
      '2026-11-30',
      '2027-03-22',
    ])
  })

  it('recorta el nombre y rechaza el vacío', async () => {
    await expect(abrirCicloEscolar('   ', BUENOS)).rejects.toThrow(/nombre/)
    await abrirCicloEscolar('  2026–2027  ', BUENOS)
    expect((await cicloEnCurso())?.ciclo.nombre).toBe('2026–2027')
  })

  it('no abre un ciclo con fechas traslapadas', async () => {
    await expect(
      abrirCicloEscolar('2026–2027', [
        { numero: 1, inicio: '2026-08-24', fin: '2026-12-15' },
        { numero: 2, inicio: '2026-11-30', fin: '2027-03-19' },
        BUENOS[2]!,
      ]),
    ).rejects.toThrow()
    expect(await cicloEnCurso()).toBeNull()
  })

  it('no abre un segundo ciclo mientras haya uno en curso', async () => {
    await abrirCicloEscolar('2026–2027', BUENOS)
    // Dos ciclos abiertos harían ambigua la atribución de una fecha, que es
    // justo lo que este commit vuelve inequívoco.
    await expect(abrirCicloEscolar('2027–2028', BUENOS)).rejects.toThrow(/abierto/)
    expect(await db.ciclos.count()).toBe(1)
  })
})

describe('ajustarFechasTrimestre', () => {
  it('un trimestre cerrado no admite cambios de fecha', async () => {
    await abrirCicloEscolar('2026–2027', BUENOS)
    const enCurso = (await cicloEnCurso())!
    const primero = enCurso.trimestres[0]!
    await db.trimestres.update(primero.id, { estado: 'cerrado' })

    // Sus calificaciones ya salieron en una boleta: mover las fechas movería
    // registros de asistencia de un trimestre a otro después del hecho.
    await expect(
      ajustarFechasTrimestre({ ...primero, estado: 'cerrado' }, '2026-08-25', '2026-12-04'),
    ).rejects.toThrow(/cerrado/)

    expect((await db.trimestres.get(primero.id))?.inicio).toBe('2026-08-24')
  })

  it('rechaza una fecha que no existe', async () => {
    await abrirCicloEscolar('2026–2027', BUENOS)
    const primero = (await cicloEnCurso())!.trimestres[0]!
    await expect(
      ajustarFechasTrimestre(primero, '2026-02-31', '2026-12-04'),
    ).rejects.toThrow(/AAAA-MM-DD/)
  })

  it('rechaza el rango invertido', async () => {
    await abrirCicloEscolar('2026–2027', BUENOS)
    const primero = (await cicloEnCurso())!.trimestres[0]!
    await expect(
      ajustarFechasTrimestre(primero, '2026-12-04', '2026-08-25'),
    ).rejects.toThrow(/antes de empezar/)
  })
})

describe('guardarFechas', () => {
  it('escribe solo lo que cambió', async () => {
    await abrirCicloEscolar('2026–2027', BUENOS)
    const enCurso = (await cicloEnCurso())!
    await db.outbox.clear()

    await guardarFechas(enCurso, [
      { numero: 1, inicio: '2026-08-25', fin: '2026-11-27' },
      ...BUENOS.slice(1),
    ])

    // Un solo pendiente: los otros dos trimestres no se tocaron, así que no
    // llenan la outbox de cambios que el servidor tendría que procesar igual.
    expect(await db.outbox.count()).toBe(1)
    expect((await cicloEnCurso())?.trimestres[0]?.inicio).toBe('2026-08-25')
  })

  it('no escribe nada si nada cambió', async () => {
    await abrirCicloEscolar('2026–2027', BUENOS)
    const enCurso = (await cicloEnCurso())!
    await db.outbox.clear()

    await guardarFechas(enCurso, periodosDe(enCurso.trimestres))

    expect(await db.outbox.count()).toBe(0)
  })

  it('salta los cerrados sin fallar, y guarda los abiertos', async () => {
    await abrirCicloEscolar('2026–2027', BUENOS)
    let enCurso = (await cicloEnCurso())!
    await db.trimestres.update(enCurso.trimestres[0]!.id, { estado: 'cerrado' })
    enCurso = (await cicloEnCurso())!

    await guardarFechas(enCurso, [
      { numero: 1, inicio: '2026-08-25', fin: '2026-11-27' },
      { numero: 2, inicio: '2026-12-01', fin: '2027-03-19' },
      BUENOS[2]!,
    ])

    const despues = (await cicloEnCurso())!.trimestres
    // El cerrado se queda como estaba; el abierto sí se movió.
    expect(despues[0]?.inicio).toBe('2026-08-24')
    expect(despues[1]?.inicio).toBe('2026-12-01')
  })

  it('rechaza el guardado completo si algún periodo está mal', async () => {
    await abrirCicloEscolar('2026–2027', BUENOS)
    const enCurso = (await cicloEnCurso())!

    await expect(
      guardarFechas(enCurso, [
        { numero: 1, inicio: '2026-08-24', fin: '2026-12-15' },
        ...BUENOS.slice(1),
      ]),
    ).rejects.toThrow()
    expect((await cicloEnCurso())?.trimestres[0]?.fin).toBe('2026-11-27')
  })
})
