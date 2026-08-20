// IndexedDB no existe en node: fake-indexeddb la provee en memoria. Cada corrida
// arranca con una base vacía.
import 'fake-indexeddb/auto'

import { afterAll, describe, expect, it } from 'vitest'

import { ahora, db, TABLAS_SINCRONIZABLES } from './db'

const TABLAS_DE_DOMINIO = TABLAS_SINCRONIZABLES

afterAll(() => {
  db.close()
})

describe('esquema de la base', () => {
  it('abre y tiene las tablas sincronizables más la outbox', async () => {
    await db.open()
    expect(db.name).toBe('palomita')
    expect(db.tables.map((t) => t.name).sort()).toEqual(
      [...TABLAS_DE_DOMINIO, 'outbox'].sort(),
    )
  })

  it('ya no existe la tabla calificaciones del prototipo', async () => {
    await db.open()
    // La escala 5-10 no existe en el modelo nuevo (docs/DECISIONES.md D-015).
    expect(db.tables.map((t) => t.name)).not.toContain('calificaciones')
  })

  it('asistencia tiene el índice compuesto [fecha+alumno_id]', async () => {
    await db.open()
    const compuestos = db.asistencia.schema.indexes
      .filter((i) => i.compound)
      .map((i) => i.name)
    // Es el índice que sostiene la pantalla principal: un registro por alumno
    // por día, y upsert directo sin recorrer la tabla.
    expect(compuestos).toContain('[fecha+alumno_id]')
  })

  it('la captura de evaluación tiene su índice compuesto, como asistencia', async () => {
    await db.open()
    const compuestos = (tabla: string) =>
      db
        .table(tabla)
        .schema.indexes.filter((i) => i.compound)
        .map((i) => i.name)

    // Un registro por alumno por actividad, y upsert directo sin recorrer la
    // tabla. Es lo que hace [fecha+alumno_id] en asistencia.
    expect(compuestos('entregas')).toContain('[actividad_id+alumno_id]')
    expect(compuestos('eval_rubrica')).toContain('[actividad_id+alumno_id]')
    expect(compuestos('resultados_examen')).toContain('[criterio_trimestre_id+alumno_id]')
    expect(compuestos('cierres')).toContain('[trimestre_id+alumno_id]')
  })

  it('actividades cuelga de criterio_trimestre_id, no de un criterio global', async () => {
    await db.open()
    const indices = db.actividades.schema.indexes.map((i) => i.name)
    // Es lo que hace que un trimestre nuevo nazca con cero actividades sin
    // borrar ni filtrar nada por fecha (docs/DECISIONES.md D-015).
    expect(indices).toContain('criterio_trimestre_id')
  })

  it('toda tabla de dominio indexa deleted_at para el filtro de borrados', async () => {
    await db.open()
    for (const nombre of TABLAS_DE_DOMINIO) {
      const indices = db.table(nombre).schema.indexes.map((i) => i.name)
      expect(indices, nombre).toContain('deleted_at')
    }
  })
})

describe('claves primarias', () => {
  it('ninguna tabla de dominio usa clave autoincremental', async () => {
    await db.open()
    for (const nombre of TABLAS_DE_DOMINIO) {
      const primaria = db.table(nombre).schema.primKey
      // Con enteros locales, dos dispositivos generan el mismo id: 1 y el
      // respaldo se corrompe al restaurar (docs/DATA-MODEL.md).
      expect(primaria.auto, nombre).toBe(false)
      expect(primaria.keyPath, nombre).toBe('id')
    }
  })

  it('outbox usa ++seq: es local, efímera y nunca se sincroniza como contenido', async () => {
    await db.open()
    const primaria = db.outbox.schema.primKey
    expect(primaria.keyPath).toBe('seq')
    expect(primaria.auto).toBe(true)
  })

  it('la secuencia del outbox avanza sola', async () => {
    await db.open()
    await db.outbox.clear()
    const primero = await db.outbox.add({
      tabla: 'asistencia',
      registro_id: 'alumno-1',
      op: 'upsert',
      at: ahora(),
    })
    const segundo = await db.outbox.add({
      tabla: 'asistencia',
      registro_id: 'alumno-2',
      op: 'upsert',
      at: ahora(),
    })
    expect(Number(segundo)).toBe(Number(primero) + 1)
    await db.outbox.clear()
  })
})

describe('ahora()', () => {
  it('devuelve ISO 8601 en UTC', () => {
    expect(ahora()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('es canónico: reparsearlo devuelve la misma cadena', () => {
    // El iPad está en horario de México; updated_at tiene que ser comparable
    // entre dispositivos, así que termina en Z y no en -06:00.
    const t = ahora()
    expect(t.endsWith('Z')).toBe(true)
    expect(new Date(t).toISOString()).toBe(t)
  })
})
