// IndexedDB no existe en node: fake-indexeddb la provee en memoria.
import 'fake-indexeddb/auto'

import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from '@/data/dexie/db'
import type { Trimestre } from '@/domain/entities'

import {
  abrirCicloEscolar,
  agregarCriterio,
  ajustarFechasTrimestre,
  ajustarPeso,
  cicloEnCurso,
  copiarEsquemaDe,
  esquemaDelTrimestre,
  estadoDelReparto,
  guardarFechas,
  nombreDeCicloEn,
  type Periodo,
  periodosCompletos,
  periodosDe,
  periodosVacios,
  quitarCriterio,
  revisarPeriodos,
  TIPOS_OFRECIDOS,
  trimestreDe,
  trimestreParaCopiar,
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
  await db.criterios.clear()
  await db.criterios_trimestre.clear()
  await db.outbox.clear()
})

/** Un ciclo recién abierto, con sus tres trimestres. */
async function unCiclo() {
  await abrirCicloEscolar('2026–2027', BUENOS)
  return (await cicloEnCurso())!
}

async function primerTrimestre(): Promise<Trimestre> {
  return (await unCiclo()).trimestres[0]!
}

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

describe('estadoDelReparto', () => {
  const conPesos = (...pesos: number[]) => ({
    trimestre: trimestre(1, '2026-08-24', '2026-11-27'),
    criterios: pesos.map((peso, i) => ({
      ponderado: {
        id: `ct-${i}`,
        updated_at: '2026-08-24T00:00:00.000Z',
        deleted_at: null,
        trimestre_id: 'trimestre-1',
        criterio_id: `criterio-${i}`,
        peso,
        orden: i,
        rubrica_id: null,
        meta_participacion: null,
      },
      criterio: {
        id: `criterio-${i}`,
        updated_at: '2026-08-24T00:00:00.000Z',
        deleted_at: null,
        nombre: `Criterio ${i}`,
        tipo: 'entregable' as const,
      },
    })),
  })

  it('sin esquema el total es 0 y no cierra', () => {
    expect(estadoDelReparto(null)).toEqual({ total: 0, cierra: false, faltan: 100 })
  })

  it('sin criterios no cierra, aunque el total sea 0', () => {
    // Cerrar un trimestre vacío escribiría un snapshot indistinguible de uno en
    // el que todos sacaron 0.
    expect(estadoDelReparto(conPesos()).cierra).toBe(false)
  })

  it('dice cuánto falta mientras se reparte', () => {
    const reparto = estadoDelReparto(conPesos(40, 30))
    expect(reparto.total).toBe(70)
    expect(reparto.faltan).toBe(30)
    expect(reparto.cierra).toBe(false)
  })

  it('dice cuánto sobra si se pasó de 100', () => {
    const reparto = estadoDelReparto(conPesos(60, 60))
    expect(reparto.total).toBe(120)
    expect(reparto.faltan).toBe(-20)
    expect(reparto.cierra).toBe(false)
  })

  it('cierra cuando suma 100', () => {
    expect(estadoDelReparto(conPesos(50, 30, 20)).cierra).toBe(true)
  })
})

describe('agregarCriterio', () => {
  it('agrega el criterio con peso 0', async () => {
    const t1 = await primerTrimestre()
    await agregarCriterio(t1, 'Tareas', 'entregable')

    const esquema = await esquemaDelTrimestre(t1.id)
    expect(esquema?.criterios[0]?.criterio.nombre).toBe('Tareas')
    expect(esquema?.criterios[0]?.ponderado.peso).toBe(0)
  })

  it('recorta el nombre y colapsa los espacios de sobra', async () => {
    const t1 = await primerTrimestre()
    await agregarCriterio(t1, '  Trabajos   en clase  ', 'entregable')

    const esquema = await esquemaDelTrimestre(t1.id)
    expect(esquema?.criterios[0]?.criterio.nombre).toBe('Trabajos en clase')
  })

  it('rechaza un nombre vacío', async () => {
    const t1 = await primerTrimestre()
    await expect(agregarCriterio(t1, '   ', 'entregable')).rejects.toThrow(/nombre/)
  })

  it('un trimestre cerrado no admite criterios nuevos', async () => {
    const t1 = await primerTrimestre()
    await expect(
      agregarCriterio({ ...t1, estado: 'cerrado' }, 'Tareas', 'entregable'),
    ).rejects.toThrow(/cerrado/)
    expect((await esquemaDelTrimestre(t1.id))?.criterios).toEqual([])
  })
})

describe('ajustarPeso', () => {
  it('acepta un reparto que no suma 100: solo el cierre lo exige', async () => {
    const t1 = await primerTrimestre()
    await agregarCriterio(t1, 'Tareas', 'entregable')
    const fila = (await esquemaDelTrimestre(t1.id))!.criterios[0]!.ponderado

    // Editar pasa siempre por estados intermedios inválidos; bloquear el guardado
    // obligaría a cuadrar la pantalla antes de poder salir de ella.
    await ajustarPeso(t1, fila.id, 35)

    const esquema = await esquemaDelTrimestre(t1.id)
    expect(esquema?.criterios[0]?.ponderado.peso).toBe(35)
    expect(estadoDelReparto(esquema).cierra).toBe(false)
  })

  it('acepta los extremos 0 y 100', async () => {
    const t1 = await primerTrimestre()
    await agregarCriterio(t1, 'Tareas', 'entregable')
    const fila = (await esquemaDelTrimestre(t1.id))!.criterios[0]!.ponderado

    await ajustarPeso(t1, fila.id, 100)
    expect((await esquemaDelTrimestre(t1.id))?.criterios[0]?.ponderado.peso).toBe(100)
    await ajustarPeso(t1, fila.id, 0)
    expect((await esquemaDelTrimestre(t1.id))?.criterios[0]?.ponderado.peso).toBe(0)
  })

  it('rechaza lo que no es un peso', async () => {
    const t1 = await primerTrimestre()
    await agregarCriterio(t1, 'Tareas', 'entregable')
    const fila = (await esquemaDelTrimestre(t1.id))!.criterios[0]!.ponderado

    await expect(ajustarPeso(t1, fila.id, -1)).rejects.toThrow(/0 a 100/)
    await expect(ajustarPeso(t1, fila.id, 101)).rejects.toThrow(/0 a 100/)
    await expect(ajustarPeso(t1, fila.id, Number.NaN)).rejects.toThrow(/0 a 100/)
  })

  it('un trimestre cerrado no admite cambios de peso', async () => {
    const t1 = await primerTrimestre()
    await agregarCriterio(t1, 'Tareas', 'entregable')
    const fila = (await esquemaDelTrimestre(t1.id))!.criterios[0]!.ponderado

    await expect(
      ajustarPeso({ ...t1, estado: 'cerrado' }, fila.id, 50),
    ).rejects.toThrow(/cerrado/)
    expect((await esquemaDelTrimestre(t1.id))?.criterios[0]?.ponderado.peso).toBe(0)
  })
})

describe('quitarCriterio', () => {
  it('lo saca del trimestre', async () => {
    const t1 = await primerTrimestre()
    await agregarCriterio(t1, 'Tareas', 'entregable')
    const fila = (await esquemaDelTrimestre(t1.id))!.criterios[0]!.ponderado

    await quitarCriterio(t1, fila.id)

    expect((await esquemaDelTrimestre(t1.id))?.criterios).toEqual([])
  })

  it('un trimestre cerrado no admite quitar criterios', async () => {
    const t1 = await primerTrimestre()
    await agregarCriterio(t1, 'Tareas', 'entregable')
    const fila = (await esquemaDelTrimestre(t1.id))!.criterios[0]!.ponderado

    await expect(quitarCriterio({ ...t1, estado: 'cerrado' }, fila.id)).rejects.toThrow(
      /cerrado/,
    )
    expect((await esquemaDelTrimestre(t1.id))?.criterios).toHaveLength(1)
  })
})

describe('copiarEsquemaDe', () => {
  it('copia criterios y pesos al trimestre siguiente', async () => {
    const ciclo = await unCiclo()
    const [t1, t2] = ciclo.trimestres as [Trimestre, Trimestre]
    await agregarCriterio(t1, 'Tareas', 'entregable')
    const fila = (await esquemaDelTrimestre(t1.id))!.criterios[0]!.ponderado
    await ajustarPeso(t1, fila.id, 60)

    await copiarEsquemaDe(t1, t2)

    const copia = (await esquemaDelTrimestre(t2.id))!.criterios
    expect(copia[0]?.criterio.nombre).toBe('Tareas')
    expect(copia[0]?.ponderado.peso).toBe(60)
  })

  it('no se copia un trimestre sobre sí mismo', async () => {
    const t1 = await primerTrimestre()
    await expect(copiarEsquemaDe(t1, t1)).rejects.toThrow(/sí mismo/)
  })

  it('no copia entre ciclos distintos', async () => {
    const ciclo = await unCiclo()
    const [t1, t2] = ciclo.trimestres as [Trimestre, Trimestre]
    await expect(
      copiarEsquemaDe(t1, { ...t2, ciclo_id: 'otro-ciclo' }),
    ).rejects.toThrow(/mismo ciclo/)
  })

  it('un trimestre cerrado no admite recibir una copia', async () => {
    const ciclo = await unCiclo()
    const [t1, t2] = ciclo.trimestres as [Trimestre, Trimestre]
    await agregarCriterio(t1, 'Tareas', 'entregable')

    await expect(copiarEsquemaDe(t1, { ...t2, estado: 'cerrado' })).rejects.toThrow(/cerrado/)
    expect((await esquemaDelTrimestre(t2.id))?.criterios).toEqual([])
  })
})

describe('trimestreParaCopiar', () => {
  it('ofrece el anterior por número', async () => {
    const ciclo = await unCiclo()
    const [t1, t2, t3] = ciclo.trimestres as [Trimestre, Trimestre, Trimestre]
    expect(trimestreParaCopiar(t2, ciclo)?.id).toBe(t1.id)
    expect(trimestreParaCopiar(t3, ciclo)?.id).toBe(t2.id)
  })

  it('el primero no tiene de dónde copiar', async () => {
    const ciclo = await unCiclo()
    const [t1] = ciclo.trimestres as [Trimestre]
    expect(trimestreParaCopiar(t1, ciclo)).toBeNull()
  })
})

describe('TIPOS_OFRECIDOS', () => {
  it('no ofrece los criterios automáticos, que están pospuestos', () => {
    const tipos = TIPOS_OFRECIDOS.map((t) => t.tipo)
    expect(tipos).not.toContain('auto_puntualidad')
    expect(tipos).not.toContain('auto_conducta')
    expect(tipos).not.toContain('auto_participacion')
  })

  it('no ofrece personalizado, que no tiene forma de captura', () => {
    // Elegirlo la llevaría a crear un criterio sin pantalla donde llenarse.
    expect(TIPOS_OFRECIDOS.map((t) => t.tipo)).not.toContain('personalizado')
  })
})
