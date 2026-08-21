// IndexedDB no existe en node: fake-indexeddb la provee en memoria. Este archivo
// necesita su propia base, así que va aparte de db.test.ts.
import 'fake-indexeddb/auto'

import Dexie from 'dexie'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { db } from './db'

/**
 * Las migraciones corren sobre el iPad con los datos reales del salón, y no hay
 * forma de probarlas ahí sin arriesgar el ciclo escolar: aquí se levanta una base
 * en el estado exacto que tiene el dispositivo —esquema viejo, asistencia
 * capturada— y se abre con el esquema nuevo.
 *
 * Se prueba el salto completo, `version(1)` → `version(3)`, y no cada versión por
 * separado: es exactamente lo que le va a pasar al dispositivo, que se quedó en
 * la versión desplegada y va a subir de un jalón.
 *
 * Lo que se verifica no es que la migración "funcione": es que **no pierda un
 * solo registro**. Ni de asistencia, que es el dato que no se puede reconstruir,
 * ni de la bitácora, que cambió de tabla.
 */

const ESQUEMA_V1 = {
  alumnos: 'id, numero_lista, deleted_at',
  asistencia: 'id, fecha, alumno_id, [fecha+alumno_id], deleted_at',
  actividades: 'id, fecha, campo, deleted_at',
  calificaciones: 'id, actividad_id, alumno_id, [actividad_id+alumno_id], deleted_at',
  notas: 'id, alumno_id, fecha, deleted_at',
  outbox: '++seq, tabla, registro_id',
}

const DIAS = ['2026-08-17', '2026-08-18', '2026-08-19']
const ALUMNOS = 30

beforeAll(async () => {
  // El dispositivo tal como está hoy: esquema viejo con un mes de captura.
  const vieja = new Dexie('palomita')
  vieja.version(1).stores(ESQUEMA_V1)
  await vieja.open()

  await vieja.table('alumnos').bulkAdd(
    Array.from({ length: ALUMNOS }, (_, i) => ({
      id: `alumno-${i + 1}`,
      updated_at: '2026-08-17T00:00:00.000Z',
      deleted_at: null,
      nombre: `Apellido${i + 1}, Nombre`,
      numero_lista: i + 1,
      fecha_nacimiento: null,
    })),
  )

  await vieja.table('asistencia').bulkAdd(
    DIAS.flatMap((fecha) =>
      Array.from({ length: ALUMNOS }, (_, i) => ({
        id: `${fecha}-alumno-${i + 1}`,
        updated_at: `${fecha}T14:00:00.000Z`,
        deleted_at: null,
        alumno_id: `alumno-${i + 1}`,
        fecha,
        estado: i === 0 ? 'ausente' : 'presente',
      })),
    ),
  )

  await vieja.table('notas').add({
    id: 'nota-1',
    updated_at: '2026-08-18T00:00:00.000Z',
    deleted_at: null,
    alumno_id: 'alumno-3',
    fecha: '2026-08-18',
    texto: 'Se quedó a ayudar a acomodar las sillas',
  })

  vieja.close()

  // Y ahora la app nueva abre la misma base.
  await db.open()
})

afterAll(() => {
  db.close()
})

describe('version(1) → version(3)', () => {
  it('sube a la versión 3', () => {
    expect(db.verno).toBe(3)
  })

  it('no pierde un solo registro de asistencia', async () => {
    expect(await db.asistencia.count()).toBe(DIAS.length * ALUMNOS)
  })

  it('conserva los estados capturados, no solo el conteo', async () => {
    const registros = await db.asistencia.where('fecha').equals('2026-08-18').toArray()
    const ausentes = registros.filter((r) => r.estado === 'ausente')
    expect(ausentes).toHaveLength(1)
    expect(ausentes[0]?.alumno_id).toBe('alumno-1')
  })

  it('conserva a los alumnos', async () => {
    expect(await db.alumnos.count()).toBe(ALUMNOS)
    // El id se conserva: de él cuelga toda la asistencia del alumno.
    expect((await db.alumnos.get('alumno-1'))?.numero_lista).toBe(1)
  })

  it('mueve las notas a bitacora sin perder ninguna', async () => {
    // La tabla estaba vacía en el iPad —nunca tuvo pantalla— pero la migración
    // no da eso por hecho: si hay filas, se mudan con su id y su texto.
    expect(await db.bitacora.count()).toBe(1)
    const reporte = await db.bitacora.get('nota-1')
    expect(reporte?.alumno_id).toBe('alumno-3')
    expect(reporte?.texto).toBe('Se quedó a ayudar a acomodar las sillas')
  })

  it('elimina la tabla notas', () => {
    expect(db.tables.map((t) => t.name)).not.toContain('notas')
  })

  it('deja lista la tabla de participaciones, vacía', async () => {
    // Entra con la bitácora aunque se use en C25: la migración del dispositivo
    // se hace una vez.
    expect(await db.participaciones.count()).toBe(0)
    const compuestos = db.participaciones.schema.indexes
      .filter((i) => i.compound)
      .map((i) => i.name)
    expect(compuestos).toContain('[fecha+alumno_id]')
  })

  it('elimina la tabla calificaciones del prototipo', () => {
    expect(db.tables.map((t) => t.name)).not.toContain('calificaciones')
  })

  it('deja listas las tablas de evaluación, vacías', async () => {
    for (const tabla of [
      'ciclos',
      'trimestres',
      'criterios',
      'criterios_trimestre',
      'rubricas',
      'rubrica_criterios',
      'actividades',
      'entregas',
      'eval_rubrica',
      'examen_config',
      'resultados_examen',
      'cierres',
    ]) {
      expect(await db.table(tabla).count(), tabla).toBe(0)
    }
  })

  it('la app sigue escribiendo asistencia después de migrar', async () => {
    // Que la base abra no basta: el índice compuesto tiene que seguir sirviendo
    // para el upsert de la pantalla principal.
    await db.asistencia.put({
      id: '2026-08-19-alumno-2',
      updated_at: '2026-08-19T15:00:00.000Z',
      deleted_at: null,
      alumno_id: 'alumno-2',
      fecha: '2026-08-19',
      estado: 'retardo',
    })

    const clave = await db.asistencia.where('[fecha+alumno_id]').equals(['2026-08-19', 'alumno-2']).toArray()
    expect(clave).toHaveLength(1)
    expect(clave[0]?.estado).toBe('retardo')
    // Upsert, no inserción: el total no cambió.
    expect(await db.asistencia.count()).toBe(DIAS.length * ALUMNOS)
  })
})
