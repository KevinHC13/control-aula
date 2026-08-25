// IndexedDB no existe en node: fake-indexeddb la provee en memoria.
import 'fake-indexeddb/auto'

import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { repos } from '@/data'
import { db } from '@/data/dexie/db'
import type { Actividad, Criterio, CriterioTrimestre, TipoCriterio, Trimestre } from '@/domain/entities'
import { CAMPOS_FORMATIVOS } from '@/domain/values'

import {
  abrirCicloEscolar,
  abrirTrimestreSiguiente,
  activarRubrica,
  actividadesDelTrimestre,
  agregarCriterio,
  ajustarFechasTrimestre,
  ajustarPeso,
  borrarActividad,
  borrarRubrica,
  cambiaLaCaptura,
  CAMPOS_CON_NOMBRE,
  cerrarCicloEscolar,
  cicloEnCurso,
  copiarEsquemaDe,
  crearActividad,
  desactivarRubrica,
  editarActividad,
  EJES_ARTICULADORES,
  esquemaDelTrimestre,
  estaCalificada,
  loQueFaltaParaCerrarCiclo,
  estadoDelReparto,
  guardarFechas,
  guardarRubrica,
  faltaAbrirTrimestre,
  nombreDeCicloEn,
  nombreSugerido,
  type Periodo,
  periodoVacio,
  periodosCompletos,
  periodosDe,
  revisarNuevoTrimestre,
  siguienteNumero,
  quitarCriterio,
  revisarPeriodos,
  revisarRubrica,
  rubricaEnEdicion,
  rubricaLista,
  rubricaSugerida,
  rubricas,
  rubricaVacia,
  TIPOS_OFRECIDOS,
  trimestreDe,
  trimestreParaCopiar,
  fijarMetaParticipacion,
  fijarRetardosPorFalta,
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
  await db.rubricas.clear()
  await db.rubrica_criterios.clear()
  await db.actividades.clear()
  await db.entregas.clear()
  await db.eval_rubrica.clear()
  await db.outbox.clear()
})

/**
 * Un ciclo con sus tres trimestres. El ciclo se abre con el primero y los otros dos
 * entran después, que es como lo hace la pantalla.
 */
async function unCiclo() {
  await abrirCicloEscolar('2026–2027', BUENOS[0]!)
  await abrirTrimestreSiguiente((await cicloEnCurso())!, BUENOS[1]!)
  await abrirTrimestreSiguiente((await cicloEnCurso())!, BUENOS[2]!)
  return (await cicloEnCurso())!
}

async function primerTrimestre(): Promise<Trimestre> {
  return (await unCiclo()).trimestres[0]!
}

afterAll(() => {
  db.close()
})

const unaActividad = (): Actividad => ({
  id: 'actividad-1',
  updated_at: '2026-09-01T00:00:00.000Z',
  deleted_at: null,
  criterio_trimestre_id: 'ct-1',
  nombre: 'Cuento de terror',
  campo: 'lenguajes',
  ejes: [],
  fecha: '2026-09-01',
  rubrica_id: null,
})

const unPonderado = (): CriterioTrimestre => ({
  id: 'ct-1',
  updated_at: '2026-08-24T00:00:00.000Z',
  deleted_at: null,
  trimestre_id: 'trimestre-1',
  criterio_id: 'criterio-1',
  peso: 40,
  orden: 0,
  meta_participacion: null,
  retardos_por_falta: null,
})

const unCriterio = (tipo: TipoCriterio): Criterio => ({
  id: 'criterio-1',
  updated_at: '2026-08-24T00:00:00.000Z',
  deleted_at: null,
  nombre: 'Tareas',
  tipo,
})

/**
 * Un ciclo con un criterio entregable en T1, y opcionalmente una rúbrica lista
 * para asignársela a una actividad.
 */
async function unCriterioEnT1(conRubrica = false) {
  const ciclo = await unCiclo()
  const trimestre = ciclo.trimestres[0]!
  await agregarCriterio(trimestre, 'Tareas', 'entregable')
  const criterio = (await esquemaDelTrimestre(trimestre.id))!.criterios[0]!

  const rubricaId = conRubrica
    ? await guardarRubrica({
        nombre: 'Trabajo escrito',
        renglones: [
          { nombre: 'Ortografía', descriptores: ['a', 'b', 'c', 'd'] },
        ],
      })
    : null

  return {
    trimestre,
    criterio: criterio.criterio,
    ponderadoId: criterio.ponderado.id,
    rubricaId,
  }
}

describe('periodoVacio', () => {
  it('arranca en blanco', () => {
    expect(periodoVacio(1)).toEqual({ numero: 1, inicio: '', fin: '' })
  })

  it('en blanco no está completo: no se abre un ciclo sin fechas', () => {
    expect(periodosCompletos(revisarPeriodos([periodoVacio(1)]))).toBe(false)
  })
})

describe('periodosDe', () => {
  it('trae los trimestres que existen, ordenados por número', () => {
    const periodos = periodosDe([
      trimestre(3, '2027-03-22', '2027-07-16'),
      trimestre(1, '2026-08-24', '2026-11-27'),
    ])
    expect(periodos.map((p) => p.numero)).toEqual([1, 3])
    expect(periodos[0]?.inicio).toBe('2026-08-24')
  })

  it('un ciclo recién abierto trae un solo periodo', () => {
    // Los que faltan por abrir no son filas en blanco: no existen todavía.
    expect(periodosDe([trimestre(1, '2026-08-24', '2026-11-27')])).toHaveLength(1)
  })
})

describe('siguienteNumero', () => {
  it('con solo el primero abierto, sigue el 2', async () => {
    await abrirCicloEscolar('2026–2027', BUENOS[0]!)
    expect(siguienteNumero((await cicloEnCurso())!)).toBe(2)
  })

  it('con los tres abiertos, no falta ninguno', async () => {
    const ciclo = await unCiclo()
    expect(siguienteNumero(ciclo)).toBeNull()
  })
})

describe('abrirTrimestreSiguiente', () => {
  it('abre el 2 después del 1 y conserva lo que ya había', async () => {
    await abrirCicloEscolar('2026–2027', BUENOS[0]!)
    const ciclo = (await cicloEnCurso())!

    await abrirTrimestreSiguiente(ciclo, BUENOS[1]!)

    const despues = (await cicloEnCurso())!
    expect(despues.trimestres.map((t) => t.numero)).toEqual([1, 2])
    expect(despues.trimestres[0]?.inicio).toBe(BUENOS[0]!.inicio)
    expect(despues.trimestres[1]?.estado).toBe('abierto')
  })

  it('no acepta un trimestre que se traslapa con el anterior', async () => {
    await abrirCicloEscolar('2026–2027', BUENOS[0]!)
    const ciclo = (await cicloEnCurso())!

    await expect(
      abrirTrimestreSiguiente(ciclo, { numero: 2, inicio: '2026-11-01', fin: '2027-03-19' }),
    ).rejects.toThrow(/se enciman/)
    expect((await cicloEnCurso())?.trimestres).toHaveLength(1)
  })

  it('no acepta uno que empiece antes de que acabe el anterior', async () => {
    await abrirCicloEscolar('2026–2027', BUENOS[0]!)
    const ciclo = (await cicloEnCurso())!

    await expect(
      abrirTrimestreSiguiente(ciclo, { numero: 2, inicio: '2026-06-01', fin: '2026-07-15' }),
    ).rejects.toThrow(/después del trimestre anterior/)
  })

  it('no se salta el orden: el 3 no se abre antes del 2', async () => {
    await abrirCicloEscolar('2026–2027', BUENOS[0]!)
    const ciclo = (await cicloEnCurso())!

    await expect(abrirTrimestreSiguiente(ciclo, BUENOS[2]!)).rejects.toThrow(/es el 2/)
  })

  it('con los tres abiertos ya no hay nada que abrir', async () => {
    const ciclo = await unCiclo()
    await expect(
      abrirTrimestreSiguiente(ciclo, { numero: 1, inicio: '2027-08-01', fin: '2027-11-01' }),
    ).rejects.toThrow(/ya tiene sus tres/)
  })
})

describe('revisarNuevoTrimestre', () => {
  it('acepta uno que empieza después del último', async () => {
    await abrirCicloEscolar('2026–2027', BUENOS[0]!)
    const ciclo = (await cicloEnCurso())!
    expect(revisarNuevoTrimestre(ciclo, BUENOS[1]!)).toBeUndefined()
  })

  it('un hueco entre trimestres sigue siendo válido', async () => {
    await abrirCicloEscolar('2026–2027', BUENOS[0]!)
    const ciclo = (await cicloEnCurso())!
    expect(
      revisarNuevoTrimestre(ciclo, { numero: 2, inicio: '2026-12-07', fin: '2027-03-19' }),
    ).toBeUndefined()
  })

  it('marca la fecha que no existe', async () => {
    await abrirCicloEscolar('2026–2027', BUENOS[0]!)
    const ciclo = (await cicloEnCurso())!
    expect(
      revisarNuevoTrimestre(ciclo, { numero: 2, inicio: '2026-02-31', fin: '2027-03-19' }),
    ).toBe('La fecha se escribe como AAAA-MM-DD')
  })
})

describe('faltaAbrirTrimestre', () => {
  it('una fecha posterior al último trimestre abierto, con trimestres por abrir', async () => {
    await abrirCicloEscolar('2026–2027', BUENOS[0]!)
    const ciclo = (await cicloEnCurso())!
    // No se pierde nada: la atribución se calcula de la fecha al leer, así que
    // abrir el trimestre después acomoda lo ya capturado.
    expect(faltaAbrirTrimestre('2026-12-10', ciclo)).toBe(true)
  })

  it('una fecha dentro de un trimestre abierto no falta abrir nada', async () => {
    await abrirCicloEscolar('2026–2027', BUENOS[0]!)
    const ciclo = (await cicloEnCurso())!
    expect(faltaAbrirTrimestre('2026-09-15', ciclo)).toBe(false)
  })

  it('una fecha anterior al ciclo son vacaciones, no un trimestre sin abrir', async () => {
    await abrirCicloEscolar('2026–2027', BUENOS[0]!)
    const ciclo = (await cicloEnCurso())!
    expect(faltaAbrirTrimestre('2026-07-01', ciclo)).toBe(false)
  })

  it('con los tres abiertos, lo de después es fuera de los trimestres', async () => {
    const ciclo = await unCiclo()
    expect(faltaAbrirTrimestre('2027-08-01', ciclo)).toBe(false)
  })

  it('sin ciclo no falta abrir nada: falta el ciclo', async () => {
    expect(faltaAbrirTrimestre('2026-09-15', null)).toBe(false)
  })
})

describe('revisarPeriodos', () => {
  it('no marca nada cuando los tres están bien', () => {
    expect(revisarPeriodos(BUENOS).every((p) => p.problema === undefined)).toBe(true)
    expect(periodosCompletos(revisarPeriodos(BUENOS))).toBe(true)
  })

  it('marca el que le faltan fechas', () => {
    const revisados = revisarPeriodos([...BUENOS.slice(0, 2), { numero: 3, inicio: '', fin: '' }])
    expect(revisados[2]?.problema).toBe('Faltan las fechas de inicio y fin')
    // Y no contagia a los que están bien.
    expect(revisados[0]?.problema).toBeUndefined()
  })

  it('marca un día que no existe', () => {
    const revisados = revisarPeriodos([
      { numero: 1, inicio: '2026-02-31', fin: '2026-11-27' },
      ...BUENOS.slice(1),
    ])
    expect(revisados[0]?.problema).toBe('La fecha se escribe como AAAA-MM-DD')
  })

  it('marca el que termina antes de empezar', () => {
    const revisados = revisarPeriodos([
      { numero: 1, inicio: '2026-11-27', fin: '2026-08-24' },
      ...BUENOS.slice(1),
    ])
    expect(revisados[0]?.problema).toBe('La fecha de fin es anterior a la de inicio')
  })

  it('marca el traslape en las dos filas y dice con cuál choca', () => {
    // Corregir una tiene que apagar la marca de las dos, así que las dos se
    // marcan.
    const revisados = revisarPeriodos([
      { numero: 1, inicio: '2026-08-24', fin: '2026-12-15' },
      { numero: 2, inicio: '2026-11-30', fin: '2027-03-19' },
      BUENOS[2]!,
    ])
    expect(revisados[0]?.problema).toBe('Estas fechas se enciman con las del trimestre 2')
    expect(revisados[1]?.problema).toBe('Estas fechas se enciman con las del trimestre 1')
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
  it('abre el ciclo con un solo trimestre, el primero', async () => {
    // En agosto nadie sabe las fechas de los otros dos: pedirlas para poder
    // empezar sería hacerla inventarlas.
    await abrirCicloEscolar('2026–2027', BUENOS[0]!)

    const enCurso = await cicloEnCurso()
    expect(enCurso?.ciclo.nombre).toBe('2026–2027')
    expect(enCurso?.trimestres).toHaveLength(1)
    expect(enCurso?.trimestres[0]?.numero).toBe(1)
    expect(enCurso?.trimestres[0]?.inicio).toBe('2026-08-24')
  })

  it('numera el primero como 1 aunque le llegue otro número', async () => {
    await abrirCicloEscolar('2026–2027', { ...BUENOS[1]!, numero: 2 })
    expect((await cicloEnCurso())?.trimestres[0]?.numero).toBe(1)
  })

  it('recorta el nombre y rechaza el vacío', async () => {
    await expect(abrirCicloEscolar('   ', BUENOS[0]!)).rejects.toThrow(/nombre/)
    await abrirCicloEscolar('  2026–2027  ', BUENOS[0]!)
    expect((await cicloEnCurso())?.ciclo.nombre).toBe('2026–2027')
  })

  it('no abre un ciclo sin fechas', async () => {
    await expect(abrirCicloEscolar('2026–2027', periodoVacio(1))).rejects.toThrow()
    expect(await cicloEnCurso()).toBeNull()
  })

  it('no abre un ciclo con un rango invertido', async () => {
    await expect(
      abrirCicloEscolar('2026–2027', { numero: 1, inicio: '2026-11-27', fin: '2026-08-24' }),
    ).rejects.toThrow(/anterior a la de inicio/)
    expect(await cicloEnCurso()).toBeNull()
  })

  it('no abre un segundo ciclo mientras haya uno abierto', async () => {
    await abrirCicloEscolar('2026–2027', BUENOS[0]!)
    // Dos ciclos abiertos harían ambigua la atribución de una fecha.
    await expect(abrirCicloEscolar('2027–2028', BUENOS[0]!)).rejects.toThrow(
      /Ya hay un ciclo escolar abierto/,
    )
    expect(await db.ciclos.count()).toBe(1)
  })

  it('con el anterior cerrado sí abre el siguiente', async () => {
    // La guarda vieja preguntaba por `cicloEnCurso()`, que solo ve los abiertos,
    // así que este caso no se podía distinguir del de arriba.
    await abrirCicloEscolar('2026–2027', BUENOS[0]!)
    const enCurso = await cicloEnCurso()
    await repos.evaluacion.cerrarTrimestre(enCurso!.trimestres[0]!.id, [])
    await cerrarCicloEscolar((await cicloEnCurso())!)

    await abrirCicloEscolar('2027–2028', {
      numero: 1,
      inicio: '2027-08-23',
      fin: '2027-11-26',
    })

    expect(await db.ciclos.count()).toBe(2)
    expect((await cicloEnCurso())?.ciclo.nombre).toBe('2027–2028')
  })

  it('se niega a repetir el nombre de un ciclo anterior', async () => {
    await abrirCicloEscolar('2026–2027', BUENOS[0]!)
    const enCurso = await cicloEnCurso()
    await repos.evaluacion.cerrarTrimestre(enCurso!.trimestres[0]!.id, [])
    await cerrarCicloEscolar((await cicloEnCurso())!)

    await expect(
      abrirCicloEscolar('2026–2027', { numero: 1, inicio: '2027-08-23', fin: '2027-11-26' }),
    ).rejects.toThrow(/Ya hubo un ciclo llamado/)
  })

  it('se niega si las fechas se encaraman con un ciclo anterior', async () => {
    // No lo cubre `revisarPeriodos`: `traslapes()` compara solo dentro del mismo
    // ciclo. Y aquí sí importa, porque la asistencia se atribuye por fecha y el
    // rango repetido contaría los días del año pasado en el trimestre de este.
    await abrirCicloEscolar('2026–2027', BUENOS[0]!)
    const enCurso = await cicloEnCurso()
    await repos.evaluacion.cerrarTrimestre(enCurso!.trimestres[0]!.id, [])
    await cerrarCicloEscolar((await cicloEnCurso())!)

    await expect(
      abrirCicloEscolar('2027–2028', {
        numero: 1,
        inicio: BUENOS[0]!.fin,
        fin: '2027-03-19',
      }),
    ).rejects.toThrow(/se enciman con el ciclo/)
  })
})

describe('cerrarCicloEscolar', () => {
  it('no cierra el ciclo con un trimestre abierto dentro', async () => {
    // La calificación de un trimestre abierto se calcula al vuelo; sin su
    // snapshot, un ciclo cerrado tendría números que nadie podría reproducir.
    await abrirCicloEscolar('2026–2027', BUENOS[0]!)
    const ciclo = await cicloEnCurso()

    await expect(cerrarCicloEscolar(ciclo!)).rejects.toThrow(/Falta cerrar el trimestre 1/)
    expect((await cicloEnCurso())?.ciclo.estado).toBe('abierto')
  })

  it('dice cuáles faltan cuando son varios', async () => {
    await abrirCicloEscolar('2026–2027', BUENOS[0]!)
    await abrirTrimestreSiguiente((await cicloEnCurso())!, BUENOS[1]!)

    expect(loQueFaltaParaCerrarCiclo((await cicloEnCurso())!)).toMatch(
      /Faltan por cerrar los trimestres 1 y 2/,
    )
  })

  it('con todos los trimestres cerrados, cierra y deja de estar en curso', async () => {
    await abrirCicloEscolar('2026–2027', BUENOS[0]!)
    const ciclo = await cicloEnCurso()
    await repos.evaluacion.cerrarTrimestre(ciclo!.trimestres[0]!.id, [])

    await cerrarCicloEscolar((await cicloEnCurso())!)

    expect(await cicloEnCurso()).toBeNull()
    // Y sigue estando: cerrar no borra, deja de ser el de hoy.
    expect(await db.ciclos.count()).toBe(1)
    expect((await db.ciclos.get(ciclo!.ciclo.id))?.estado).toBe('cerrado')
  })

  it('el grupo del ciclo cerrado desaparece de la lista diaria, sin borrarse', async () => {
    // Es todo el punto: la app amanece limpia para el grupo que llega, y el año
    // pasado sigue entero debajo (D-025).
    await abrirCicloEscolar('2026–2027', BUENOS[0]!)
    const ciclo = await cicloEnCurso()
    await repos.alumnos.sembrar([
      { numero_lista: 1, nombre: 'Del año pasado', fecha_nacimiento: null },
    ])
    expect(await repos.alumnos.lista()).toHaveLength(1)

    await repos.evaluacion.cerrarTrimestre(ciclo!.trimestres[0]!.id, [])
    await cerrarCicloEscolar((await cicloEnCurso())!)

    expect(await repos.alumnos.lista()).toHaveLength(0)
    expect(await db.alumnos.count()).toBe(1)
  })
})

describe('ajustarFechasTrimestre', () => {
  it('un trimestre cerrado no admite cambios de fecha', async () => {
    const enCurso = await unCiclo()
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
    await unCiclo()
    const primero = (await cicloEnCurso())!.trimestres[0]!
    await expect(
      ajustarFechasTrimestre(primero, '2026-02-31', '2026-12-04'),
    ).rejects.toThrow(/AAAA-MM-DD/)
  })

  it('rechaza el rango invertido', async () => {
    await unCiclo()
    const primero = (await cicloEnCurso())!.trimestres[0]!
    await expect(
      ajustarFechasTrimestre(primero, '2026-12-04', '2026-08-25'),
    ).rejects.toThrow(/anterior a la de inicio/)
  })
})

describe('guardarFechas', () => {
  it('escribe solo lo que cambió', async () => {
    const enCurso = await unCiclo()
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
    const enCurso = await unCiclo()
    await db.outbox.clear()

    await guardarFechas(enCurso, periodosDe(enCurso.trimestres))

    expect(await db.outbox.count()).toBe(0)
  })

  it('salta los cerrados sin fallar, y guarda los abiertos', async () => {
    let enCurso = await unCiclo()
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

  it('deja corregir el primero aunque falten los otros dos por abrir', async () => {
    await abrirCicloEscolar('2026–2027', BUENOS[0]!)
    const enCurso = (await cicloEnCurso())!

    await guardarFechas(enCurso, [{ numero: 1, inicio: '2026-08-25', fin: '2026-11-27' }])

    expect((await cicloEnCurso())?.trimestres[0]?.inicio).toBe('2026-08-25')
  })

  it('rechaza el guardado completo si algún periodo está mal', async () => {
    const enCurso = await unCiclo()

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
        retardos_por_falta: null,
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
  it('ofrece los tres criterios automáticos, que volvieron al alcance', () => {
    // Estuvieron fuera mientras estaban pospuestos; los retomó la usuaria con
    // reglas propias (D-020), así que ahora se pueden agregar al trimestre.
    const tipos = TIPOS_OFRECIDOS.map((t) => t.tipo)
    expect(tipos).toContain('auto_puntualidad')
    expect(tipos).toContain('auto_conducta')
    expect(tipos).toContain('auto_participacion')
  })

  it('cada tipo dice de dónde sale, sin abrir otra pantalla', () => {
    // En los automáticos no es adorno: es la diferencia entre configurar un
    // criterio y descubrir en diciembre qué se estaba midiendo.
    for (const opcion of TIPOS_OFRECIDOS) {
      expect(opcion.ayuda.trim(), opcion.tipo).not.toBe('')
    }
  })

  it('los automáticos traen nombre sugerido y los demás no', () => {
    expect(nombreSugerido('auto_puntualidad')).toBe('Puntualidad y asistencia')
    expect(nombreSugerido('auto_conducta')).toBe('Conducta')
    expect(nombreSugerido('auto_participacion')).toBe('Participación')
    // «Tareas» o «Portafolio» sí es una decisión suya.
    expect(nombreSugerido('entregable')).toBe('')
  })

  it('no ofrece personalizado, que no tiene forma de captura', () => {
    // Elegirlo la llevaría a crear un criterio sin pantalla donde llenarse.
    expect(TIPOS_OFRECIDOS.map((t) => t.tipo)).not.toContain('personalizado')
  })
})

const DESCRIPTORES: [string, string, string, string] = [
  'Sin errores',
  'Uno o dos',
  'Varios',
  'No se entiende',
]

describe('rubricaVacia', () => {
  it('arranca con un solo renglón, no con cuatro en blanco', () => {
    // Cuatro campos vacíos parecen una obligación; uno parece un ejemplo.
    const borrador = rubricaVacia()
    expect(borrador.renglones).toHaveLength(1)
    expect(borrador.nombre).toBe('')
  })

  it('en blanco no se puede guardar', () => {
    expect(rubricaLista(rubricaVacia())).toBe(false)
  })
})

describe('revisarRubrica', () => {
  it('no marca nada cuando el renglón está completo', () => {
    const revisada = revisarRubrica({
      nombre: 'Trabajo escrito',
      renglones: [{ nombre: 'Ortografía', descriptores: DESCRIPTORES }],
    })
    expect(revisada.renglones[0]?.problema).toBeUndefined()
    expect(rubricaLista(revisada)).toBe(true)
  })

  it('marca el renglón sin nombre', () => {
    const revisada = revisarRubrica({
      nombre: 'Trabajo escrito',
      renglones: [{ nombre: '  ', descriptores: DESCRIPTORES }],
    })
    expect(revisada.renglones[0]?.problema).toBe('Falta el nombre de este aspecto')
  })

  it('dice de qué niveles falta el descriptor, por nombre', () => {
    const revisada = revisarRubrica({
      nombre: 'Trabajo escrito',
      renglones: [{ nombre: 'Ortografía', descriptores: ['Sin errores', '', 'Varios', ''] }],
    })
    // Decir «faltan 2» obligaría a buscar cuáles; decir cuáles es la diferencia
    // entre un aviso y una instrucción.
    expect(revisada.renglones[0]?.problema).toBe('Falta describir el nivel Bien, Mal')
  })

  it('marca solo el renglón que está mal', () => {
    const revisada = revisarRubrica({
      nombre: 'Trabajo escrito',
      renglones: [
        { nombre: 'Ortografía', descriptores: DESCRIPTORES },
        { nombre: 'Claridad', descriptores: ['a', 'b', 'c', ''] },
      ],
    })
    expect(revisada.renglones[0]?.problema).toBeUndefined()
    expect(revisada.renglones[1]?.problema).toBeDefined()
  })

  it('corregir apaga la marca', () => {
    const conProblema = revisarRubrica({
      nombre: 'Trabajo escrito',
      renglones: [{ nombre: 'Ortografía', descriptores: ['a', '', 'c', 'd'] }],
    })
    expect(conProblema.renglones[0]?.problema).toBeDefined()

    const corregida = revisarRubrica({
      ...conProblema,
      renglones: [{ nombre: 'Ortografía', descriptores: ['a', 'b', 'c', 'd'] }],
    })
    expect(corregida.renglones[0]?.problema).toBeUndefined()
  })

  it('no toca el texto: solo lo juzga', () => {
    // Corre en cada tecla; recortar ahí le pelearía al teclado.
    const revisada = revisarRubrica({
      nombre: '  Trabajo escrito  ',
      renglones: [{ nombre: '  Ortografía  ', descriptores: DESCRIPTORES }],
    })
    expect(revisada.nombre).toBe('  Trabajo escrito  ')
    expect(revisada.renglones[0]?.nombre).toBe('  Ortografía  ')
  })
})

describe('rubricaLista', () => {
  it('una rúbrica sin nombre no se guarda aunque los renglones estén bien', () => {
    expect(
      rubricaLista({
        nombre: '',
        renglones: [{ nombre: 'Ortografía', descriptores: DESCRIPTORES }],
      }),
    ).toBe(false)
  })

  it('una rúbrica sin renglones no se guarda', () => {
    expect(rubricaLista({ nombre: 'Trabajo escrito', renglones: [] })).toBe(false)
  })
})

describe('guardarRubrica', () => {
  it('recorta el nombre y los descriptores al guardar', async () => {
    await guardarRubrica({
      nombre: '  Trabajo escrito  ',
      renglones: [{ nombre: '  Ortografía  ', descriptores: ['  a  ', 'b', 'c', 'd'] }],
    })

    const [guardada] = await rubricas()
    expect(guardada?.rubrica.nombre).toBe('Trabajo escrito')
    expect(guardada?.criterios[0]?.nombre).toBe('Ortografía')
    expect(guardada?.criterios[0]?.descriptores[0]).toBe('a')
  })

  it('rechaza una rúbrica incompleta', async () => {
    await expect(
      guardarRubrica({
        nombre: 'Trabajo escrito',
        renglones: [{ nombre: 'Ortografía', descriptores: ['a', '', 'c', 'd'] }],
      }),
    ).rejects.toThrow(/descripción de algún nivel/)
    expect(await rubricas()).toEqual([])
  })

  it('editarla conserva los ids de los renglones', async () => {
    const id = await guardarRubrica({
      nombre: 'Trabajo escrito',
      renglones: [{ nombre: 'Ortografía', descriptores: DESCRIPTORES }],
    })
    const antes = (await rubricas())[0]!

    await guardarRubrica(
      rubricaEnEdicion({
        ...antes,
        rubrica: { ...antes.rubrica, nombre: 'Trabajo escrito v2' },
      }),
    )

    const despues = (await rubricas())[0]!
    expect(despues.rubrica.id).toBe(id)
    expect(despues.criterios[0]?.id).toBe(antes.criterios[0]?.id)
    expect(despues.rubrica.nombre).toBe('Trabajo escrito v2')
  })
})

describe('desactivar y borrar', () => {
  it('una rúbrica en uso no se borra, se desactiva', async () => {
    const ciclo = await unCiclo()
    const t1 = ciclo.trimestres[0]!
    const rubricaId = await guardarRubrica({
      nombre: 'Trabajo escrito',
      renglones: [{ nombre: 'Ortografía', descriptores: DESCRIPTORES }],
    })
    await agregarCriterio(t1, 'Tareas', 'entregable')
    const criterio = (await esquemaDelTrimestre(t1.id))!.criterios[0]!
    // La rúbrica cuelga de la actividad. Las actividades no tienen caso de uso
    // hasta C21b, así que la prueba la escribe directo.
    await db.actividades.add({
      id: 'actividad-1',
      updated_at: '2026-09-01T00:00:00.000Z',
      deleted_at: null,
      criterio_trimestre_id: criterio.ponderado.id,
      nombre: 'Cuento de terror',
      campo: 'lenguajes',
      ejes: [],
      fecha: '2026-09-01',
      rubrica_id: rubricaId,
    })

    const enUso = (await rubricas())[0]!
    // Borrarla dejaría a esa actividad apuntando a nada y su captura pasaría a
    // binaria de un día para otro, cambiando calificaciones ya dadas.
    await expect(borrarRubrica(enUso)).rejects.toThrow(/no se puede borrar/)
    expect(await rubricas()).toHaveLength(1)

    await desactivarRubrica(rubricaId)
    const desactivada = (await rubricas())[0]!
    expect(desactivada.rubrica.activa).toBe(false)
    // Y sigue ahí, con sus renglones: lo ya calificado se resuelve por id.
    expect(desactivada.criterios).toHaveLength(1)
  })

  it('una rúbrica que nadie usa sí se borra', async () => {
    await guardarRubrica({
      nombre: 'Trabajo escrito',
      renglones: [{ nombre: 'Ortografía', descriptores: DESCRIPTORES }],
    })
    const sinUso = (await rubricas())[0]!
    expect(sinUso.enUso).toBe(false)

    await borrarRubrica(sinUso)

    expect(await rubricas()).toEqual([])
  })

  it('desactivar y volver a activar', async () => {
    const id = await guardarRubrica({
      nombre: 'Trabajo escrito',
      renglones: [{ nombre: 'Ortografía', descriptores: DESCRIPTORES }],
    })

    await desactivarRubrica(id)
    expect((await rubricas())[0]?.rubrica.activa).toBe(false)
    await activarRubrica(id)
    expect((await rubricas())[0]?.rubrica.activa).toBe(true)
  })
})

describe('CAMPOS_CON_NOMBRE', () => {
  it('son los cuatro campos formativos, con nombre para pantalla', () => {
    expect(CAMPOS_CON_NOMBRE).toHaveLength(4)
    expect(CAMPOS_CON_NOMBRE.map((c) => c.campo)).toEqual([...CAMPOS_FORMATIVOS])
    expect(CAMPOS_CON_NOMBRE.every((c) => c.nombre.trim() !== '')).toBe(true)
  })
})

describe('EJES_ARTICULADORES', () => {
  it('son siete y no se repiten', () => {
    expect(EJES_ARTICULADORES).toHaveLength(7)
    expect(new Set(EJES_ARTICULADORES).size).toBe(7)
  })
})

describe('estaCalificada', () => {
  it('cero registros es sin calificar', () => {
    // No es lo mismo que calificada con ceros: sin registros, la actividad se
    // excluye del promedio.
    expect(estaCalificada({ actividad: unaActividad(), registros: 0 })).toBe(false)
  })

  it('con un registro ya cuenta como calificada', () => {
    expect(estaCalificada({ actividad: unaActividad(), registros: 1 })).toBe(true)
  })
})

describe('rubricaSugerida', () => {
  it('sin grupo no sugiere nada', () => {
    expect(rubricaSugerida(undefined)).toBeNull()
  })

  it('hereda la rúbrica de la actividad más reciente del criterio', () => {
    const grupo = {
      ponderado: unPonderado(),
      criterio: unCriterio('entregable'),
      actividades: [
        { actividad: { ...unaActividad(), rubrica_id: 'rubrica-2' }, registros: 0 },
        { actividad: { ...unaActividad(), rubrica_id: 'rubrica-1' }, registros: 3 },
      ],
    }
    expect(rubricaSugerida(grupo)).toBe('rubrica-2')
  })

  it('hereda también el null: entregada / no entregada es una respuesta', () => {
    const grupo = {
      ponderado: unPonderado(),
      criterio: unCriterio('entregable'),
      actividades: [{ actividad: { ...unaActividad(), rubrica_id: null }, registros: 0 }],
    }
    expect(rubricaSugerida(grupo)).toBeNull()
  })
})

describe('crearActividad', () => {
  it('crea la actividad dentro del criterio', async () => {
    const { trimestre, criterio, ponderadoId } = await unCriterioEnT1()

    await crearActividad(trimestre, criterio, {
      criterio_trimestre_id: ponderadoId,
      nombre: 'Cuento de terror',
      campo: 'lenguajes',
      ejes: [],
      fecha: '2026-09-15',
      rubrica_id: null,
    })

    const grupos = await actividadesDelTrimestre(trimestre.id)
    expect(grupos[0]?.actividades[0]?.actividad.nombre).toBe('Cuento de terror')
    // Nunca suelta: cuelga del CriterioTrimestre.
    expect(grupos[0]?.actividades[0]?.actividad.criterio_trimestre_id).toBe(ponderadoId)
  })

  it('recorta el nombre y colapsa los espacios', async () => {
    const { trimestre, criterio, ponderadoId } = await unCriterioEnT1()

    await crearActividad(trimestre, criterio, {
      criterio_trimestre_id: ponderadoId,
      nombre: '  Cuento   de terror  ',
      campo: 'lenguajes',
      ejes: [],
      fecha: '2026-09-15',
      rubrica_id: null,
    })

    const grupos = await actividadesDelTrimestre(trimestre.id)
    expect(grupos[0]?.actividades[0]?.actividad.nombre).toBe('Cuento de terror')
  })

  it('rechaza el nombre vacío', async () => {
    const { trimestre, criterio, ponderadoId } = await unCriterioEnT1()
    await expect(
      crearActividad(trimestre, criterio, {
        criterio_trimestre_id: ponderadoId,
        nombre: '   ',
        campo: 'lenguajes',
        ejes: [],
        fecha: '2026-09-15',
        rubrica_id: null,
      }),
    ).rejects.toThrow(/nombre/)
  })

  it('rechaza una fecha que no existe', async () => {
    const { trimestre, criterio, ponderadoId } = await unCriterioEnT1()
    await expect(
      crearActividad(trimestre, criterio, {
        criterio_trimestre_id: ponderadoId,
        nombre: 'Cuento',
        campo: 'lenguajes',
        ejes: [],
        fecha: '2026-02-31',
        rubrica_id: null,
      }),
    ).rejects.toThrow(/AAAA-MM-DD/)
  })

  it('no se crean actividades en un trimestre cerrado', async () => {
    const { trimestre, criterio, ponderadoId } = await unCriterioEnT1()

    await expect(
      crearActividad({ ...trimestre, estado: 'cerrado' }, criterio, {
        criterio_trimestre_id: ponderadoId,
        nombre: 'Cuento',
        campo: 'lenguajes',
        ejes: [],
        fecha: '2026-09-15',
        rubrica_id: null,
      }),
    ).rejects.toThrow(/cerrado/)

    expect((await actividadesDelTrimestre(trimestre.id))[0]?.actividades).toEqual([])
  })

  it('un criterio de examen no admite actividades', async () => {
    const ciclo = await unCiclo()
    const t1 = ciclo.trimestres[0]!
    await agregarCriterio(t1, 'Examen final', 'examen')
    const criterio = (await esquemaDelTrimestre(t1.id))!.criterios[0]!

    await expect(
      crearActividad(t1, criterio.criterio, {
        criterio_trimestre_id: criterio.ponderado.id,
        nombre: 'Examen de septiembre',
        campo: 'lenguajes',
        ejes: [],
        fecha: '2026-09-15',
        rubrica_id: null,
      }),
    ).rejects.toThrow(/no se califica con actividades/)
  })

  it('rechaza una rúbrica que ya no existe', async () => {
    const { trimestre, criterio, ponderadoId } = await unCriterioEnT1()
    await expect(
      crearActividad(trimestre, criterio, {
        criterio_trimestre_id: ponderadoId,
        nombre: 'Cuento',
        campo: 'lenguajes',
        ejes: [],
        fecha: '2026-09-15',
        rubrica_id: 'rubrica-fantasma',
      }),
    ).rejects.toThrow(/ya no existe/)
  })

  it('los ejes son opcionales', async () => {
    const { trimestre, criterio, ponderadoId } = await unCriterioEnT1()

    await crearActividad(trimestre, criterio, {
      criterio_trimestre_id: ponderadoId,
      nombre: 'Cuento',
      campo: 'lenguajes',
      ejes: [],
      fecha: '2026-09-15',
      rubrica_id: null,
    })

    const grupos = await actividadesDelTrimestre(trimestre.id)
    expect(grupos[0]?.actividades[0]?.actividad.ejes).toEqual([])
  })
})

describe('cambiaLaCaptura', () => {
  const item = (rubricaId: string | null, registros: number) => ({
    actividad: { ...unaActividad(), rubrica_id: rubricaId },
    registros,
  })
  const datos = (rubricaId: string | null) => ({
    criterio_trimestre_id: 'ct-1',
    nombre: 'Cuento',
    campo: 'lenguajes' as const,
    ejes: [],
    fecha: '2026-09-01',
    rubrica_id: rubricaId,
  })

  it('sin nada capturado no hay nada que perder', () => {
    expect(cambiaLaCaptura(item('rubrica-1', 0), datos('rubrica-2'))).toBe(false)
  })

  it('cambiar de rúbrica con calificaciones sí las tira', () => {
    // `EvaluacionRubrica.niveles` está indexado por los renglones de la rúbrica
    // anterior: conservarlos dejaría una calificación que ya no significa nada.
    expect(cambiaLaCaptura(item('rubrica-1', 5), datos('rubrica-2'))).toBe(true)
  })

  it('pasar de rúbrica a binario, y al revés, también', () => {
    expect(cambiaLaCaptura(item('rubrica-1', 5), datos(null))).toBe(true)
    expect(cambiaLaCaptura(item(null, 5), datos('rubrica-1'))).toBe(true)
  })

  it('renombrar o mover la fecha no tira nada', () => {
    const actual = item('rubrica-1', 5)
    expect(
      cambiaLaCaptura(actual, { ...datos('rubrica-1'), nombre: 'Otro', fecha: '2026-10-01' }),
    ).toBe(false)
  })
})

describe('editarActividad', () => {
  it('renombrar conserva lo calificado', async () => {
    const { trimestre, criterio, ponderadoId } = await unCriterioEnT1()
    const id = await repos.evaluacion.crearActividad({
      criterio_trimestre_id: ponderadoId,
      nombre: 'Cuento',
      campo: 'lenguajes',
      ejes: [],
      fecha: '2026-09-01',
      rubrica_id: null,
    })
    await db.entregas.add({
      id: 'e1',
      updated_at: '2026-09-01T00:00:00.000Z',
      deleted_at: null,
      actividad_id: id,
      alumno_id: 'alumno-1',
      entregada: true,
    })
    const actual = (await actividadesDelTrimestre(trimestre.id))[0]!.actividades[0]!

    await editarActividad(trimestre, criterio, actual, {
      ...actual.actividad,
      nombre: 'Cuento de terror',
    })

    const despues = (await actividadesDelTrimestre(trimestre.id))[0]!.actividades[0]!
    expect(despues.actividad.nombre).toBe('Cuento de terror')
    expect(despues.registros).toBe(1)
  })

  it('cambiar la rúbrica de una actividad calificada se niega sin confirmar', async () => {
    const { trimestre, criterio, ponderadoId, rubricaId } = await unCriterioEnT1(true)
    const id = await repos.evaluacion.crearActividad({
      criterio_trimestre_id: ponderadoId,
      nombre: 'Cuento',
      campo: 'lenguajes',
      ejes: [],
      fecha: '2026-09-01',
      rubrica_id: null,
    })
    await db.entregas.add({
      id: 'e1',
      updated_at: '2026-09-01T00:00:00.000Z',
      deleted_at: null,
      actividad_id: id,
      alumno_id: 'alumno-1',
      entregada: true,
    })
    const actual = (await actividadesDelTrimestre(trimestre.id))[0]!.actividades[0]!

    await expect(
      editarActividad(trimestre, criterio, actual, {
        ...actual.actividad,
        rubrica_id: rubricaId!,
      }),
    ).rejects.toThrow(/borra lo ya calificado/)

    // Y no tocó nada.
    const despues = (await actividadesDelTrimestre(trimestre.id))[0]!.actividades[0]!
    expect(despues.actividad.rubrica_id).toBeNull()
    expect(despues.registros).toBe(1)
  })

  it('confirmando, cambia la rúbrica y descarta lo calificado', async () => {
    const { trimestre, criterio, ponderadoId, rubricaId } = await unCriterioEnT1(true)
    const id = await repos.evaluacion.crearActividad({
      criterio_trimestre_id: ponderadoId,
      nombre: 'Cuento',
      campo: 'lenguajes',
      ejes: [],
      fecha: '2026-09-01',
      rubrica_id: null,
    })
    await db.entregas.add({
      id: 'e1',
      updated_at: '2026-09-01T00:00:00.000Z',
      deleted_at: null,
      actividad_id: id,
      alumno_id: 'alumno-1',
      entregada: true,
    })
    const actual = (await actividadesDelTrimestre(trimestre.id))[0]!.actividades[0]!

    await editarActividad(
      trimestre,
      criterio,
      actual,
      { ...actual.actividad, rubrica_id: rubricaId! },
      true,
    )

    const despues = (await actividadesDelTrimestre(trimestre.id))[0]!.actividades[0]!
    expect(despues.actividad.rubrica_id).toBe(rubricaId)
    expect(despues.registros).toBe(0)
  })

  it('un trimestre cerrado no admite editar actividades', async () => {
    const { trimestre, criterio, ponderadoId } = await unCriterioEnT1()
    const id = await repos.evaluacion.crearActividad({
      criterio_trimestre_id: ponderadoId,
      nombre: 'Cuento',
      campo: 'lenguajes',
      ejes: [],
      fecha: '2026-09-01',
      rubrica_id: null,
    })
    const actual = (await actividadesDelTrimestre(trimestre.id))[0]!.actividades[0]!
    expect(actual.actividad.id).toBe(id)

    await expect(
      editarActividad({ ...trimestre, estado: 'cerrado' }, criterio, actual, {
        ...actual.actividad,
        nombre: 'Otro',
      }),
    ).rejects.toThrow(/cerrado/)
  })
})

describe('borrarActividad', () => {
  it('una actividad sin calificar se borra sin confirmar', async () => {
    const { trimestre, ponderadoId } = await unCriterioEnT1()
    await repos.evaluacion.crearActividad({
      criterio_trimestre_id: ponderadoId,
      nombre: 'Cuento',
      campo: 'lenguajes',
      ejes: [],
      fecha: '2026-09-01',
      rubrica_id: null,
    })
    const actual = (await actividadesDelTrimestre(trimestre.id))[0]!.actividades[0]!

    await borrarActividad(trimestre, actual)

    expect((await actividadesDelTrimestre(trimestre.id))[0]?.actividades).toEqual([])
  })

  it('una actividad calificada pide confirmación explícita', async () => {
    const { trimestre, ponderadoId } = await unCriterioEnT1()
    const id = await repos.evaluacion.crearActividad({
      criterio_trimestre_id: ponderadoId,
      nombre: 'Cuento',
      campo: 'lenguajes',
      ejes: [],
      fecha: '2026-09-01',
      rubrica_id: null,
    })
    await db.entregas.add({
      id: 'e1',
      updated_at: '2026-09-01T00:00:00.000Z',
      deleted_at: null,
      actividad_id: id,
      alumno_id: 'alumno-1',
      entregada: true,
    })
    const actual = (await actividadesDelTrimestre(trimestre.id))[0]!.actividades[0]!

    // Se va con las calificaciones de los 30 alumnos: eso no puede pasar por un
    // toque de más.
    await expect(borrarActividad(trimestre, actual)).rejects.toThrow(/ya tiene alumnos calificados/)
    expect((await actividadesDelTrimestre(trimestre.id))[0]?.actividades).toHaveLength(1)

    await borrarActividad(trimestre, actual, true)
    expect((await actividadesDelTrimestre(trimestre.id))[0]?.actividades).toEqual([])
  })

  it('un trimestre cerrado no admite borrar actividades', async () => {
    const { trimestre, ponderadoId } = await unCriterioEnT1()
    await repos.evaluacion.crearActividad({
      criterio_trimestre_id: ponderadoId,
      nombre: 'Cuento',
      campo: 'lenguajes',
      ejes: [],
      fecha: '2026-09-01',
      rubrica_id: null,
    })
    const actual = (await actividadesDelTrimestre(trimestre.id))[0]!.actividades[0]!

    await expect(
      borrarActividad({ ...trimestre, estado: 'cerrado' }, actual, true),
    ).rejects.toThrow(/cerrado/)
  })
})

describe('criterios automáticos en el trimestre', () => {
  it('se pueden agregar los tres, y quitar', async () => {
    const t1 = await primerTrimestre()

    await agregarCriterio(t1, 'Puntualidad', 'auto_puntualidad')
    await agregarCriterio(t1, 'Conducta', 'auto_conducta')
    await agregarCriterio(t1, 'Participación', 'auto_participacion')

    const conLosTres = (await esquemaDelTrimestre(t1.id))!.criterios
    expect(conLosTres.map((c) => c.criterio.tipo).sort()).toEqual([
      'auto_conducta',
      'auto_participacion',
      'auto_puntualidad',
    ])

    await quitarCriterio(t1, conLosTres[0]!.ponderado.id)
    expect((await esquemaDelTrimestre(t1.id))!.criterios).toHaveLength(2)
  })

  it('cada automático aparece a lo más una vez por trimestre', async () => {
    // Dos puntualidades no significan nada: no hay dos puntualidades que medir.
    const t1 = await primerTrimestre()
    await agregarCriterio(t1, 'Puntualidad', 'auto_puntualidad')

    await expect(
      agregarCriterio(t1, 'Asistencia puntual', 'auto_puntualidad'),
    ).rejects.toThrow(/una sola vez/)
    expect((await esquemaDelTrimestre(t1.id))!.criterios).toHaveLength(1)
  })

  it('el mismo automático sí puede estar en dos trimestres distintos', async () => {
    const ciclo = await unCiclo()
    const [t1, t2] = ciclo.trimestres as [Trimestre, Trimestre]

    await agregarCriterio(t1, 'Conducta', 'auto_conducta')
    await agregarCriterio(t2, 'Conducta', 'auto_conducta')

    expect((await esquemaDelTrimestre(t1.id))!.criterios).toHaveLength(1)
    expect((await esquemaDelTrimestre(t2.id))!.criterios).toHaveLength(1)
  })

  it('la participación nace con la meta en 5', async () => {
    const t1 = await primerTrimestre()
    await agregarCriterio(t1, 'Participación', 'auto_participacion')

    const ponderado = (await esquemaDelTrimestre(t1.id))!.criterios[0]!.ponderado
    expect(ponderado.meta_participacion).toBe(5)
  })

  it('la meta se puede mover, y un cero no se acepta', async () => {
    const t1 = await primerTrimestre()
    await agregarCriterio(t1, 'Participación', 'auto_participacion')
    const ponderado = (await esquemaDelTrimestre(t1.id))!.criterios[0]!.ponderado

    await fijarMetaParticipacion(t1, ponderado, 8)
    expect(
      (await esquemaDelTrimestre(t1.id))!.criterios[0]!.ponderado.meta_participacion,
    ).toBe(8)

    await expect(fijarMetaParticipacion(t1, ponderado, 0)).rejects.toThrow(/al menos 1/)
  })

  it('los retardos por falta se fijan y se pueden dejar en «no cuentan»', async () => {
    const t1 = await primerTrimestre()
    await agregarCriterio(t1, 'Puntualidad', 'auto_puntualidad')
    const ponderado = (await esquemaDelTrimestre(t1.id))!.criterios[0]!.ponderado
    // Nace sin penalizar: la convención de 3 no está validada.
    expect(ponderado.retardos_por_falta).toBeNull()

    await fijarRetardosPorFalta(t1, ponderado, 3)
    expect(
      (await esquemaDelTrimestre(t1.id))!.criterios[0]!.ponderado.retardos_por_falta,
    ).toBe(3)

    await fijarRetardosPorFalta(t1, ponderado, null)
    expect(
      (await esquemaDelTrimestre(t1.id))!.criterios[0]!.ponderado.retardos_por_falta,
    ).toBeNull()
  })

  it('fijar un parámetro no borra el otro', async () => {
    // Los dos viven en la misma fila. Escribir uno leyendo la fila entera es lo
    // que evita que configurar la meta apague la conversión de retardos.
    const t1 = await primerTrimestre()
    await agregarCriterio(t1, 'Participación', 'auto_participacion')
    let ponderado = (await esquemaDelTrimestre(t1.id))!.criterios[0]!.ponderado

    await fijarRetardosPorFalta(t1, ponderado, 2)
    ponderado = (await esquemaDelTrimestre(t1.id))!.criterios[0]!.ponderado
    await fijarMetaParticipacion(t1, ponderado, 7)

    const final = (await esquemaDelTrimestre(t1.id))!.criterios[0]!.ponderado
    expect(final.retardos_por_falta).toBe(2)
    expect(final.meta_participacion).toBe(7)
  })

  it('un trimestre cerrado no admite cambios de configuración', async () => {
    const t1 = await primerTrimestre()
    await agregarCriterio(t1, 'Participación', 'auto_participacion')
    const ponderado = (await esquemaDelTrimestre(t1.id))!.criterios[0]!.ponderado
    const cerrado = { ...t1, estado: 'cerrado' as const }

    await expect(fijarMetaParticipacion(cerrado, ponderado, 6)).rejects.toThrow(/cerrado/)
    await expect(fijarRetardosPorFalta(cerrado, ponderado, 2)).rejects.toThrow(/cerrado/)
  })
})
