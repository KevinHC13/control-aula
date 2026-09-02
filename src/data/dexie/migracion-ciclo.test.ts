// IndexedDB no existe en node: fake-indexeddb la provee en memoria. Como
// migracion.test.ts, este archivo necesita su propia base y va aparte.
import 'fake-indexeddb/auto'

import Dexie from 'dexie'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { db } from './db'

/**
 * El caso real del dispositivo al subir a `version(4)`: un iPad con el ciclo
 * escolar ya configurado y el grupo cargado.
 *
 * `migracion.test.ts` cubre el salto completo desde el prototipo, donde no hay
 * ciclos y los alumnos quedan en `null`. Aquí se prueba lo contrario y es lo que
 * de verdad va a pasar: hay **un** ciclo, así que los alumnos son suyos y la
 * lista diaria tiene que seguir enseñando exactamente a los mismos.
 *
 * Sin esto, la migración dejaría a los treinta alumnos fuera del ciclo abierto y
 * la pantalla de asistencia amanecería vacía con los datos intactos debajo —el
 * peor de los fallos posibles: parece pérdida total y no lo es—.
 */

const ESQUEMA_V3 = {
  alumnos: 'id, numero_lista, deleted_at',
  asistencia: 'id, fecha, alumno_id, [fecha+alumno_id], deleted_at',
  bitacora: 'id, alumno_id, fecha, deleted_at',
  participaciones: 'id, fecha, alumno_id, [fecha+alumno_id], deleted_at',
  ciclos: 'id, estado, deleted_at',
  trimestres: 'id, ciclo_id, numero, inicio, fin, estado, deleted_at',
  criterios: 'id, tipo, deleted_at',
  criterios_trimestre: 'id, trimestre_id, criterio_id, [trimestre_id+orden], deleted_at',
  rubricas: 'id, deleted_at',
  rubrica_criterios: 'id, rubrica_id, [rubrica_id+orden], deleted_at',
  actividades: 'id, criterio_trimestre_id, campo, fecha, deleted_at',
  entregas: 'id, actividad_id, alumno_id, [actividad_id+alumno_id], deleted_at',
  eval_rubrica: 'id, actividad_id, alumno_id, [actividad_id+alumno_id], deleted_at',
  examen_config: 'id, criterio_trimestre_id, deleted_at',
  resultados_examen:
    'id, criterio_trimestre_id, alumno_id, [criterio_trimestre_id+alumno_id], deleted_at',
  cierres: 'id, trimestre_id, alumno_id, [trimestre_id+alumno_id], deleted_at',
  outbox: '++seq, tabla, registro_id',
}

const ALUMNOS = 30
const CICLO = 'ciclo-2026-2027'

beforeAll(async () => {
  const vieja = new Dexie('palomita')
  // Las tres versiones anteriores se declaran para que Dexie llegue a la 3 con
  // el mismo camino que tuvo el dispositivo.
  vieja.version(3).stores(ESQUEMA_V3)
  await vieja.open()

  await vieja.table('ciclos').add({
    id: CICLO,
    nombre: '2026–2027',
    estado: 'abierto',
    updated_at: '2026-08-17T00:00:00.000Z',
    deleted_at: null,
  })

  await vieja.table('alumnos').bulkAdd(
    Array.from({ length: ALUMNOS }, (_, i) => ({
      id: `alumno-${i + 1}`,
      updated_at: '2026-08-17T00:00:00.000Z',
      deleted_at: null,
      nombre: `Apellido${i + 1}, Nombre`,
      numero_lista: i + 1,
      fecha_nacimiento: null,
      curp: null,
      sexo: null,
    })),
  )

  vieja.close()

  await db.open()
})

afterAll(() => {
  db.close()
})

describe('version(3) → version(4) con el ciclo ya configurado', () => {
  it('sube a la versión 4', () => {
    expect(db.verno).toBe(4)
  })

  it('asigna todos los alumnos al único ciclo que hay', async () => {
    const alumnos = await db.alumnos.toArray()
    expect(alumnos).toHaveLength(ALUMNOS)
    expect(alumnos.every((a) => a.ciclo_id === CICLO)).toBe(true)
  })

  it('conserva los ids: de ellos cuelgan asistencia y calificaciones', async () => {
    const primero = await db.alumnos.get('alumno-1')
    expect(primero?.numero_lista).toBe(1)
    expect(primero?.nombre).toBe('Apellido1, Nombre')
  })

  it('no toca el ciclo ni lo duplica', async () => {
    expect(await db.ciclos.count()).toBe(1)
    expect((await db.ciclos.get(CICLO))?.estado).toBe('abierto')
  })
})
