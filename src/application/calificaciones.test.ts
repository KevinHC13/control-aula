// IndexedDB no existe en node: fake-indexeddb la provee en memoria.
import 'fake-indexeddb/auto'

import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from '@/data/dexie/db'
import type { CapturasDelTrimestre, CriterioDelTrimestre } from '@/data/ports/evaluacion'
import { comoCalificacion } from '@/domain/calculo'
import type { Alumno, CierreTrimestre, TipoCriterio, Trimestre } from '@/domain/entities'
import type { CampoFormativo, EstadoAsistencia, Id, Nivel } from '@/domain/values'

import {
  armarReporte,
  cerrarTrimestre,
  reabrirTrimestre,
  reporteDeCapturas,
  reporteDeCierres,
  reporteDeTrimestre,
  sinCalificacion,
  snapshotsDe,
} from './calificaciones'

const base = { updated_at: '2026-11-01T00:00:00.000Z', deleted_at: null }

const trimestre: Trimestre = {
  id: 'trimestre-1',
  ...base,
  ciclo_id: 'ciclo-1',
  numero: 1,
  inicio: '2026-08-24',
  fin: '2026-11-27',
  estado: 'abierto',
  cerrado_en: null,
}

const alumno = (i: number): Alumno => ({
  id: `alumno-${i}`,
  ...base,
  nombre: `Apellido${i}, Nombre`,
  ciclo_id: null,
  numero_lista: i,
  fecha_nacimiento: null,
  curp: null,
})

const DOS = [alumno(1), alumno(2)]

function criterio(
  id: Id,
  nombre: string,
  peso: number,
  tipo: TipoCriterio = 'entregable',
): CriterioDelTrimestre {
  return {
    ponderado: {
      id,
      ...base,
      trimestre_id: trimestre.id,
      criterio_id: `cat-${id}`,
      peso,
      orden: 0,
      meta_participacion: null,
      retardos_por_falta: null,
    },
    criterio: { id: `cat-${id}`, ...base, nombre, tipo },
  }
}

function actividad(id: Id, criterioTrimestreId: Id, campo: CampoFormativo, rubricaId: Id | null) {
  return {
    id,
    ...base,
    criterio_trimestre_id: criterioTrimestreId,
    nombre: id,
    campo,
    ejes: [] as string[],
    fecha: '2026-09-01',
    rubrica_id: rubricaId,
  }
}

const entrega = (actividadId: Id, alumnoId: Id, entregada: boolean) => ({
  id: `entrega-${actividadId}-${alumnoId}`,
  ...base,
  actividad_id: actividadId,
  alumno_id: alumnoId,
  entregada,
})

const evaluacion = (actividadId: Id, alumnoId: Id, niveles: Record<Id, Nivel>) => ({
  id: `eval-${actividadId}-${alumnoId}`,
  ...base,
  actividad_id: actividadId,
  alumno_id: alumnoId,
  niveles,
})

/** Unas capturas mínimas, con lo que cada prueba le pase encima. */
function capturas(cambios: Partial<CapturasDelTrimestre> = {}): CapturasDelTrimestre {
  return {
    trimestre,
    criterios: [],
    actividades: [],
    renglonesPorRubrica: {},
    entregas: [],
    evaluaciones: [],
    configuraciones: [],
    resultados: [],
    asistencia: [],
    reportes: [],
    participaciones: [],
    ...cambios,
  }
}

beforeEach(async () => {
  await db.open()
  await db.alumnos.clear()
  await db.trimestres.clear()
  await db.criterios.clear()
  await db.criterios_trimestre.clear()
  await db.actividades.clear()
  await db.entregas.clear()
  await db.eval_rubrica.clear()
  await db.examen_config.clear()
  await db.resultados_examen.clear()
  await db.cierres.clear()
  await db.outbox.clear()
})

afterAll(() => {
  db.close()
})

describe('reporteDeCapturas', () => {
  it('promedia las actividades del criterio y pondera el trimestre', () => {
    const tareas = criterio('ct-tareas', 'Tareas', 100)
    const datos = capturas({
      criterios: [tareas],
      actividades: [
        actividad('a1', 'ct-tareas', 'lenguajes', null),
        actividad('a2', 'ct-tareas', 'lenguajes', null),
      ],
      entregas: [
        entrega('a1', 'alumno-1', true),
        entrega('a2', 'alumno-1', false),
        entrega('a1', 'alumno-2', true),
        entrega('a2', 'alumno-2', true),
      ],
    })

    const [uno, dos] = reporteDeCapturas(datos, DOS)
    expect(comoCalificacion(uno!.general)).toBe('5.0')
    expect(comoCalificacion(dos!.general)).toBe('10.0')
    expect(uno!.pesoConsiderado).toBe(100)
  })

  it('un alumno sin registro queda excluido de esa actividad, no en cero', () => {
    const datos = capturas({
      criterios: [criterio('ct-tareas', 'Tareas', 100)],
      actividades: [
        actividad('a1', 'ct-tareas', 'lenguajes', null),
        actividad('a2', 'ct-tareas', 'lenguajes', null),
      ],
      // El alumno 2 se dio de alta después de la primera actividad.
      entregas: [
        entrega('a1', 'alumno-1', true),
        entrega('a2', 'alumno-1', false),
        entrega('a2', 'alumno-2', true),
      ],
    })

    const [, dos] = reporteDeCapturas(datos, DOS)
    expect(comoCalificacion(dos!.general)).toBe('10.0')
  })

  it('una captura de rúbrica a medias no califica esa actividad', () => {
    const datos = capturas({
      criterios: [criterio('ct-proyectos', 'Proyectos', 100)],
      actividades: [actividad('a1', 'ct-proyectos', 'saberes_pensamiento_cientifico', 'r1')],
      renglonesPorRubrica: { r1: ['r1c1', 'r1c2'] },
      evaluaciones: [
        evaluacion('a1', 'alumno-1', { r1c1: 0, r1c2: 0 }),
        evaluacion('a1', 'alumno-2', { r1c1: 0 }),
      ],
    })

    const [uno, dos] = reporteDeCapturas(datos, DOS)
    expect(comoCalificacion(uno!.general)).toBe('10.0')
    expect(dos!.general).toBeNull()
    expect(dos!.pesoConsiderado).toBe(0)
  })

  it('el examen usa aciertos totales sobre preguntas totales', () => {
    const datos = capturas({
      criterios: [criterio('ct-examen', 'Examen', 100, 'examen')],
      configuraciones: [
        {
          id: 'cfg',
          ...base,
          criterio_trimestre_id: 'ct-examen',
          preguntas: { lenguajes: 30, humano_comunitario: 10 },
        },
      ],
      resultados: [
        {
          id: 'res-1',
          ...base,
          criterio_trimestre_id: 'ct-examen',
          alumno_id: 'alumno-1',
          aciertos: { lenguajes: 30, humano_comunitario: 0 },
        },
      ],
    })

    const [uno] = reporteDeCapturas(datos, DOS)
    // 30 de 40 = 7.5. Promediando los campos daría 5.0.
    expect(comoCalificacion(uno!.general)).toBe('7.5')
    expect(comoCalificacion(uno!.porCampo.lenguajes ?? null)).toBe('10.0')
    expect(comoCalificacion(uno!.porCampo.humano_comunitario ?? null)).toBe('0.0')
  })

  it('normaliza sobre los pesos capturados y lo dice', () => {
    const datos = capturas({
      criterios: [criterio('ct-tareas', 'Tareas', 40), criterio('ct-examen', 'Examen', 60, 'examen')],
      actividades: [actividad('a1', 'ct-tareas', 'lenguajes', null)],
      entregas: [entrega('a1', 'alumno-1', true)],
    })

    const [uno] = reporteDeCapturas(datos, DOS)
    // El examen no se ha aplicado: 10.0 de lo capturado, sobre 40 del trimestre.
    expect(comoCalificacion(uno!.general)).toBe('10.0')
    expect(uno!.pesoConsiderado).toBe(40)
  })

  it('la conducta sin reportes vale 10 y cuenta con todo su peso', () => {
    // Es el único criterio automático que siempre tiene valor: no tener reportes
    // es el dato (C26). La consecuencia visible es esta: con conducta
    // configurada, el trimestre pesa 100 desde el primer día.
    const datos = capturas({
      criterios: [criterio('ct-tareas', 'Tareas', 70), criterio('ct-cond', 'Conducta', 30, 'auto_conducta')],
      actividades: [actividad('a1', 'ct-tareas', 'lenguajes', null)],
      entregas: [entrega('a1', 'alumno-1', true)],
    })

    const [uno] = reporteDeCapturas(datos, DOS)
    expect(comoCalificacion(uno!.general)).toBe('10.0')
    expect(uno!.pesoConsiderado).toBe(100)
    expect(uno!.criterios.find((c) => c.nombre === 'Conducta')?.general).toBe(1)
  })

  it('un criterio personalizado sigue sin aportar ni hundir el promedio', () => {
    // Existe en el tipo y no tiene forma de captura: se excluye, y el trimestre
    // se normaliza sobre lo que sí aporta (D-019).
    const datos = capturas({
      criterios: [
        criterio('ct-tareas', 'Tareas', 70),
        criterio('ct-otro', 'Otro', 30, 'personalizado'),
      ],
      actividades: [actividad('a1', 'ct-tareas', 'lenguajes', null)],
      entregas: [entrega('a1', 'alumno-1', true)],
    })

    const [uno] = reporteDeCapturas(datos, DOS)
    expect(comoCalificacion(uno!.general)).toBe('10.0')
    expect(uno!.pesoConsiderado).toBe(70)
    expect(uno!.criterios.find((c) => c.nombre === 'Otro')?.general).toBeNull()
  })

  it('el desglose por campo del trimestre pondera campo por campo', () => {
    const datos = capturas({
      criterios: [criterio('ct-tareas', 'Tareas', 50), criterio('ct-examen', 'Examen', 50, 'examen')],
      actividades: [actividad('a1', 'ct-tareas', 'lenguajes', null)],
      entregas: [entrega('a1', 'alumno-1', true)],
      configuraciones: [
        {
          id: 'cfg',
          ...base,
          criterio_trimestre_id: 'ct-examen',
          preguntas: { lenguajes: 10 },
        },
      ],
      resultados: [
        {
          id: 'res-1',
          ...base,
          criterio_trimestre_id: 'ct-examen',
          alumno_id: 'alumno-1',
          aciertos: { lenguajes: 5 },
        },
      ],
    })

    const [uno] = reporteDeCapturas(datos, DOS)
    // Lenguajes: (1.0 × 50 + 0.5 × 50) ÷ 100 = 0.75
    expect(comoCalificacion(uno!.porCampo.lenguajes ?? null)).toBe('7.5')
  })

  it('sin nada capturado, todos salen sin calificación', () => {
    const datos = capturas({ criterios: [criterio('ct-tareas', 'Tareas', 100)] })
    const alumnos = reporteDeCapturas(datos, DOS)
    expect(alumnos.every((a) => a.general === null)).toBe(true)
    expect(sinCalificacion(alumnos)).toBe(2)
  })

  it('conserva el orden del grupo', () => {
    const alumnos = reporteDeCapturas(capturas(), [alumno(1), alumno(2), alumno(3)])
    expect(alumnos.map((a) => a.alumno.numero_lista)).toEqual([1, 2, 3])
  })
})

describe('reporteDeCierres', () => {
  const cierre: CierreTrimestre = {
    id: 'cierre-1',
    ...base,
    trimestre_id: trimestre.id,
    alumno_id: 'alumno-1',
    final: 0.85,
    desglose: [
      { criterio: 'Tareas', peso: 60, calificacion: 1, porCampo: { lenguajes: 1 } },
      { criterio: 'Examen', peso: 40, calificacion: 0.625, porCampo: { lenguajes: 0.625 } },
    ],
  }

  it('devuelve los números del snapshot, no recalculados', () => {
    const [uno] = reporteDeCierres([cierre], DOS)
    expect(comoCalificacion(uno!.general)).toBe('8.5')
    expect(uno!.criterios.map((c) => c.nombre)).toEqual(['Tareas', 'Examen'])
    expect(uno!.pesoConsiderado).toBe(100)
  })

  it('un alumno sin snapshot sale sin calificación', () => {
    const [, dos] = reporteDeCierres([cierre], DOS)
    expect(dos!.general).toBeNull()
    expect(dos!.criterios).toEqual([])
  })

  it('un criterio que quedó sin calificar se conserva con su peso', () => {
    const conHueco: CierreTrimestre = {
      ...cierre,
      final: 1,
      desglose: [
        { criterio: 'Tareas', peso: 60, calificacion: 1, porCampo: { lenguajes: 1 } },
        { criterio: 'Examen', peso: 40, calificacion: null, porCampo: {} },
      ],
    }

    const [uno] = reporteDeCierres([conHueco], DOS)
    expect(uno!.criterios).toHaveLength(2)
    expect(uno!.pesoConsiderado).toBe(60)
  })
})

describe('snapshotsDe', () => {
  it('guarda nombres y pesos como texto, no referencias', () => {
    const datos = capturas({
      criterios: [criterio('ct-tareas', 'Tareas', 100)],
      actividades: [actividad('a1', 'ct-tareas', 'lenguajes', null)],
      entregas: [entrega('a1', 'alumno-1', true)],
    })

    const [uno] = snapshotsDe(reporteDeCapturas(datos, DOS))
    expect(uno).toEqual({
      alumno_id: 'alumno-1',
      final: 1,
      desglose: [
        { criterio: 'Tareas', peso: 100, calificacion: 1, porCampo: { lenguajes: 1 } },
      ],
    })
  })
})

/** Un trimestre con un criterio de 100% y una actividad entregada por todos. */
async function conCapturaCompleta() {
  await db.trimestres.add(trimestre)
  await db.alumnos.bulkAdd(DOS)
  await db.criterios.add({ id: 'cat-ct-tareas', ...base, nombre: 'Tareas', tipo: 'entregable' })
  await db.criterios_trimestre.add(criterio('ct-tareas', 'Tareas', 100).ponderado)
  await db.actividades.add(actividad('a1', 'ct-tareas', 'lenguajes', null))
  await db.entregas.bulkAdd([entrega('a1', 'alumno-1', true), entrega('a1', 'alumno-2', false)])
}

describe('reporteDeTrimestre', () => {
  it('un trimestre que no existe devuelve null, no falla', async () => {
    expect(await reporteDeTrimestre('no-existe')).toBeNull()
  })

  it('abierto, calcula de lo capturado', async () => {
    await conCapturaCompleta()

    const reporte = (await reporteDeTrimestre(trimestre.id))!
    expect(reporte.delSnapshot).toBe(false)
    expect(comoCalificacion(reporte.alumnos[0]!.general)).toBe('10.0')
    expect(comoCalificacion(reporte.alumnos[1]!.general)).toBe('0.0')
  })

  it('cerrado, los números vienen del snapshot aunque cambien los pesos', async () => {
    await conCapturaCompleta()
    await cerrarTrimestre(trimestre, [{ peso: 100 }])

    // Se corrige el peso y se renombra el criterio después de cerrar.
    await db.criterios_trimestre.update('ct-tareas', { peso: 40 })
    await db.criterios.update('cat-ct-tareas', { nombre: 'Tareas y trabajos' })

    const cerrado = (await db.trimestres.get(trimestre.id))!
    const reporte = (await reporteDeTrimestre(cerrado.id))!
    expect(reporte.delSnapshot).toBe(true)
    expect(comoCalificacion(reporte.alumnos[0]!.general)).toBe('10.0')
    // El nombre y el peso son los del cierre, no los de las filas vivas.
    expect(reporte.alumnos[0]!.criterios[0]?.nombre).toBe('Tareas')
    expect(reporte.alumnos[0]!.criterios[0]?.peso).toBe(100)
  })
})

describe('cerrarTrimestre', () => {
  it('escribe un cierre por alumno y marca el trimestre', async () => {
    await conCapturaCompleta()

    await cerrarTrimestre(trimestre, [{ peso: 100 }])

    const cierres = await db.cierres.toArray()
    expect(cierres).toHaveLength(2)
    expect(cierres.every((c) => c.deleted_at === null)).toBe(true)
    const cerrado = (await db.trimestres.get(trimestre.id))!
    expect(cerrado.estado).toBe('cerrado')
    expect(cerrado.cerrado_en).not.toBeNull()
  })

  it('no cierra si los pesos no suman 100', async () => {
    await conCapturaCompleta()

    await expect(cerrarTrimestre(trimestre, [{ peso: 90 }])).rejects.toThrow(/sumar 100/)
    expect(await db.cierres.count()).toBe(0)
    expect((await db.trimestres.get(trimestre.id))!.estado).toBe('abierto')
  })

  it('no cierra un trimestre ya cerrado', async () => {
    await conCapturaCompleta()
    await cerrarTrimestre(trimestre, [{ peso: 100 }])
    const cerrado = (await db.trimestres.get(trimestre.id))!

    await expect(cerrarTrimestre(cerrado, [{ peso: 100 }])).rejects.toThrow()
  })

  it('pide confirmación si algún alumno quedaría sin calificación', async () => {
    await conCapturaCompleta()
    await db.alumnos.add(alumno(3)) // llegó en la última semana, sin nada capturado

    await expect(cerrarTrimestre(trimestre, [{ peso: 100 }])).rejects.toThrow(
      /sin calificación/,
    )
    expect(await db.cierres.count()).toBe(0)

    await cerrarTrimestre(trimestre, [{ peso: 100 }], true)
    expect(await db.cierres.count()).toBe(3)
    expect((await db.cierres.toArray()).filter((c) => c.final === null)).toHaveLength(1)
  })

  it('encola el trimestre y cada cierre para sincronizar', async () => {
    await conCapturaCompleta()
    await db.outbox.clear()

    await cerrarTrimestre(trimestre, [{ peso: 100 }])

    const pendientes = await db.outbox.toArray()
    expect(pendientes.filter((c) => c.tabla === 'trimestres')).toHaveLength(1)
    expect(pendientes.filter((c) => c.tabla === 'cierres')).toHaveLength(2)
    expect(pendientes.every((c) => c.op === 'upsert')).toBe(true)
  })
})

describe('reabrirTrimestre', () => {
  it('exige confirmación explícita', async () => {
    await conCapturaCompleta()
    await cerrarTrimestre(trimestre, [{ peso: 100 }])
    const cerrado = (await db.trimestres.get(trimestre.id))!

    await expect(reabrirTrimestre(cerrado)).rejects.toThrow(/se descartan las calificaciones/)
    expect((await db.trimestres.get(trimestre.id))!.estado).toBe('cerrado')
  })

  it('reabre, borra el snapshot y conserva la huella del cierre', async () => {
    await conCapturaCompleta()
    await cerrarTrimestre(trimestre, [{ peso: 100 }])
    const cerrado = (await db.trimestres.get(trimestre.id))!

    await reabrirTrimestre(cerrado, true)

    const abierto = (await db.trimestres.get(trimestre.id))!
    expect(abierto.estado).toBe('abierto')
    // La huella queda: estuvo cerrado, y eso es lo único que registra la
    // reapertura mientras no exista una bitácora.
    expect(abierto.cerrado_en).toBe(cerrado.cerrado_en)
    expect(await db.cierres.where('deleted_at').equals('').count()).toBe(0)
    expect((await db.cierres.toArray()).every((c) => c.deleted_at !== null)).toBe(true)
  })

  it('un trimestre abierto no se reabre', async () => {
    await conCapturaCompleta()
    await expect(reabrirTrimestre(trimestre, true)).rejects.toThrow(/no está cerrado/)
  })

  it('volver a cerrar reescribe el snapshot en vez de duplicarlo', async () => {
    await conCapturaCompleta()
    await cerrarTrimestre(trimestre, [{ peso: 100 }])
    await reabrirTrimestre((await db.trimestres.get(trimestre.id))!, true)

    // Cambia una captura mientras está abierto y se vuelve a cerrar.
    await db.entregas.update('entrega-a1-alumno-2', { entregada: true })
    await cerrarTrimestre((await db.trimestres.get(trimestre.id))!, [{ peso: 100 }])

    const cierres = (await db.cierres.toArray()).filter((c) => c.deleted_at === null)
    expect(cierres).toHaveLength(2)
    expect(comoCalificacion(cierres.find((c) => c.alumno_id === 'alumno-2')!.final)).toBe(
      '10.0',
    )
  })
})

describe('criterios automáticos en el reporte', () => {
  const asistencia = (alumnoId: Id, fecha: string, estado: EstadoAsistencia) => ({
    id: `asis-${alumnoId}-${fecha}`,
    ...base,
    alumno_id: alumnoId,
    fecha,
    estado,
  })

  const reporte = (alumnoId: Id, fecha: string) => ({
    id: `rep-${alumnoId}-${fecha}`,
    ...base,
    alumno_id: alumnoId,
    fecha,
    texto: 'Algo pasó',
  })

  const participacion = (alumnoId: Id, fecha: string, cantidad: number) => ({
    id: `part-${alumnoId}-${fecha}`,
    ...base,
    alumno_id: alumnoId,
    fecha,
    cantidad,
  })

  it('la puntualidad sale de la asistencia, con su conversión de retardos', () => {
    const puntualidad = criterio('ct-punt', 'Puntualidad', 100, 'auto_puntualidad')
    puntualidad.ponderado.retardos_por_falta = 3
    const datos = capturas({
      criterios: [puntualidad],
      asistencia: [
        ...Array.from({ length: 8 }, (_, i) => asistencia('alumno-1', `2026-09-0${i + 1}`, 'presente')),
        asistencia('alumno-1', '2026-09-09', 'ausente'),
        asistencia('alumno-1', '2026-09-10', 'retardo'),
      ],
    })

    const [uno] = reporteDeCapturas(datos, DOS)
    // 10 días, 1 falta y 1 retardo que todavía no hace falta → 9/10.
    expect(comoCalificacion(uno!.criterios[0]!.general)).toBe('9.0')
  })

  it('la puntualidad de un alumno sin días capturados vale —', () => {
    const datos = capturas({
      criterios: [criterio('ct-punt', 'Puntualidad', 100, 'auto_puntualidad')],
      asistencia: [asistencia('alumno-1', '2026-09-01', 'presente')],
    })

    const [, dos] = reporteDeCapturas(datos, DOS)
    expect(comoCalificacion(dos!.criterios[0]!.general)).toBe('—')
  })

  it('la conducta cuenta los reportes de la bitácora del alumno', () => {
    const datos = capturas({
      criterios: [criterio('ct-cond', 'Conducta', 100, 'auto_conducta')],
      reportes: [
        reporte('alumno-1', '2026-09-01'),
        reporte('alumno-1', '2026-09-05'),
        reporte('alumno-2', '2026-09-05'),
      ],
    })

    const [uno, dos] = reporteDeCapturas(datos, DOS)
    // Dos reportes valen la mitad; uno se deja pasar.
    expect(comoCalificacion(uno!.criterios[0]!.general)).toBe('5.0')
    expect(comoCalificacion(dos!.criterios[0]!.general)).toBe('10.0')
  })

  it('la participación usa la meta del criterio, no el máximo del grupo', () => {
    const participar = criterio('ct-part', 'Participación', 100, 'auto_participacion')
    participar.ponderado.meta_participacion = 5
    const datos = capturas({
      criterios: [participar],
      participaciones: [
        participacion('alumno-1', '2026-09-01', 2),
        participacion('alumno-1', '2026-09-02', 1),
        participacion('alumno-2', '2026-09-01', 9),
      ],
    })

    const [uno, dos] = reporteDeCapturas(datos, DOS)
    // Tres de cinco, aunque su compañero lleve nueve.
    expect(comoCalificacion(uno!.criterios[0]!.general)).toBe('6.0')
    expect(comoCalificacion(dos!.criterios[0]!.general)).toBe('10.0')
  })

  it('sin participaciones de nadie, el criterio vale — para todo el grupo', () => {
    const participar = criterio('ct-part', 'Participación', 100, 'auto_participacion')
    participar.ponderado.meta_participacion = 5
    const datos = capturas({ criterios: [participar] })

    for (const alumno of reporteDeCapturas(datos, DOS)) {
      expect(comoCalificacion(alumno.criterios[0]!.general)).toBe('—')
    }
  })

  it('con marcas de alguien, quien no tiene ninguna saca 0.0', () => {
    const participar = criterio('ct-part', 'Participación', 100, 'auto_participacion')
    participar.ponderado.meta_participacion = 5
    const datos = capturas({
      criterios: [participar],
      participaciones: [participacion('alumno-1', '2026-09-01', 2)],
    })

    const [, dos] = reporteDeCapturas(datos, DOS)
    expect(comoCalificacion(dos!.criterios[0]!.general)).toBe('0.0')
  })

  it('ninguno de los tres aporta a un campo formativo', () => {
    // Un retardo no es de Lenguajes: la calificación por campo se normaliza sobre
    // los criterios que sí evalúan campos.
    const puntualidad = criterio('ct-punt', 'Puntualidad', 50, 'auto_puntualidad')
    const participar = criterio('ct-part', 'Participación', 20, 'auto_participacion')
    participar.ponderado.meta_participacion = 5
    const datos = capturas({
      criterios: [
        criterio('ct-tareas', 'Tareas', 30),
        puntualidad,
        criterio('ct-cond', 'Conducta', 0, 'auto_conducta'),
        participar,
      ],
      actividades: [actividad('a1', 'ct-tareas', 'lenguajes', null)],
      entregas: [entrega('a1', 'alumno-1', true)],
      asistencia: [asistencia('alumno-1', '2026-09-01', 'presente')],
      participaciones: [participacion('alumno-1', '2026-09-01', 5)],
    })

    const [uno] = reporteDeCapturas(datos, DOS)
    for (const automatico of uno!.criterios.filter((c) => c.nombre !== 'Tareas')) {
      expect(automatico.porCampo, automatico.nombre).toEqual({})
    }
    // El campo sale solo de Tareas, no diluido por los tres automáticos.
    expect(comoCalificacion(uno!.porCampo.lenguajes ?? null)).toBe('10.0')
    // Y el general sí los incluye a todos.
    expect(comoCalificacion(uno!.general)).toBe('10.0')
  })

  it('los tres se derivan: no se almacena ninguna calificación', () => {
    // La prueba de que se derivan es que el mismo reporte, con una falta más en
    // la asistencia, da otro número sin que nada se haya recalculado a mano.
    const puntualidad = criterio('ct-punt', 'Puntualidad', 100, 'auto_puntualidad')
    const conUnDia = capturas({
      criterios: [puntualidad],
      asistencia: [asistencia('alumno-1', '2026-09-01', 'presente')],
    })
    const conUnaFalta = capturas({
      criterios: [puntualidad],
      asistencia: [
        asistencia('alumno-1', '2026-09-01', 'presente'),
        asistencia('alumno-1', '2026-09-02', 'ausente'),
      ],
    })

    expect(comoCalificacion(reporteDeCapturas(conUnDia, DOS)[0]!.criterios[0]!.general)).toBe('10.0')
    expect(comoCalificacion(reporteDeCapturas(conUnaFalta, DOS)[0]!.criterios[0]!.general)).toBe('5.0')
  })
})

/**
 * Quién entra al reporte cuando hay alumnos dados de baja (D-026).
 *
 * Es la misma bifurcación que decide entre el snapshot y el cálculo, y por eso
 * vive en `armarReporte`: repetirla fuera sería tenerla mal en uno de los dos
 * sitios.
 */
describe('armarReporte con alumnos dados de baja', () => {
  const seFue: Alumno = {
    ...alumno(2),
    deleted_at: '2026-11-01T00:00:00.000Z',
  }
  const conBajas = [alumno(1), seFue]

  const cierre = (alumnoId: Id, final: number): CierreTrimestre => ({
    id: `cierre-${alumnoId}`,
    ...base,
    trimestre_id: 'trimestre-1',
    alumno_id: alumnoId,
    final,
    desglose: [{ criterio: 'Tareas', peso: 100, calificacion: final, porCampo: {} }],
  })

  it('en un trimestre cerrado el dado de baja sigue apareciendo', () => {
    // Se fue en noviembre, pero el trimestre 1 se cerró en octubre y su
    // calificación ya se reportó. Darlo de baja no puede cambiar esa boleta.
    const cerrado = { ...trimestre, estado: 'cerrado' as const }

    const reporte = armarReporte(
      capturas({ trimestre: cerrado }),
      [cierre('alumno-1', 0.9), cierre('alumno-2', 0.8)],
      conBajas,
    )

    expect(reporte.delSnapshot).toBe(true)
    expect(reporte.alumnos).toHaveLength(2)
    expect(reporte.alumnos[1]?.general).toBe(0.8)
  })

  it('la pantalla puede marcarlo: el alumno llega con su deleted_at', () => {
    const cerrado = { ...trimestre, estado: 'cerrado' as const }

    const reporte = armarReporte(capturas({ trimestre: cerrado }), [], conBajas)

    expect(reporte.alumnos[1]?.alumno.deleted_at).not.toBeNull()
  })

  it('en un trimestre abierto el dado de baja queda fuera', () => {
    // Calcular a quien ya no está sería ponerlo en una boleta que nadie va a
    // recibir.
    const reporte = armarReporte(capturas(), [], conBajas)

    expect(reporte.delSnapshot).toBe(false)
    expect(reporte.alumnos).toHaveLength(1)
    expect(reporte.alumnos[0]?.alumno.id).toBe('alumno-1')
  })

  it('sin bajas, cerrado y abierto ven al mismo grupo', () => {
    expect(armarReporte(capturas(), [], DOS).alumnos).toHaveLength(2)
    expect(
      armarReporte(capturas({ trimestre: { ...trimestre, estado: 'cerrado' } }), [], DOS)
        .alumnos,
    ).toHaveLength(2)
  })
})
