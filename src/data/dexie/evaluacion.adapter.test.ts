import 'fake-indexeddb/auto'

import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import type { CampoFormativo } from '@/domain/values'

import { db } from './db'
import { DexieEvaluacionRepo } from './evaluacion.adapter'

const repo = new DexieEvaluacionRepo()

/**
 * Un criterio sin parámetros automáticos. Los parámetros llegan resueltos desde
 * el caso de uso (C25b), así que aquí se pasan explícitos.
 */
const SIN_PARAMETROS = { meta_participacion: null, retardos_por_falta: null }

const PERIODOS = [
  { numero: 1 as const, inicio: '2026-08-24', fin: '2026-11-27' },
  { numero: 2 as const, inicio: '2026-11-30', fin: '2027-03-19' },
  { numero: 3 as const, inicio: '2027-03-22', fin: '2027-07-16' },
]

beforeEach(async () => {
  await db.open()
  await db.ciclos.clear()
  await db.trimestres.clear()
  await db.criterios.clear()
  await db.criterios_trimestre.clear()
  await db.actividades.clear()
  await db.entregas.clear()
  await db.eval_rubrica.clear()
  await db.examen_config.clear()
  await db.resultados_examen.clear()
  await db.rubricas.clear()
  await db.rubrica_criterios.clear()
  await db.asistencia.clear()
  await db.bitacora.clear()
  await db.participaciones.clear()
  await db.outbox.clear()
})

/**
 * Una actividad mínima. Las actividades no tienen caso de uso todavía —eso es
 * C21b— pero la rúbrica ya cuelga de ellas, así que las pruebas de `enUso` las
 * escriben directo.
 */
function unaActividad(criterioTrimestreId: string, rubricaId: string | null) {
  return {
    id: `actividad-${rubricaId ?? 'sin-rubrica'}`,
    updated_at: '2026-09-01T00:00:00.000Z',
    deleted_at: null,
    criterio_trimestre_id: criterioTrimestreId,
    nombre: 'Cuento de terror',
    campo: 'lenguajes' as const,
    ejes: [],
    fecha: '2026-09-01',
    rubrica_id: rubricaId,
  }
}

/** Un criterio entregable en T1, listo para colgarle actividades. */
async function unGrupo() {
  const [t1] = await conCiclo()
  await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)
  const grupos = await repo.actividadesDeTrimestre(t1!.id)
  return { trimestreId: t1!.id, criterioTrimestreId: grupos[0]!.ponderado.id }
}

function datosDe(
  grupo: { criterioTrimestreId: string },
  cambios: Partial<{ nombre: string; campo: CampoFormativo; ejes: string[]; fecha: string; rubrica_id: string | null }>,
) {
  return {
    criterio_trimestre_id: grupo.criterioTrimestreId,
    nombre: 'Actividad',
    campo: 'lenguajes' as CampoFormativo,
    ejes: [] as string[],
    fecha: '2026-09-01',
    rubrica_id: null as string | null,
    ...cambios,
  }
}

function entrega(id: string, actividadId: string, alumnoId: string) {
  return {
    id,
    updated_at: '2026-09-01T00:00:00.000Z',
    deleted_at: null,
    actividad_id: actividadId,
    alumno_id: alumnoId,
    entregada: true,
  }
}

/** Abre un ciclo y devuelve sus tres trimestres. */
async function conCiclo() {
  await repo.abrirCiclo('2026–2027', PERIODOS)
  return (await repo.cicloEnCurso())!.trimestres
}

afterAll(() => {
  db.close()
})

describe('cicloEnCurso', () => {
  it('sin ciclo configurado devuelve null, no falla', async () => {
    expect(await repo.cicloEnCurso()).toBeNull()
  })

  it('devuelve el ciclo con sus trimestres ordenados por número', async () => {
    // Se abren desordenados a propósito: el orden lo pone la lectura, no el
    // orden de inserción.
    await repo.abrirCiclo('2026–2027', [PERIODOS[2]!, PERIODOS[0]!, PERIODOS[1]!])

    const enCurso = await repo.cicloEnCurso()
    expect(enCurso?.ciclo.nombre).toBe('2026–2027')
    expect(enCurso?.trimestres.map((t) => t.numero)).toEqual([1, 2, 3])
  })

  it('ignora los ciclos cerrados', async () => {
    await repo.abrirCiclo('2026–2027', PERIODOS)
    const abierto = await repo.cicloEnCurso()
    await db.ciclos.update(abierto!.ciclo.id, { estado: 'cerrado' })

    expect(await repo.cicloEnCurso()).toBeNull()
  })

  it('ignora los ciclos borrados', async () => {
    await repo.abrirCiclo('2026–2027', PERIODOS)
    const abierto = await repo.cicloEnCurso()
    await db.ciclos.update(abierto!.ciclo.id, { deleted_at: '2026-08-25T00:00:00.000Z' })

    expect(await repo.cicloEnCurso()).toBeNull()
  })

  it('no devuelve trimestres borrados', async () => {
    await repo.abrirCiclo('2026–2027', PERIODOS)
    const enCurso = await repo.cicloEnCurso()
    await db.trimestres.update(enCurso!.trimestres[1]!.id, {
      deleted_at: '2026-08-25T00:00:00.000Z',
    })

    expect((await repo.cicloEnCurso())?.trimestres.map((t) => t.numero)).toEqual([1, 3])
  })
})

describe('abrirCiclo', () => {
  it('nace abierto, con los tres trimestres abiertos y sin cerrar', async () => {
    await repo.abrirCiclo('2026–2027', PERIODOS)
    const enCurso = await repo.cicloEnCurso()

    expect(enCurso?.ciclo.estado).toBe('abierto')
    expect(enCurso?.trimestres).toHaveLength(3)
    for (const trimestre of enCurso!.trimestres) {
      expect(trimestre.estado).toBe('abierto')
      expect(trimestre.cerrado_en).toBeNull()
      expect(trimestre.deleted_at).toBeNull()
      expect(trimestre.ciclo_id).toBe(enCurso!.ciclo.id)
    }
  })

  it('usa UUID del cliente, nunca autoincremento', async () => {
    await repo.abrirCiclo('2026–2027', PERIODOS)
    const enCurso = await repo.cicloEnCurso()
    expect(enCurso?.ciclo.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('escribe updated_at en cada registro', async () => {
    await repo.abrirCiclo('2026–2027', PERIODOS)
    const enCurso = await repo.cicloEnCurso()

    expect(enCurso?.ciclo.updated_at).toMatch(/Z$/)
    for (const trimestre of enCurso!.trimestres) {
      expect(trimestre.updated_at).toMatch(/Z$/)
    }
  })

  it('encola el ciclo y sus tres trimestres en la outbox', async () => {
    await repo.abrirCiclo('2026–2027', PERIODOS)

    const pendientes = await db.outbox.toArray()
    expect(pendientes.filter((c) => c.tabla === 'ciclos')).toHaveLength(1)
    expect(pendientes.filter((c) => c.tabla === 'trimestres')).toHaveLength(3)
  })

  it('no deja un ciclo a medias si la transacción falla', async () => {
    // Un periodo con `numero` fuera del esquema no rompe nada, así que el modo
    // de falla que sí importa se provoca con un id repetido: el ciclo se escribe
    // primero y el trimestre después.
    await repo.abrirCiclo('2026–2027', PERIODOS)
    const antes = await db.ciclos.count()

    await expect(
      db.transaction('rw', db.ciclos, db.trimestres, db.outbox, async () => {
        const existente = (await db.ciclos.toArray())[0]!
        await db.ciclos.add(existente) // choca con la clave primaria
      }),
    ).rejects.toThrow()

    expect(await db.ciclos.count()).toBe(antes)
  })
})

describe('ajustarFechas', () => {
  it('cambia el rango y refresca updated_at', async () => {
    await repo.abrirCiclo('2026–2027', PERIODOS)
    const antes = (await repo.cicloEnCurso())!.trimestres[0]!

    await repo.ajustarFechas(antes.id, '2026-08-25', '2026-12-04')

    const despues = (await repo.cicloEnCurso())!.trimestres[0]!
    expect(despues.inicio).toBe('2026-08-25')
    expect(despues.fin).toBe('2026-12-04')
    expect(despues.id).toBe(antes.id)
  })

  it('no toca los demás trimestres', async () => {
    await repo.abrirCiclo('2026–2027', PERIODOS)
    const trimestres = (await repo.cicloEnCurso())!.trimestres

    await repo.ajustarFechas(trimestres[0]!.id, '2026-08-25', '2026-12-04')

    const despues = (await repo.cicloEnCurso())!.trimestres
    expect(despues[1]).toEqual(trimestres[1])
    expect(despues[2]).toEqual(trimestres[2])
  })

  it('encola el cambio', async () => {
    await repo.abrirCiclo('2026–2027', PERIODOS)
    const trimestre = (await repo.cicloEnCurso())!.trimestres[0]!
    await db.outbox.clear()

    await repo.ajustarFechas(trimestre.id, '2026-08-25', '2026-12-04')

    const pendientes = await db.outbox.toArray()
    expect(pendientes).toHaveLength(1)
    expect(pendientes[0]?.tabla).toBe('trimestres')
    expect(pendientes[0]?.registro_id).toBe(trimestre.id)
  })

  it('falla si el trimestre no existe, en vez de crear uno', async () => {
    await expect(repo.ajustarFechas('no-existe', '2026-08-25', '2026-12-04')).rejects.toThrow()
    expect(await db.trimestres.count()).toBe(0)
  })
})

describe('esquemaDeTrimestre', () => {
  it('un trimestre sin criterios devuelve la lista vacía, no null', async () => {
    const [t1] = await conCiclo()
    const esquema = await repo.esquemaDeTrimestre(t1!.id)
    expect(esquema?.trimestre.id).toBe(t1!.id)
    expect(esquema?.criterios).toEqual([])
  })

  it('un trimestre que no existe devuelve null', async () => {
    expect(await repo.esquemaDeTrimestre('no-existe')).toBeNull()
  })

  it('trae el nombre y el tipo del catálogo junto con el peso', async () => {
    const [t1] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)

    const esquema = await repo.esquemaDeTrimestre(t1!.id)
    expect(esquema?.criterios).toHaveLength(1)
    expect(esquema?.criterios[0]?.criterio.nombre).toBe('Tareas')
    expect(esquema?.criterios[0]?.criterio.tipo).toBe('entregable')
    expect(esquema?.criterios[0]?.ponderado.peso).toBe(0)
  })

  it('respeta el orden de alta', async () => {
    const [t1] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)
    await repo.agregarCriterio(t1!.id, 'Examen', 'examen', SIN_PARAMETROS)
    await repo.agregarCriterio(t1!.id, 'Portafolio', 'entregable', SIN_PARAMETROS)

    const esquema = await repo.esquemaDeTrimestre(t1!.id)
    expect(esquema?.criterios.map((c) => c.criterio.nombre)).toEqual([
      'Tareas',
      'Examen',
      'Portafolio',
    ])
  })

  it('no devuelve los criterios quitados', async () => {
    const [t1] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)
    await repo.agregarCriterio(t1!.id, 'Examen', 'examen', SIN_PARAMETROS)
    const esquema = await repo.esquemaDeTrimestre(t1!.id)

    await repo.quitarCriterio(esquema!.criterios[0]!.ponderado.id)

    const despues = await repo.esquemaDeTrimestre(t1!.id)
    expect(despues?.criterios.map((c) => c.criterio.nombre)).toEqual(['Examen'])
  })
})

describe('agregarCriterio', () => {
  it('el peso nace en 0: no se adivina el reparto', async () => {
    const [t1] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)
    const esquema = await repo.esquemaDeTrimestre(t1!.id)
    expect(esquema?.criterios[0]?.ponderado.peso).toBe(0)
  })

  it('reutiliza la entrada del catálogo entre trimestres', async () => {
    const [t1, t2] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)
    await repo.agregarCriterio(t2!.id, 'Tareas', 'entregable', SIN_PARAMETROS)

    // «Tareas» tiene que ser el mismo criterio en los tres trimestres para que
    // copiar el esquema y comparar entre periodos signifique algo.
    expect(await db.criterios.count()).toBe(1)
    const enT1 = await repo.esquemaDeTrimestre(t1!.id)
    const enT2 = await repo.esquemaDeTrimestre(t2!.id)
    expect(enT1?.criterios[0]?.criterio.id).toBe(enT2?.criterios[0]?.criterio.id)
    // Pero las filas del trimestre son distintas: es lo que aísla los pesos.
    expect(enT1?.criterios[0]?.ponderado.id).not.toBe(enT2?.criterios[0]?.ponderado.id)
  })

  it('reutiliza el catálogo sin importar acentos ni mayúsculas', async () => {
    const [t1, t2] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Exámen', 'examen', SIN_PARAMETROS)
    await repo.agregarCriterio(t2!.id, 'EXAMEN', 'examen', SIN_PARAMETROS)
    expect(await db.criterios.count()).toBe(1)
  })

  it('el mismo nombre con otro tipo es otro criterio', async () => {
    const [t1] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Proyecto', 'entregable', SIN_PARAMETROS)
    await repo.agregarCriterio(t1!.id, 'Proyecto', 'examen', SIN_PARAMETROS)
    expect(await db.criterios.count()).toBe(2)
  })

  it('agregar dos veces el mismo criterio al mismo trimestre no lo duplica', async () => {
    const [t1] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)

    const esquema = await repo.esquemaDeTrimestre(t1!.id)
    expect(esquema?.criterios).toHaveLength(1)
  })

  it('encola el criterio y su fila del trimestre', async () => {
    const [t1] = await conCiclo()
    await db.outbox.clear()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)

    const pendientes = await db.outbox.toArray()
    expect(pendientes.filter((c) => c.tabla === 'criterios')).toHaveLength(1)
    expect(pendientes.filter((c) => c.tabla === 'criterios_trimestre')).toHaveLength(1)
  })
})

describe('ajustarPeso', () => {
  it('deja el peso y refresca updated_at', async () => {
    const [t1] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)
    const antes = (await repo.esquemaDeTrimestre(t1!.id))!.criterios[0]!.ponderado

    await repo.ajustarPeso(antes.id, 40)

    const despues = (await repo.esquemaDeTrimestre(t1!.id))!.criterios[0]!.ponderado
    expect(despues.peso).toBe(40)
    expect(despues.updated_at >= antes.updated_at).toBe(true)
  })

  it('cambiar un peso en T2 no altera la fila de T1', async () => {
    const [t1, t2] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)
    await repo.agregarCriterio(t2!.id, 'Tareas', 'entregable', SIN_PARAMETROS)
    const enT1 = (await repo.esquemaDeTrimestre(t1!.id))!.criterios[0]!.ponderado
    await repo.ajustarPeso(enT1.id, 30)
    const enT2 = (await repo.esquemaDeTrimestre(t2!.id))!.criterios[0]!.ponderado

    await repo.ajustarPeso(enT2.id, 70)

    // Son filas distintas: el reparto de T1 es intocable desde T2, y con él lo
    // ya calculado en T1.
    expect((await db.criterios_trimestre.get(enT1.id))?.peso).toBe(30)
  })

  it('falla si la fila no existe, en vez de crearla', async () => {
    await expect(repo.ajustarPeso('no-existe', 40)).rejects.toThrow()
  })
})

describe('quitarCriterio', () => {
  it('es borrado suave y deja la entrada del catálogo en pie', async () => {
    const [t1] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)
    const ponderado = (await repo.esquemaDeTrimestre(t1!.id))!.criterios[0]!.ponderado

    await repo.quitarCriterio(ponderado.id)

    expect((await db.criterios_trimestre.get(ponderado.id))?.deleted_at).not.toBeNull()
    // El catálogo se queda: otros trimestres lo comparten.
    expect(await db.criterios.count()).toBe(1)
  })

  it('encola un delete, no un upsert', async () => {
    const [t1] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)
    const ponderado = (await repo.esquemaDeTrimestre(t1!.id))!.criterios[0]!.ponderado
    await db.outbox.clear()

    await repo.quitarCriterio(ponderado.id)

    expect((await db.outbox.toArray())[0]?.op).toBe('delete')
  })

  it('quitar algo que no existe no falla', async () => {
    await expect(repo.quitarCriterio('no-existe')).resolves.toBeUndefined()
  })
})

describe('ajustarParametros', () => {
  it('escribe los dos parámetros y encola el cambio', async () => {
    const [t1] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Participación', 'auto_participacion', SIN_PARAMETROS)
    const ponderado = (await repo.esquemaDeTrimestre(t1!.id))!.criterios[0]!.ponderado
    await db.outbox.clear()

    await repo.ajustarParametros(ponderado.id, {
      meta_participacion: 7,
      retardos_por_falta: 2,
    })

    const guardado = (await repo.esquemaDeTrimestre(t1!.id))!.criterios[0]!.ponderado
    expect(guardado.meta_participacion).toBe(7)
    expect(guardado.retardos_por_falta).toBe(2)
    // No `not.toBe`: las dos escrituras pueden caer en el mismo milisegundo y la
    // prueba sería intermitente. Lo que importa es que no retroceda.
    expect(guardado.updated_at >= ponderado.updated_at).toBe(true)

    const pendientes = await db.outbox.toArray()
    expect(pendientes).toHaveLength(1)
    expect(pendientes[0]?.tabla).toBe('criterios_trimestre')
    expect(pendientes[0]?.registro_id).toBe(ponderado.id)
  })

  it('no toca el peso ni nada capturado', async () => {
    // Los tres criterios automáticos se derivan al leer: cambiar un parámetro
    // recalcula, no migra (D-020).
    const [t1] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Puntualidad', 'auto_puntualidad', SIN_PARAMETROS)
    const ponderado = (await repo.esquemaDeTrimestre(t1!.id))!.criterios[0]!.ponderado
    await repo.ajustarPeso(ponderado.id, 15)

    await repo.ajustarParametros(ponderado.id, {
      meta_participacion: null,
      retardos_por_falta: 4,
    })

    const guardado = (await repo.esquemaDeTrimestre(t1!.id))!.criterios[0]!.ponderado
    expect(guardado.peso).toBe(15)
  })

  it('una fila que no existe no encola nada', async () => {
    await conCiclo()
    await db.outbox.clear()
    await repo.ajustarParametros('no-existe', {
      meta_participacion: 5,
      retardos_por_falta: null,
    })
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('copiarEsquema', () => {
  it('trae criterios y pesos', async () => {
    const [t1, t2] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)
    await repo.agregarCriterio(t1!.id, 'Examen', 'examen', SIN_PARAMETROS)
    const origen = (await repo.esquemaDeTrimestre(t1!.id))!.criterios
    await repo.ajustarPeso(origen[0]!.ponderado.id, 60)
    await repo.ajustarPeso(origen[1]!.ponderado.id, 40)

    await repo.copiarEsquema(t1!.id, t2!.id)

    const copia = (await repo.esquemaDeTrimestre(t2!.id))!.criterios
    expect(copia.map((c) => c.criterio.nombre)).toEqual(['Tareas', 'Examen'])
    expect(copia.map((c) => c.ponderado.peso)).toEqual([60, 40])
  })

  it('trae los parámetros de los criterios automáticos', async () => {
    // Copiar el esquema y perder cuántos retardos hacen una falta obligaría a
    // volver a decirlo en cada trimestre.
    const [t1, t2] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Puntualidad', 'auto_puntualidad', {
      meta_participacion: 10,
      retardos_por_falta: 3,
    })

    await repo.copiarEsquema(t1!.id, t2!.id)

    const copia = (await repo.esquemaDeTrimestre(t2!.id))!.criterios[0]!.ponderado
    expect(copia.meta_participacion).toBe(10)
    expect(copia.retardos_por_falta).toBe(3)
  })

  it('son filas nuevas, no las mismas', async () => {
    const [t1, t2] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)
    const origen = (await repo.esquemaDeTrimestre(t1!.id))!.criterios[0]!.ponderado

    await repo.copiarEsquema(t1!.id, t2!.id)
    const copia = (await repo.esquemaDeTrimestre(t2!.id))!.criterios[0]!.ponderado

    expect(copia.id).not.toBe(origen.id)
    expect(copia.trimestre_id).toBe(t2!.id)
    // Y el criterio del catálogo sí es el mismo: es lo que hace comparable el
    // «Tareas» de T1 con el de T2.
    expect(copia.criterio_id).toBe(origen.criterio_id)
  })

  it('cambiar el peso de la copia no toca el original', async () => {
    const [t1, t2] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)
    const origen = (await repo.esquemaDeTrimestre(t1!.id))!.criterios[0]!.ponderado
    await repo.ajustarPeso(origen.id, 60)
    await repo.copiarEsquema(t1!.id, t2!.id)
    const copia = (await repo.esquemaDeTrimestre(t2!.id))!.criterios[0]!.ponderado

    await repo.ajustarPeso(copia.id, 25)

    expect((await db.criterios_trimestre.get(origen.id))?.peso).toBe(60)
  })

  it('no copia actividades ni calificaciones', async () => {
    const [t1, t2] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)
    const origen = (await repo.esquemaDeTrimestre(t1!.id))!.criterios[0]!.ponderado

    // Una actividad con su entrega, colgando del criterio de T1.
    await db.actividades.add({
      id: 'actividad-1',
      updated_at: '2026-09-01T00:00:00.000Z',
      deleted_at: null,
      criterio_trimestre_id: origen.id,
      nombre: 'Suma y resta',
      campo: 'saberes_pensamiento_cientifico',
      ejes: [],
      fecha: '2026-09-01',
      rubrica_id: null,
    })
    await db.entregas.add({
      id: 'entrega-1',
      updated_at: '2026-09-01T00:00:00.000Z',
      deleted_at: null,
      actividad_id: 'actividad-1',
      alumno_id: 'alumno-1',
      entregada: true,
    })

    await repo.copiarEsquema(t1!.id, t2!.id)

    // El trimestre nuevo nace con cero actividades: es lo que resuelve el cambio
    // de trimestre por construcción (docs/DATA-MODEL.md).
    expect(await db.actividades.count()).toBe(1)
    expect(await db.entregas.count()).toBe(1)
    const copia = (await repo.esquemaDeTrimestre(t2!.id))!.criterios[0]!.ponderado
    const suyas = await db.actividades.where('criterio_trimestre_id').equals(copia.id).count()
    expect(suyas).toBe(0)
  })

  it('no duplica lo que el destino ya tiene', async () => {
    const [t1, t2] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)
    await repo.agregarCriterio(t1!.id, 'Examen', 'examen', SIN_PARAMETROS)
    await repo.agregarCriterio(t2!.id, 'Tareas', 'entregable', SIN_PARAMETROS)

    await repo.copiarEsquema(t1!.id, t2!.id)

    const copia = (await repo.esquemaDeTrimestre(t2!.id))!.criterios
    expect(copia.map((c) => c.criterio.nombre)).toEqual(['Tareas', 'Examen'])
  })

  it('copiar dos veces no duplica', async () => {
    const [t1, t2] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)

    await repo.copiarEsquema(t1!.id, t2!.id)
    await repo.copiarEsquema(t1!.id, t2!.id)

    expect((await repo.esquemaDeTrimestre(t2!.id))!.criterios).toHaveLength(1)
  })
})

const RENGLON = (nombre: string) => ({
  nombre,
  descriptores: ['Excelente así', 'Bien así', 'Regular así', 'Mal así'] as [
    string,
    string,
    string,
    string,
  ],
})

describe('rubricas', () => {
  it('sin ninguna devuelve la lista vacía', async () => {
    expect(await repo.rubricas()).toEqual([])
  })

  it('nace activa y con sus renglones en orden', async () => {
    await repo.guardarRubrica({ nombre: 'Trabajo escrito' }, [
      RENGLON('Ortografía'),
      RENGLON('Claridad'),
    ])

    const [guardada] = await repo.rubricas()
    expect(guardada?.rubrica.nombre).toBe('Trabajo escrito')
    expect(guardada?.rubrica.activa).toBe(true)
    expect(guardada?.criterios.map((c) => c.nombre)).toEqual(['Ortografía', 'Claridad'])
    expect(guardada?.criterios.map((c) => c.orden)).toEqual([0, 1])
    expect(guardada?.enUso).toBe(false)
  })

  it('las ordena por nombre', async () => {
    await repo.guardarRubrica({ nombre: 'Exposición' }, [RENGLON('Voz')])
    await repo.guardarRubrica({ nombre: 'Cuaderno' }, [RENGLON('Limpieza')])

    expect((await repo.rubricas()).map((r) => r.rubrica.nombre)).toEqual([
      'Cuaderno',
      'Exposición',
    ])
  })

  it('marca enUso cuando una actividad la referencia, no un criterio', async () => {
    const [t1] = await conCiclo()
    const rubricaId = await repo.guardarRubrica({ nombre: 'Trabajo escrito' }, [
      RENGLON('Ortografía'),
    ])
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)
    const ponderado = (await repo.esquemaDeTrimestre(t1!.id))!.criterios[0]!.ponderado

    expect((await repo.rubricas())[0]?.enUso).toBe(false)

    await db.actividades.add(unaActividad(ponderado.id, rubricaId))

    expect((await repo.rubricas())[0]?.enUso).toBe(true)
  })

  it('una actividad borrada deja de contar como uso', async () => {
    const [t1] = await conCiclo()
    const rubricaId = await repo.guardarRubrica({ nombre: 'Trabajo escrito' }, [
      RENGLON('Ortografía'),
    ])
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)
    const ponderado = (await repo.esquemaDeTrimestre(t1!.id))!.criterios[0]!.ponderado
    const actividad = unaActividad(ponderado.id, rubricaId)
    await db.actividades.add(actividad)

    await db.actividades.update(actividad.id, { deleted_at: '2026-09-02T00:00:00.000Z' })

    expect((await repo.rubricas())[0]?.enUso).toBe(false)
  })

  it('una actividad sin rúbrica no marca nada en uso', async () => {
    const [t1] = await conCiclo()
    await repo.guardarRubrica({ nombre: 'Trabajo escrito' }, [RENGLON('Ortografía')])
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)
    const ponderado = (await repo.esquemaDeTrimestre(t1!.id))!.criterios[0]!.ponderado

    // Sin rúbrica no es un estado incompleto: es captura binaria.
    await db.actividades.add(unaActividad(ponderado.id, null))

    expect((await repo.rubricas())[0]?.enUso).toBe(false)
  })
})

describe('guardarRubrica', () => {
  it('conserva el id de los renglones que ya existían', async () => {
    const id = await repo.guardarRubrica({ nombre: 'Trabajo escrito' }, [
      RENGLON('Ortografía'),
      RENGLON('Claridad'),
    ])
    const antes = (await repo.rubricas())[0]!.criterios

    await repo.guardarRubrica({ id, nombre: 'Trabajo escrito' }, [
      { id: antes[0]!.id, ...RENGLON('Ortografía y acentos') },
      { id: antes[1]!.id, ...RENGLON('Claridad') },
    ])

    const despues = (await repo.rubricas())[0]!.criterios
    // El id es la clave de EvaluacionRubrica.niveles: recrearlo dejaría huérfano
    // todo lo ya calificado con esta rúbrica.
    expect(despues.map((c) => c.id)).toEqual(antes.map((c) => c.id))
    expect(despues[0]?.nombre).toBe('Ortografía y acentos')
  })

  it('borra en suave los renglones que ya no vienen', async () => {
    const id = await repo.guardarRubrica({ nombre: 'Trabajo escrito' }, [
      RENGLON('Ortografía'),
      RENGLON('Claridad'),
    ])
    const antes = (await repo.rubricas())[0]!.criterios

    await repo.guardarRubrica({ id, nombre: 'Trabajo escrito' }, [
      { id: antes[0]!.id, ...RENGLON('Ortografía') },
    ])

    expect((await repo.rubricas())[0]!.criterios.map((c) => c.nombre)).toEqual(['Ortografía'])
    expect((await db.rubrica_criterios.get(antes[1]!.id))?.deleted_at).not.toBeNull()
  })

  it('reordena según llegan los renglones', async () => {
    const id = await repo.guardarRubrica({ nombre: 'Trabajo escrito' }, [
      RENGLON('Ortografía'),
      RENGLON('Claridad'),
    ])
    const antes = (await repo.rubricas())[0]!.criterios

    await repo.guardarRubrica({ id, nombre: 'Trabajo escrito' }, [
      { id: antes[1]!.id, ...RENGLON('Claridad') },
      { id: antes[0]!.id, ...RENGLON('Ortografía') },
    ])

    expect((await repo.rubricas())[0]!.criterios.map((c) => c.nombre)).toEqual([
      'Claridad',
      'Ortografía',
    ])
  })

  it('guarda un descriptor por nivel, tal cual', async () => {
    await repo.guardarRubrica({ nombre: 'Trabajo escrito' }, [RENGLON('Ortografía')])
    const renglon = (await repo.rubricas())[0]!.criterios[0]!
    expect(renglon.descriptores).toHaveLength(4)
    expect(renglon.descriptores[3]).toBe('Mal así')
  })

  it('encola la rúbrica y sus renglones', async () => {
    await db.outbox.clear()
    await repo.guardarRubrica({ nombre: 'Trabajo escrito' }, [
      RENGLON('Ortografía'),
      RENGLON('Claridad'),
    ])

    const pendientes = await db.outbox.toArray()
    expect(pendientes.filter((c) => c.tabla === 'rubricas')).toHaveLength(1)
    expect(pendientes.filter((c) => c.tabla === 'rubrica_criterios')).toHaveLength(2)
  })

  it('editarla no la reactiva sola', async () => {
    const id = await repo.guardarRubrica({ nombre: 'Trabajo escrito' }, [RENGLON('Ortografía')])
    await repo.cambiarActivaRubrica(id, false)

    await repo.guardarRubrica({ id, nombre: 'Trabajo escrito v2' }, [RENGLON('Ortografía')])

    expect((await repo.rubricas())[0]?.rubrica.activa).toBe(false)
  })
})

describe('cambiarActivaRubrica', () => {
  it('desactiva y vuelve a activar', async () => {
    const id = await repo.guardarRubrica({ nombre: 'Trabajo escrito' }, [RENGLON('Ortografía')])

    await repo.cambiarActivaRubrica(id, false)
    expect((await repo.rubricas())[0]?.rubrica.activa).toBe(false)

    await repo.cambiarActivaRubrica(id, true)
    expect((await repo.rubricas())[0]?.rubrica.activa).toBe(true)
  })

  it('desactivada sigue existiendo y conserva sus renglones', async () => {
    // Es la diferencia con borrarla: lo ya calificado con ella se sigue
    // resolviendo por id.
    const id = await repo.guardarRubrica({ nombre: 'Trabajo escrito' }, [RENGLON('Ortografía')])
    await repo.cambiarActivaRubrica(id, false)

    const [guardada] = await repo.rubricas()
    expect(guardada?.criterios).toHaveLength(1)
  })

  it('falla si no existe', async () => {
    await expect(repo.cambiarActivaRubrica('no-existe', false)).rejects.toThrow()
  })
})

describe('borrarRubrica', () => {
  it('borra en suave la rúbrica y sus renglones', async () => {
    const id = await repo.guardarRubrica({ nombre: 'Trabajo escrito' }, [
      RENGLON('Ortografía'),
      RENGLON('Claridad'),
    ])

    await repo.borrarRubrica(id)

    expect(await repo.rubricas()).toEqual([])
    expect((await db.rubricas.get(id))?.deleted_at).not.toBeNull()
    const renglones = await db.rubrica_criterios.where('rubrica_id').equals(id).toArray()
    expect(renglones.every((c) => c.deleted_at !== null)).toBe(true)
  })

  it('encola deletes', async () => {
    const id = await repo.guardarRubrica({ nombre: 'Trabajo escrito' }, [RENGLON('Ortografía')])
    await db.outbox.clear()

    await repo.borrarRubrica(id)

    const pendientes = await db.outbox.toArray()
    expect(pendientes.every((c) => c.op === 'delete')).toBe(true)
    expect(pendientes).toHaveLength(2)
  })

  it('borrar algo que no existe no falla', async () => {
    await expect(repo.borrarRubrica('no-existe')).resolves.toBeUndefined()
  })
})

describe('actividadesDeTrimestre', () => {
  it('un trimestre sin criterios no devuelve grupos', async () => {
    const [t1] = await conCiclo()
    expect(await repo.actividadesDeTrimestre(t1!.id)).toEqual([])
  })

  it('un trimestre que no existe devuelve la lista vacía', async () => {
    expect(await repo.actividadesDeTrimestre('no-existe')).toEqual([])
  })

  it('agrupa por criterio y deja el examen fuera', async () => {
    const [t1] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)
    await repo.agregarCriterio(t1!.id, 'Examen final', 'examen', SIN_PARAMETROS)

    // El examen se captura por aciertos sobre el CriterioTrimestre, no por
    // actividades, así que no tiene por qué aparecer aquí.
    const grupos = await repo.actividadesDeTrimestre(t1!.id)
    expect(grupos.map((g) => g.criterio.nombre)).toEqual(['Tareas'])
    expect(grupos[0]?.actividades).toEqual([])
  })

  it('las devuelve de la más reciente a la más vieja', async () => {
    const grupo = await unGrupo()
    await repo.crearActividad(datosDe(grupo, { nombre: 'Vieja', fecha: '2026-09-01' }))
    await repo.crearActividad(datosDe(grupo, { nombre: 'Nueva', fecha: '2026-09-20' }))
    await repo.crearActividad(datosDe(grupo, { nombre: 'Media', fecha: '2026-09-10' }))

    const [primero] = await repo.actividadesDeTrimestre(grupo.trimestreId)
    expect(primero?.actividades.map((a) => a.actividad.nombre)).toEqual([
      'Nueva',
      'Media',
      'Vieja',
    ])
  })

  it('no devuelve las actividades de otro criterio', async () => {
    const [t1] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)
    await repo.agregarCriterio(t1!.id, 'Portafolio', 'entregable', SIN_PARAMETROS)
    const grupos = await repo.actividadesDeTrimestre(t1!.id)
    const tareas = grupos[0]!.ponderado.id
    const portafolio = grupos[1]!.ponderado.id

    await repo.crearActividad({
      criterio_trimestre_id: tareas,
      nombre: 'De tareas',
      campo: 'lenguajes',
      ejes: [],
      fecha: '2026-09-01',
      rubrica_id: null,
    })

    const despues = await repo.actividadesDeTrimestre(t1!.id)
    expect(despues.find((g) => g.ponderado.id === tareas)?.actividades).toHaveLength(1)
    expect(despues.find((g) => g.ponderado.id === portafolio)?.actividades).toEqual([])
  })

  it('registros cuenta 0 mientras nadie la califique', async () => {
    const grupo = await unGrupo()
    await repo.crearActividad(datosDe(grupo, { nombre: 'Cuento' }))

    const [primero] = await repo.actividadesDeTrimestre(grupo.trimestreId)
    // Cero registros es «sin calificar», que no es lo mismo que calificada con
    // ceros: una actividad sin registros se excluye del promedio.
    expect(primero?.actividades[0]?.registros).toBe(0)
  })

  it('cuenta las entregas y las evaluaciones de rúbrica', async () => {
    const grupo = await unGrupo()
    const conEntregas = await repo.crearActividad(datosDe(grupo, { nombre: 'Con entregas' }))
    const conRubrica = await repo.crearActividad(datosDe(grupo, { nombre: 'Con rúbrica' }))

    await db.entregas.bulkAdd([
      entrega('e1', conEntregas, 'alumno-1'),
      entrega('e2', conEntregas, 'alumno-2'),
    ])
    await db.eval_rubrica.add({
      id: 'ev1',
      updated_at: '2026-09-01T00:00:00.000Z',
      deleted_at: null,
      actividad_id: conRubrica,
      alumno_id: 'alumno-1',
      niveles: {},
    })

    const [primero] = await repo.actividadesDeTrimestre(grupo.trimestreId)
    const porNombre = new Map(
      primero!.actividades.map((a) => [a.actividad.nombre, a.registros]),
    )
    expect(porNombre.get('Con entregas')).toBe(2)
    expect(porNombre.get('Con rúbrica')).toBe(1)
  })

  it('no cuenta los registros borrados', async () => {
    const grupo = await unGrupo()
    const actividadId = await repo.crearActividad(datosDe(grupo, { nombre: 'Cuento' }))
    await db.entregas.add(entrega('e1', actividadId, 'alumno-1'))
    await db.entregas.update('e1', { deleted_at: '2026-09-02T00:00:00.000Z' })

    const [primero] = await repo.actividadesDeTrimestre(grupo.trimestreId)
    expect(primero?.actividades[0]?.registros).toBe(0)
  })

  it('no devuelve las actividades borradas', async () => {
    const grupo = await unGrupo()
    const actividadId = await repo.crearActividad(datosDe(grupo, { nombre: 'Cuento' }))

    await repo.borrarActividad(actividadId)

    const [primero] = await repo.actividadesDeTrimestre(grupo.trimestreId)
    expect(primero?.actividades).toEqual([])
  })
})

describe('crearActividad', () => {
  it('guarda lo que se le da, con UUID y updated_at', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(
      datosDe(grupo, {
        nombre: 'Cuento de terror',
        campo: 'lenguajes',
        ejes: ['Pensamiento crítico'],
        fecha: '2026-09-15',
      }),
    )

    const guardada = await db.actividades.get(id)
    expect(guardada?.nombre).toBe('Cuento de terror')
    expect(guardada?.campo).toBe('lenguajes')
    expect(guardada?.ejes).toEqual(['Pensamiento crítico'])
    expect(guardada?.fecha).toBe('2026-09-15')
    expect(guardada?.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(guardada?.updated_at).toMatch(/Z$/)
    expect(guardada?.deleted_at).toBeNull()
  })

  it('sin rúbrica queda en null, que es captura binaria', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Tarea del día' }))
    expect((await db.actividades.get(id))?.rubrica_id).toBeNull()
  })

  it('encola el alta', async () => {
    const grupo = await unGrupo()
    await db.outbox.clear()
    await repo.crearActividad(datosDe(grupo, { nombre: 'Cuento' }))

    const pendientes = await db.outbox.toArray()
    expect(pendientes).toHaveLength(1)
    expect(pendientes[0]?.tabla).toBe('actividades')
    expect(pendientes[0]?.op).toBe('upsert')
  })
})

describe('editarActividad', () => {
  it('cambia los datos y conserva el id', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Cuento' }))

    await repo.editarActividad(
      id,
      datosDe(grupo, { nombre: 'Cuento de terror', fecha: '2026-09-20' }),
      false,
    )

    const guardada = await db.actividades.get(id)
    expect(guardada?.nombre).toBe('Cuento de terror')
    expect(guardada?.fecha).toBe('2026-09-20')
  })

  it('sin descartar, conserva lo capturado', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Cuento' }))
    await db.entregas.add(entrega('e1', id, 'alumno-1'))

    // Renombrar o mover la fecha no tira nada.
    await repo.editarActividad(id, datosDe(grupo, { nombre: 'Cuento corto' }), false)

    const [primero] = await repo.actividadesDeTrimestre(grupo.trimestreId)
    expect(primero?.actividades[0]?.registros).toBe(1)
  })

  it('descartando, borra en suave las entregas y las evaluaciones', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Cuento' }))
    await db.entregas.add(entrega('e1', id, 'alumno-1'))
    await db.eval_rubrica.add({
      id: 'ev1',
      updated_at: '2026-09-01T00:00:00.000Z',
      deleted_at: null,
      actividad_id: id,
      alumno_id: 'alumno-2',
      niveles: {},
    })

    await repo.editarActividad(id, datosDe(grupo, { nombre: 'Cuento' }), true)

    expect((await db.entregas.get('e1'))?.deleted_at).not.toBeNull()
    expect((await db.eval_rubrica.get('ev1'))?.deleted_at).not.toBeNull()
    const [primero] = await repo.actividadesDeTrimestre(grupo.trimestreId)
    expect(primero?.actividades[0]?.registros).toBe(0)
  })

  it('descartar encola un delete por registro', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Cuento' }))
    await db.entregas.bulkAdd([entrega('e1', id, 'alumno-1'), entrega('e2', id, 'alumno-2')])
    await db.outbox.clear()

    await repo.editarActividad(id, datosDe(grupo, { nombre: 'Cuento' }), true)

    const pendientes = await db.outbox.toArray()
    expect(pendientes.filter((c) => c.tabla === 'entregas' && c.op === 'delete')).toHaveLength(2)
    expect(pendientes.filter((c) => c.tabla === 'actividades')).toHaveLength(1)
  })

  it('falla si la actividad no existe, en vez de crearla', async () => {
    const grupo = await unGrupo()
    await expect(
      repo.editarActividad('no-existe', datosDe(grupo, { nombre: 'Cuento' }), false),
    ).rejects.toThrow()
    expect(await db.actividades.count()).toBe(0)
  })
})

describe('borrarActividad', () => {
  it('borra en suave la actividad y su captura', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Cuento' }))
    await db.entregas.add(entrega('e1', id, 'alumno-1'))

    await repo.borrarActividad(id)

    expect((await db.actividades.get(id))?.deleted_at).not.toBeNull()
    expect((await db.entregas.get('e1'))?.deleted_at).not.toBeNull()
  })

  it('encola deletes de la actividad y de lo capturado', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Cuento' }))
    await db.entregas.add(entrega('e1', id, 'alumno-1'))
    await db.outbox.clear()

    await repo.borrarActividad(id)

    const pendientes = await db.outbox.toArray()
    expect(pendientes.every((c) => c.op === 'delete')).toBe(true)
    expect(pendientes.map((c) => c.tabla).sort()).toEqual(['actividades', 'entregas'])
  })

  it('borrar algo que no existe no falla', async () => {
    await expect(repo.borrarActividad('no-existe')).resolves.toBeUndefined()
  })
})

describe('entregasDeActividad', () => {
  it('sin captura devuelve la lista vacía', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Cuento' }))
    expect(await repo.entregasDeActividad(id)).toEqual([])
  })

  it('no devuelve las de otra actividad', async () => {
    const grupo = await unGrupo()
    const una = await repo.crearActividad(datosDe(grupo, { nombre: 'Una' }))
    const otra = await repo.crearActividad(datosDe(grupo, { nombre: 'Otra' }))
    await repo.materializarEntregas(una, ['alumno-1', 'alumno-2'])
    await repo.materializarEntregas(otra, ['alumno-1'])

    expect(await repo.entregasDeActividad(una)).toHaveLength(2)
    expect(await repo.entregasDeActividad(otra)).toHaveLength(1)
  })

  it('no devuelve las borradas', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Cuento' }))
    await repo.materializarEntregas(id, ['alumno-1', 'alumno-2'])
    const primera = (await repo.entregasDeActividad(id))[0]!
    await db.entregas.update(primera.id, { deleted_at: '2026-09-02T00:00:00.000Z' })

    expect(await repo.entregasDeActividad(id)).toHaveLength(1)
  })
})

describe('materializarEntregas', () => {
  it('escribe una por alumno, en entregada', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Cuento' }))

    await repo.materializarEntregas(id, ['alumno-1', 'alumno-2', 'alumno-3'])

    const entregas = await repo.entregasDeActividad(id)
    expect(entregas).toHaveLength(3)
    expect(entregas.every((e) => e.entregada)).toBe(true)
    expect(entregas.every((e) => e.deleted_at === null)).toBe(true)
    expect(entregas.every((e) => e.updated_at.endsWith('Z'))).toBe(true)
  })

  it('usa UUID del cliente', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Cuento' }))
    await repo.materializarEntregas(id, ['alumno-1'])
    expect((await repo.entregasDeActividad(id))[0]?.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('no toca a los que ya tienen registro', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Cuento' }))
    await repo.marcarEntrega(id, 'alumno-1', false)

    await repo.materializarEntregas(id, ['alumno-1', 'alumno-2'])

    const entregas = await repo.entregasDeActividad(id)
    expect(entregas).toHaveLength(2)
    expect(entregas.find((e) => e.alumno_id === 'alumno-1')?.entregada).toBe(false)
  })

  it('sin faltantes no escribe nada: la outbox no se llena en cada apertura', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Cuento' }))
    await repo.materializarEntregas(id, ['alumno-1'])
    await db.outbox.clear()

    await repo.materializarEntregas(id, ['alumno-1'])

    expect(await db.outbox.count()).toBe(0)
  })

  it('encola una por entrega, en un solo lote', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Cuento' }))
    await db.outbox.clear()

    await repo.materializarEntregas(id, ['alumno-1', 'alumno-2', 'alumno-3'])

    const pendientes = await db.outbox.toArray()
    expect(pendientes).toHaveLength(3)
    expect(pendientes.every((c) => c.tabla === 'entregas')).toBe(true)
    // Mismo instante: salieron de una sola escritura, no de tres.
    expect(new Set(pendientes.map((c) => c.at)).size).toBe(1)
  })

  it('no deja entregas sin su pendiente si la transacción falla', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Cuento' }))
    await repo.materializarEntregas(id, ['alumno-1'])
    const antes = await db.entregas.count()

    await expect(
      db.transaction('rw', db.entregas, db.outbox, async () => {
        const existente = (await db.entregas.toArray())[0]!
        await db.entregas.add(existente) // choca con la clave primaria
      }),
    ).rejects.toThrow()

    expect(await db.entregas.count()).toBe(antes)
  })
})

describe('marcarEntrega', () => {
  it('es upsert por [actividad_id+alumno_id]', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Cuento' }))

    await repo.marcarEntrega(id, 'alumno-1', false)
    await repo.marcarEntrega(id, 'alumno-1', true)
    await repo.marcarEntrega(id, 'alumno-1', false)

    // Un registro por alumno por actividad, nunca tres.
    const entregas = await repo.entregasDeActividad(id)
    expect(entregas).toHaveLength(1)
    expect(entregas[0]?.entregada).toBe(false)
  })

  it('el mismo alumno en otra actividad es otro registro', async () => {
    const grupo = await unGrupo()
    const una = await repo.crearActividad(datosDe(grupo, { nombre: 'Una' }))
    const otra = await repo.crearActividad(datosDe(grupo, { nombre: 'Otra' }))

    await repo.marcarEntrega(una, 'alumno-1', false)
    await repo.marcarEntrega(otra, 'alumno-1', true)

    expect((await repo.entregasDeActividad(una))[0]?.entregada).toBe(false)
    expect((await repo.entregasDeActividad(otra))[0]?.entregada).toBe(true)
  })

  it('revive un registro borrado en vez de crear uno nuevo', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Cuento' }))
    await repo.marcarEntrega(id, 'alumno-1', true)
    const primera = (await repo.entregasDeActividad(id))[0]!
    await db.entregas.update(primera.id, { deleted_at: '2026-09-02T00:00:00.000Z' })

    await repo.marcarEntrega(id, 'alumno-1', false)

    // Para la maestra es el mismo alumno en la misma actividad, no uno nuevo.
    const entregas = await repo.entregasDeActividad(id)
    expect(entregas).toHaveLength(1)
    expect(entregas[0]?.id).toBe(primera.id)
  })

  it('refresca updated_at en cada mutación', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Cuento' }))
    await repo.marcarEntrega(id, 'alumno-1', true)
    const antes = (await repo.entregasDeActividad(id))[0]!

    await repo.marcarEntrega(id, 'alumno-1', false)

    const despues = (await repo.entregasDeActividad(id))[0]!
    expect(despues.updated_at >= antes.updated_at).toBe(true)
  })

  it('la captura hace que la actividad cuente como calificada', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Cuento' }))
    expect(
      (await repo.actividadesDeTrimestre(grupo.trimestreId))[0]?.actividades[0]?.registros,
    ).toBe(0)

    await repo.materializarEntregas(id, ['alumno-1', 'alumno-2'])

    expect(
      (await repo.actividadesDeTrimestre(grupo.trimestreId))[0]?.actividades[0]?.registros,
    ).toBe(2)
  })
})

describe('evaluacionesDeActividad', () => {
  it('sin captura devuelve la lista vacía', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Proyecto' }))
    expect(await repo.evaluacionesDeActividad(id)).toEqual([])
  })

  it('no devuelve las de otra actividad', async () => {
    const grupo = await unGrupo()
    const una = await repo.crearActividad(datosDe(grupo, { nombre: 'Una' }))
    const otra = await repo.crearActividad(datosDe(grupo, { nombre: 'Otra' }))
    await repo.calificarRenglon(una, 'alumno-1', 'renglon-1', 0)
    await repo.calificarRenglon(otra, 'alumno-1', 'renglon-1', 3)

    expect((await repo.evaluacionesDeActividad(una))[0]?.niveles).toEqual({ 'renglon-1': 0 })
    expect((await repo.evaluacionesDeActividad(otra))[0]?.niveles).toEqual({ 'renglon-1': 3 })
  })

  it('no devuelve las borradas', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Proyecto' }))
    await repo.calificarRenglon(id, 'alumno-1', 'renglon-1', 1)
    await repo.calificarRenglon(id, 'alumno-2', 'renglon-1', 1)
    const primera = (await repo.evaluacionesDeActividad(id))[0]!
    await db.eval_rubrica.update(primera.id, { deleted_at: '2026-09-02T00:00:00.000Z' })

    expect(await repo.evaluacionesDeActividad(id)).toHaveLength(1)
  })
})

describe('calificarRenglon', () => {
  it('el primer toque crea el registro, con UUID del cliente', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Proyecto' }))

    await repo.calificarRenglon(id, 'alumno-1', 'renglon-1', 1)

    const evaluaciones = await repo.evaluacionesDeActividad(id)
    expect(evaluaciones).toHaveLength(1)
    expect(evaluaciones[0]?.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(evaluaciones[0]?.deleted_at).toBe(null)
    expect(evaluaciones[0]?.updated_at.endsWith('Z')).toBe(true)
  })

  it('guarda el índice del nivel, no su valor', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Proyecto' }))

    // 'Mal' es el índice 3 y vale 0. Guardar el valor haría que cambiar
    // VALOR_NIVEL migrara datos.
    await repo.calificarRenglon(id, 'alumno-1', 'renglon-1', 3)

    expect((await repo.evaluacionesDeActividad(id))[0]?.niveles).toEqual({ 'renglon-1': 3 })
  })

  it('los renglones se van llenando sin borrarse entre sí', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Proyecto' }))

    await repo.calificarRenglon(id, 'alumno-1', 'renglon-1', 0)
    await repo.calificarRenglon(id, 'alumno-1', 'renglon-2', 2)

    const evaluaciones = await repo.evaluacionesDeActividad(id)
    expect(evaluaciones).toHaveLength(1)
    expect(evaluaciones[0]?.niveles).toEqual({ 'renglon-1': 0, 'renglon-2': 2 })
  })

  it('es upsert por [actividad_id+alumno_id]', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Proyecto' }))

    await repo.calificarRenglon(id, 'alumno-1', 'renglon-1', 0)
    await repo.calificarRenglon(id, 'alumno-1', 'renglon-1', 1)
    await repo.calificarRenglon(id, 'alumno-1', 'renglon-1', 2)

    // Un registro por alumno por actividad, nunca tres.
    const evaluaciones = await repo.evaluacionesDeActividad(id)
    expect(evaluaciones).toHaveLength(1)
    expect(evaluaciones[0]?.niveles).toEqual({ 'renglon-1': 2 })
  })

  it('revive un registro borrado en vez de crear uno nuevo', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Proyecto' }))
    await repo.calificarRenglon(id, 'alumno-1', 'renglon-1', 1)
    const primera = (await repo.evaluacionesDeActividad(id))[0]!
    await db.eval_rubrica.update(primera.id, { deleted_at: '2026-09-02T00:00:00.000Z' })

    await repo.calificarRenglon(id, 'alumno-1', 'renglon-1', 2)

    const evaluaciones = await repo.evaluacionesDeActividad(id)
    expect(evaluaciones).toHaveLength(1)
    expect(evaluaciones[0]?.id).toBe(primera.id)
  })

  it('encola un pendiente por toque', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Proyecto' }))
    await db.outbox.clear()

    await repo.calificarRenglon(id, 'alumno-1', 'renglon-1', 0)

    const pendientes = await db.outbox.toArray()
    expect(pendientes).toHaveLength(1)
    expect(pendientes[0]?.tabla).toBe('eval_rubrica')
    expect(pendientes[0]?.op).toBe('upsert')
  })

  it('la captura hace que la actividad cuente como calificada', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Proyecto' }))

    await repo.calificarRenglon(id, 'alumno-1', 'renglon-1', 0)
    await repo.calificarRenglon(id, 'alumno-2', 'renglon-1', 0)

    expect(
      (await repo.actividadesDeTrimestre(grupo.trimestreId))[0]?.actividades[0]?.registros,
    ).toBe(2)
  })

  it('cambiar con qué se califica descarta la captura de rúbrica', async () => {
    const grupo = await unGrupo()
    const id = await repo.crearActividad(datosDe(grupo, { nombre: 'Proyecto' }))
    await repo.calificarRenglon(id, 'alumno-1', 'renglon-1', 0)

    await repo.editarActividad(id, datosDe(grupo, { nombre: 'Proyecto' }), true)

    expect(await repo.evaluacionesDeActividad(id)).toEqual([])
  })
})

/** Un trimestre con un criterio de examen, que es de donde cuelga el examen. */
async function unExamen() {
  const [t1] = await conCiclo()
  await repo.agregarCriterio(t1!.id, 'Examen', 'examen', SIN_PARAMETROS)
  const examenes = await repo.examenesDeTrimestre(t1!.id)
  return { trimestreId: t1!.id, criterioTrimestreId: examenes[0]!.ponderado.id }
}

describe('examenesDeTrimestre', () => {
  it('devuelve los criterios de examen, no los entregables', async () => {
    const [t1] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)
    await repo.agregarCriterio(t1!.id, 'Examen', 'examen', SIN_PARAMETROS)

    const examenes = await repo.examenesDeTrimestre(t1!.id)
    expect(examenes).toHaveLength(1)
    expect(examenes[0]?.criterio.nombre).toBe('Examen')
  })

  it('sin criterio de examen devuelve la lista vacía', async () => {
    const [t1] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable', SIN_PARAMETROS)
    expect(await repo.examenesDeTrimestre(t1!.id)).toEqual([])
  })

  it('sin preguntas la configuración viene en null, no falla', async () => {
    const { trimestreId } = await unExamen()
    expect((await repo.examenesDeTrimestre(trimestreId))[0]?.config).toBeNull()
  })

  it('trae las preguntas ya guardadas', async () => {
    const { trimestreId, criterioTrimestreId } = await unExamen()
    await repo.guardarPreguntasExamen(criterioTrimestreId, { lenguajes: 20 })

    expect((await repo.examenesDeTrimestre(trimestreId))[0]?.config?.preguntas).toEqual({
      lenguajes: 20,
    })
  })

  it('un trimestre que no existe devuelve la lista vacía', async () => {
    expect(await repo.examenesDeTrimestre('no-existe')).toEqual([])
  })
})

describe('guardarPreguntasExamen', () => {
  it('es upsert: corregir el total no deja dos configuraciones', async () => {
    const { trimestreId, criterioTrimestreId } = await unExamen()

    await repo.guardarPreguntasExamen(criterioTrimestreId, { lenguajes: 20 })
    await repo.guardarPreguntasExamen(criterioTrimestreId, { lenguajes: 18 })

    expect(await db.examen_config.count()).toBe(1)
    expect((await repo.examenesDeTrimestre(trimestreId))[0]?.config?.preguntas).toEqual({
      lenguajes: 18,
    })
  })

  it('usa UUID del cliente y encola el cambio', async () => {
    const { criterioTrimestreId } = await unExamen()
    await db.outbox.clear()

    await repo.guardarPreguntasExamen(criterioTrimestreId, { lenguajes: 20 })

    const config = (await db.examen_config.toArray())[0]!
    expect(config.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(config.updated_at.endsWith('Z')).toBe(true)
    const pendientes = await db.outbox.toArray()
    expect(pendientes).toHaveLength(1)
    expect(pendientes[0]?.tabla).toBe('examen_config')
  })

  it('corregir los totales no toca los aciertos capturados', async () => {
    const { criterioTrimestreId } = await unExamen()
    await repo.guardarPreguntasExamen(criterioTrimestreId, { lenguajes: 20 })
    await repo.registrarAciertos(criterioTrimestreId, 'alumno-1', 'lenguajes', 15)

    await repo.guardarPreguntasExamen(criterioTrimestreId, { lenguajes: 18 })

    expect((await repo.resultadosDeExamen(criterioTrimestreId))[0]?.aciertos).toEqual({
      lenguajes: 15,
    })
  })
})

describe('resultadosDeExamen', () => {
  it('sin captura devuelve la lista vacía', async () => {
    const { criterioTrimestreId } = await unExamen()
    expect(await repo.resultadosDeExamen(criterioTrimestreId)).toEqual([])
  })

  it('no devuelve los borrados', async () => {
    const { criterioTrimestreId } = await unExamen()
    await repo.registrarAciertos(criterioTrimestreId, 'alumno-1', 'lenguajes', 8)
    await repo.registrarAciertos(criterioTrimestreId, 'alumno-2', 'lenguajes', 9)
    const primero = (await repo.resultadosDeExamen(criterioTrimestreId))[0]!
    await db.resultados_examen.update(primero.id, { deleted_at: '2026-11-02T00:00:00.000Z' })

    expect(await repo.resultadosDeExamen(criterioTrimestreId)).toHaveLength(1)
  })
})

describe('registrarAciertos', () => {
  it('los campos se van llenando sin borrarse entre sí', async () => {
    const { criterioTrimestreId } = await unExamen()

    await repo.registrarAciertos(criterioTrimestreId, 'alumno-1', 'lenguajes', 18)
    await repo.registrarAciertos(
      criterioTrimestreId,
      'alumno-1',
      'saberes_pensamiento_cientifico',
      12,
    )

    const resultados = await repo.resultadosDeExamen(criterioTrimestreId)
    expect(resultados).toHaveLength(1)
    expect(resultados[0]?.aciertos).toEqual({
      lenguajes: 18,
      saberes_pensamiento_cientifico: 12,
    })
  })

  it('es upsert por [criterio_trimestre_id+alumno_id]', async () => {
    const { criterioTrimestreId } = await unExamen()

    await repo.registrarAciertos(criterioTrimestreId, 'alumno-1', 'lenguajes', 1)
    await repo.registrarAciertos(criterioTrimestreId, 'alumno-1', 'lenguajes', 12)

    const resultados = await repo.resultadosDeExamen(criterioTrimestreId)
    expect(resultados).toHaveLength(1)
    expect(resultados[0]?.aciertos).toEqual({ lenguajes: 12 })
  })

  it('cero aciertos es un dato guardado, no un borrado', async () => {
    const { criterioTrimestreId } = await unExamen()

    await repo.registrarAciertos(criterioTrimestreId, 'alumno-1', 'lenguajes', 0)

    expect((await repo.resultadosDeExamen(criterioTrimestreId))[0]?.aciertos).toEqual({
      lenguajes: 0,
    })
  })

  it('null borra ese campo y deja los demás', async () => {
    const { criterioTrimestreId } = await unExamen()
    await repo.registrarAciertos(criterioTrimestreId, 'alumno-1', 'lenguajes', 8)
    await repo.registrarAciertos(criterioTrimestreId, 'alumno-1', 'humano_comunitario', 5)

    await repo.registrarAciertos(criterioTrimestreId, 'alumno-1', 'lenguajes', null)

    expect((await repo.resultadosDeExamen(criterioTrimestreId))[0]?.aciertos).toEqual({
      humano_comunitario: 5,
    })
  })

  it('el mismo alumno en otro examen es otro registro', async () => {
    const [t1] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Examen escrito', 'examen', SIN_PARAMETROS)
    await repo.agregarCriterio(t1!.id, 'Examen oral', 'examen', SIN_PARAMETROS)
    const [uno, otro] = await repo.examenesDeTrimestre(t1!.id)

    await repo.registrarAciertos(uno!.ponderado.id, 'alumno-1', 'lenguajes', 3)
    await repo.registrarAciertos(otro!.ponderado.id, 'alumno-1', 'lenguajes', 7)

    expect((await repo.resultadosDeExamen(uno!.ponderado.id))[0]?.aciertos).toEqual({
      lenguajes: 3,
    })
    expect((await repo.resultadosDeExamen(otro!.ponderado.id))[0]?.aciertos).toEqual({
      lenguajes: 7,
    })
  })

  it('revive un registro borrado en vez de crear uno nuevo', async () => {
    const { criterioTrimestreId } = await unExamen()
    await repo.registrarAciertos(criterioTrimestreId, 'alumno-1', 'lenguajes', 8)
    const primero = (await repo.resultadosDeExamen(criterioTrimestreId))[0]!
    await db.resultados_examen.update(primero.id, { deleted_at: '2026-11-02T00:00:00.000Z' })

    await repo.registrarAciertos(criterioTrimestreId, 'alumno-1', 'lenguajes', 9)

    const resultados = await repo.resultadosDeExamen(criterioTrimestreId)
    expect(resultados).toHaveLength(1)
    expect(resultados[0]?.id).toBe(primero.id)
  })

  it('encola un pendiente por captura', async () => {
    const { criterioTrimestreId } = await unExamen()
    await db.outbox.clear()

    await repo.registrarAciertos(criterioTrimestreId, 'alumno-1', 'lenguajes', 8)

    const pendientes = await db.outbox.toArray()
    expect(pendientes).toHaveLength(1)
    expect(pendientes[0]?.tabla).toBe('resultados_examen')
    expect(pendientes[0]?.op).toBe('upsert')
  })
})

describe('capturasDelTrimestre y los criterios automáticos', () => {
  const base = { updated_at: '2026-09-01T00:00:00.000Z', deleted_at: null }

  it('trae asistencia, bitácora y participaciones recortadas al trimestre', async () => {
    // La atribución al trimestre se deriva de la fecha: T1 va del 2026-08-24 al
    // 2026-11-27, así que lo de agosto 23 y lo de diciembre quedan fuera.
    const [t1] = await conCiclo()

    await db.asistencia.bulkPut([
      { id: 'a-fuera', ...base, alumno_id: 'alumno-1', fecha: '2026-08-23', estado: 'ausente' },
      { id: 'a-dentro', ...base, alumno_id: 'alumno-1', fecha: '2026-09-01', estado: 'ausente' },
      { id: 'a-despues', ...base, alumno_id: 'alumno-1', fecha: '2026-12-01', estado: 'ausente' },
    ])
    await db.bitacora.bulkPut([
      { id: 'r-dentro', ...base, alumno_id: 'alumno-1', fecha: '2026-09-02', texto: 'Algo' },
      { id: 'r-fuera', ...base, alumno_id: 'alumno-1', fecha: '2026-12-02', texto: 'Algo' },
    ])
    await db.participaciones.bulkPut([
      { id: 'p-dentro', ...base, alumno_id: 'alumno-1', fecha: '2026-09-03', cantidad: 2 },
      { id: 'p-fuera', ...base, alumno_id: 'alumno-1', fecha: '2026-08-01', cantidad: 9 },
    ])

    const capturas = (await repo.capturasDelTrimestre(t1!.id))!
    expect(capturas.asistencia.map((r) => r.id)).toEqual(['a-dentro'])
    expect(capturas.reportes.map((r) => r.id)).toEqual(['r-dentro'])
    expect(capturas.participaciones.map((p) => p.id)).toEqual(['p-dentro'])
  })

  it('no trae los borrados', async () => {
    const [t1] = await conCiclo()
    await db.bitacora.put({
      id: 'r-borrado',
      ...base,
      deleted_at: '2026-09-03T00:00:00.000Z',
      alumno_id: 'alumno-1',
      fecha: '2026-09-02',
      texto: 'Se quitó',
    })

    const capturas = (await repo.capturasDelTrimestre(t1!.id))!
    expect(capturas.reportes).toHaveLength(0)
  })

  it('ajustar las fechas del trimestre cambia lo que entra, sin migrar nada', async () => {
    // Es lo que permite abrir el ciclo con un solo trimestre (D-017): lo capturado
    // antes queda atribuido en cuanto el rango lo contiene.
    const [t1] = await conCiclo()
    await db.participaciones.put({
      id: 'p-agosto',
      ...base,
      alumno_id: 'alumno-1',
      fecha: '2026-08-10',
      cantidad: 3,
    })

    expect((await repo.capturasDelTrimestre(t1!.id))!.participaciones).toHaveLength(0)

    await repo.ajustarFechas(t1!.id, '2026-08-01', '2026-11-27')

    expect((await repo.capturasDelTrimestre(t1!.id))!.participaciones).toHaveLength(1)
  })
})
