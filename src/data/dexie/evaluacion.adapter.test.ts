import 'fake-indexeddb/auto'

import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from './db'
import { DexieEvaluacionRepo } from './evaluacion.adapter'

const repo = new DexieEvaluacionRepo()

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
  await db.outbox.clear()
})

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
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable')

    const esquema = await repo.esquemaDeTrimestre(t1!.id)
    expect(esquema?.criterios).toHaveLength(1)
    expect(esquema?.criterios[0]?.criterio.nombre).toBe('Tareas')
    expect(esquema?.criterios[0]?.criterio.tipo).toBe('entregable')
    expect(esquema?.criterios[0]?.ponderado.peso).toBe(0)
  })

  it('respeta el orden de alta', async () => {
    const [t1] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable')
    await repo.agregarCriterio(t1!.id, 'Examen', 'examen')
    await repo.agregarCriterio(t1!.id, 'Portafolio', 'entregable')

    const esquema = await repo.esquemaDeTrimestre(t1!.id)
    expect(esquema?.criterios.map((c) => c.criterio.nombre)).toEqual([
      'Tareas',
      'Examen',
      'Portafolio',
    ])
  })

  it('no devuelve los criterios quitados', async () => {
    const [t1] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable')
    await repo.agregarCriterio(t1!.id, 'Examen', 'examen')
    const esquema = await repo.esquemaDeTrimestre(t1!.id)

    await repo.quitarCriterio(esquema!.criterios[0]!.ponderado.id)

    const despues = await repo.esquemaDeTrimestre(t1!.id)
    expect(despues?.criterios.map((c) => c.criterio.nombre)).toEqual(['Examen'])
  })
})

describe('agregarCriterio', () => {
  it('el peso nace en 0: no se adivina el reparto', async () => {
    const [t1] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable')
    const esquema = await repo.esquemaDeTrimestre(t1!.id)
    expect(esquema?.criterios[0]?.ponderado.peso).toBe(0)
  })

  it('reutiliza la entrada del catálogo entre trimestres', async () => {
    const [t1, t2] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable')
    await repo.agregarCriterio(t2!.id, 'Tareas', 'entregable')

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
    await repo.agregarCriterio(t1!.id, 'Exámen', 'examen')
    await repo.agregarCriterio(t2!.id, 'EXAMEN', 'examen')
    expect(await db.criterios.count()).toBe(1)
  })

  it('el mismo nombre con otro tipo es otro criterio', async () => {
    const [t1] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Proyecto', 'entregable')
    await repo.agregarCriterio(t1!.id, 'Proyecto', 'examen')
    expect(await db.criterios.count()).toBe(2)
  })

  it('agregar dos veces el mismo criterio al mismo trimestre no lo duplica', async () => {
    const [t1] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable')
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable')

    const esquema = await repo.esquemaDeTrimestre(t1!.id)
    expect(esquema?.criterios).toHaveLength(1)
  })

  it('encola el criterio y su fila del trimestre', async () => {
    const [t1] = await conCiclo()
    await db.outbox.clear()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable')

    const pendientes = await db.outbox.toArray()
    expect(pendientes.filter((c) => c.tabla === 'criterios')).toHaveLength(1)
    expect(pendientes.filter((c) => c.tabla === 'criterios_trimestre')).toHaveLength(1)
  })
})

describe('ajustarPeso', () => {
  it('deja el peso y refresca updated_at', async () => {
    const [t1] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable')
    const antes = (await repo.esquemaDeTrimestre(t1!.id))!.criterios[0]!.ponderado

    await repo.ajustarPeso(antes.id, 40)

    const despues = (await repo.esquemaDeTrimestre(t1!.id))!.criterios[0]!.ponderado
    expect(despues.peso).toBe(40)
    expect(despues.updated_at >= antes.updated_at).toBe(true)
  })

  it('cambiar un peso en T2 no altera la fila de T1', async () => {
    const [t1, t2] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable')
    await repo.agregarCriterio(t2!.id, 'Tareas', 'entregable')
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
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable')
    const ponderado = (await repo.esquemaDeTrimestre(t1!.id))!.criterios[0]!.ponderado

    await repo.quitarCriterio(ponderado.id)

    expect((await db.criterios_trimestre.get(ponderado.id))?.deleted_at).not.toBeNull()
    // El catálogo se queda: otros trimestres lo comparten.
    expect(await db.criterios.count()).toBe(1)
  })

  it('encola un delete, no un upsert', async () => {
    const [t1] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable')
    const ponderado = (await repo.esquemaDeTrimestre(t1!.id))!.criterios[0]!.ponderado
    await db.outbox.clear()

    await repo.quitarCriterio(ponderado.id)

    expect((await db.outbox.toArray())[0]?.op).toBe('delete')
  })

  it('quitar algo que no existe no falla', async () => {
    await expect(repo.quitarCriterio('no-existe')).resolves.toBeUndefined()
  })
})

describe('copiarEsquema', () => {
  it('trae criterios y pesos', async () => {
    const [t1, t2] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable')
    await repo.agregarCriterio(t1!.id, 'Examen', 'examen')
    const origen = (await repo.esquemaDeTrimestre(t1!.id))!.criterios
    await repo.ajustarPeso(origen[0]!.ponderado.id, 60)
    await repo.ajustarPeso(origen[1]!.ponderado.id, 40)

    await repo.copiarEsquema(t1!.id, t2!.id)

    const copia = (await repo.esquemaDeTrimestre(t2!.id))!.criterios
    expect(copia.map((c) => c.criterio.nombre)).toEqual(['Tareas', 'Examen'])
    expect(copia.map((c) => c.ponderado.peso)).toEqual([60, 40])
  })

  it('trae la rúbrica y la meta de participación', async () => {
    const [t1, t2] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable')
    const origen = (await repo.esquemaDeTrimestre(t1!.id))!.criterios[0]!.ponderado
    await db.criterios_trimestre.update(origen.id, {
      rubrica_id: 'rubrica-1',
      meta_participacion: 10,
    })

    await repo.copiarEsquema(t1!.id, t2!.id)

    const copia = (await repo.esquemaDeTrimestre(t2!.id))!.criterios[0]!.ponderado
    expect(copia.rubrica_id).toBe('rubrica-1')
    expect(copia.meta_participacion).toBe(10)
  })

  it('son filas nuevas, no las mismas', async () => {
    const [t1, t2] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable')
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
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable')
    const origen = (await repo.esquemaDeTrimestre(t1!.id))!.criterios[0]!.ponderado
    await repo.ajustarPeso(origen.id, 60)
    await repo.copiarEsquema(t1!.id, t2!.id)
    const copia = (await repo.esquemaDeTrimestre(t2!.id))!.criterios[0]!.ponderado

    await repo.ajustarPeso(copia.id, 25)

    expect((await db.criterios_trimestre.get(origen.id))?.peso).toBe(60)
  })

  it('no copia actividades ni calificaciones', async () => {
    const [t1, t2] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable')
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
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable')
    await repo.agregarCriterio(t1!.id, 'Examen', 'examen')
    await repo.agregarCriterio(t2!.id, 'Tareas', 'entregable')

    await repo.copiarEsquema(t1!.id, t2!.id)

    const copia = (await repo.esquemaDeTrimestre(t2!.id))!.criterios
    expect(copia.map((c) => c.criterio.nombre)).toEqual(['Tareas', 'Examen'])
  })

  it('copiar dos veces no duplica', async () => {
    const [t1, t2] = await conCiclo()
    await repo.agregarCriterio(t1!.id, 'Tareas', 'entregable')

    await repo.copiarEsquema(t1!.id, t2!.id)
    await repo.copiarEsquema(t1!.id, t2!.id)

    expect((await repo.esquemaDeTrimestre(t2!.id))!.criterios).toHaveLength(1)
  })
})
