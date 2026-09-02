// IndexedDB no existe en node: fake-indexeddb la provee en memoria.
import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { aDatosAlumno, normalizarExtraccion } from '@/application/importacion'
import { interpretarHoja } from '@/application/hoja'
import type { Alumno } from '@/domain/entities'

import { DexieAlumnosRepo } from './alumnos.adapter'
import { db, TABLAS_SINCRONIZABLES } from './db'
import { DexieSincroniaRepo } from './sincronia.adapter'

/**
 * La lista de ida y vuelta: de la hoja a lo que sale hacia la nube.
 *
 * Las piezas están probadas una por una, pero lo que se rompe en silencio es la
 * costura: un campo que `revalidar` no reconstruye, o que `sembrar` no compara,
 * pasa todas las pruebas de su archivo y llega vacío al servidor. Esto recorre
 * el camino entero una vez, que es lo que ninguna prueba hacía.
 */

const alumnos = new DexieAlumnosRepo()
const sincronia = new DexieSincroniaRepo()

/** La forma de la lista de Control Escolar: `No | MATRÍCULA | C U R P | NOMBRE`. */
const HOJA: string[][] = [
  ['ESC. PRIM. "LA ESCUELA" T.M'],
  ['No.', 'MATRICULA', 'C U R P', 'NOMBRE DEL ALUMNO'],
  ['1', '11934091', 'AUVG160520HNLRLRA3', 'ARGUELLES VILLANUEVA GERONIMO ALEJANDRO'],
  ['2', '12938032', 'BAHJ160622MVZTRHA0', 'BAUTISTA HERNANDEZ JHANNA NOEMI'],
]

beforeEach(async () => {
  await db.open()
  for (const tabla of TABLAS_SINCRONIZABLES) await db.table(tabla).clear()
  await db.outbox.clear()
})

describe('de la hoja a la nube', () => {
  async function cargar() {
    const leidos = interpretarHoja(HOJA)
    await alumnos.sembrar(aDatosAlumno(normalizarExtraccion(leidos ?? [])))
    return alumnos.lista()
  }

  it('el CURP y el sexo llegan a la base, y el sexo sale del CURP', () => {
    return cargar().then((lista) => {
      expect(lista.map((a) => a.curp)).toEqual([
        'AUVG160520HNLRLRA3',
        'BAHJ160622MVZTRHA0',
      ])
      expect(lista.map((a) => a.sexo)).toEqual(['H', 'M'])
    })
  })

  it('el CURP parte el nombre, que es lo que la hoja no separó', () => {
    return cargar().then((lista) => {
      expect(lista[0]?.nombre).toBe('Arguelles Villanueva, Geronimo Alejandro')
    })
  })

  it('y viajan enteros en lo que sube el motor de sincronía', async () => {
    await cargar()

    const lote = await sincronia.lotePorSubir(10)
    const filas = (lote.filas['alumnos'] ?? []) as Alumno[]

    expect(filas).toHaveLength(2)
    expect(filas.map((f) => f.curp)).toEqual(['AUVG160520HNLRLRA3', 'BAHJ160622MVZTRHA0'])
    expect(filas.map((f) => f.sexo)).toEqual(['H', 'M'])
    // Todas con la clave puesta, aunque valga `null`: PostgREST arma el upsert
    // con las columnas que le llegan, y un lote con filas de claves distintas
    // no se comporta igual fila a fila.
    for (const fila of filas) expect('sexo' in fila).toBe(true)
  })

  it('recargar la misma hoja no reescribe ni encola de nuevo', async () => {
    await cargar()
    const pendientes = await sincronia.cuantosPendientes()

    await cargar()

    expect(await sincronia.cuantosPendientes()).toBe(pendientes)
  })
})
