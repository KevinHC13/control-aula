import { liveQuery } from 'dexie'

import type {
  ActividadesDelCriterio,
  CicloEnCurso,
  CriterioDelTrimestre,
  DatosActividad,
  EsquemaTrimestre,
  EvaluacionRepo,
  ExamenDelTrimestre,
  PeriodoNuevo,
  RenglonDeRubrica,
  RubricaConCriterios,
} from '@/data/ports/evaluacion'
import type {
  Actividad,
  Ciclo,
  Entrega,
  EvaluacionRubrica,
  ExamenConfig,
  ResultadoExamen,
  Criterio,
  CriterioTrimestre,
  Rubrica,
  RubricaCriterio,
  TipoCriterio,
  Trimestre,
} from '@/domain/entities'
import { admiteActividades } from '@/domain/evaluacion'
import type {
  CampoFormativo,
  Fecha,
  Id,
  Instante,
  Nivel,
  Sincronizable,
  Suscribible,
} from '@/domain/values'

import { ahora, db, nuevoId } from './db'

/** Lo que `Entrega` y `EvaluacionRubrica` tienen en común para borrarlas juntas. */
type CapturaDeActividad = Sincronizable & { actividad_id: Id }

export class DexieEvaluacionRepo implements EvaluacionRepo {
  async cicloEnCurso(): Promise<CicloEnCurso | null> {
    // El filtro de vivos va en memoria: IndexedDB no indexa `null`, así que los
    // registros con `deleted_at: null` no están en ese índice. Ver la nota en
    // alumnos.adapter.ts.
    const abiertos = (await db.ciclos.where('estado').equals('abierto').toArray()).filter(
      (c) => c.deleted_at === null,
    )
    // Solo puede haber uno abierto; si hubiera dos, el más reciente es el que
    // ella acaba de configurar.
    const ciclo = abiertos.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
    if (!ciclo) return null

    const trimestres = (await db.trimestres.where('ciclo_id').equals(ciclo.id).toArray())
      .filter((t) => t.deleted_at === null)
      .sort((a, b) => a.numero - b.numero)

    return { ciclo, trimestres }
  }

  observarCicloEnCurso(): Suscribible<CicloEnCurso | null> {
    return liveQuery(() => this.cicloEnCurso())
  }

  async abrirCiclo(nombre: string, periodos: PeriodoNuevo[]): Promise<void> {
    await db.transaction('rw', db.ciclos, db.trimestres, db.outbox, async () => {
      const momento = ahora()

      const ciclo: Ciclo = {
        id: nuevoId(),
        nombre,
        estado: 'abierto',
        updated_at: momento,
        deleted_at: null,
      }

      const trimestres: Trimestre[] = periodos.map((periodo) => ({
        id: nuevoId(),
        ciclo_id: ciclo.id,
        numero: periodo.numero,
        inicio: periodo.inicio,
        fin: periodo.fin,
        estado: 'abierto',
        cerrado_en: null,
        updated_at: momento,
        deleted_at: null,
      }))

      await db.ciclos.add(ciclo)
      await db.trimestres.bulkAdd(trimestres)
      await db.outbox.bulkAdd([
        { tabla: 'ciclos', registro_id: ciclo.id, op: 'upsert', at: momento },
        ...trimestres.map((t) => ({
          tabla: 'trimestres' as const,
          registro_id: t.id,
          op: 'upsert' as const,
          at: momento,
        })),
      ])
    })
  }

  async abrirTrimestre(cicloId: Id, periodo: PeriodoNuevo): Promise<void> {
    await db.transaction('rw', db.trimestres, db.outbox, async () => {
      const momento = ahora()
      const trimestre: Trimestre = {
        id: nuevoId(),
        ciclo_id: cicloId,
        numero: periodo.numero,
        inicio: periodo.inicio,
        fin: periodo.fin,
        estado: 'abierto',
        cerrado_en: null,
        updated_at: momento,
        deleted_at: null,
      }

      await db.trimestres.add(trimestre)
      await db.outbox.add({
        tabla: 'trimestres',
        registro_id: trimestre.id,
        op: 'upsert',
        at: momento,
      })
    })
  }

  async ajustarFechas(trimestreId: Id, inicio: Fecha, fin: Fecha): Promise<void> {
    await db.transaction('rw', db.trimestres, db.outbox, async () => {
      const trimestre = await db.trimestres.get(trimestreId)
      if (!trimestre) throw new Error(`No existe el trimestre ${trimestreId}`)

      const momento = ahora()
      await db.trimestres.put({ ...trimestre, inicio, fin, updated_at: momento })
      await db.outbox.add({
        tabla: 'trimestres',
        registro_id: trimestre.id,
        op: 'upsert',
        at: momento,
      })
    })
  }

  async esquemaDeTrimestre(trimestreId: Id): Promise<EsquemaTrimestre | null> {
    const trimestre = await db.trimestres.get(trimestreId)
    if (!trimestre || trimestre.deleted_at !== null) return null

    const ponderados = (
      await db.criterios_trimestre.where('trimestre_id').equals(trimestreId).toArray()
    )
      .filter((c) => c.deleted_at === null)
      .sort((a, b) => a.orden - b.orden)

    // Una sola consulta por lote y no una por fila: son pocos criterios, pero el
    // hábito de resolver la relación con un `bulkGet` es el que evita el N+1
    // cuando la lista crece.
    const criterios = await db.criterios.bulkGet(ponderados.map((c) => c.criterio_id))

    const conCatalogo: CriterioDelTrimestre[] = []
    for (const [i, ponderado] of ponderados.entries()) {
      const criterio = criterios[i]
      // Una fila sin su entrada de catálogo es una inconsistencia que no debería
      // existir; se omite en vez de pintar un criterio sin nombre.
      if (criterio && criterio.deleted_at === null) conCatalogo.push({ ponderado, criterio })
    }

    return { trimestre, criterios: conCatalogo }
  }

  observarEsquemaDeTrimestre(trimestreId: Id): Suscribible<EsquemaTrimestre | null> {
    return liveQuery(() => this.esquemaDeTrimestre(trimestreId))
  }

  async agregarCriterio(trimestreId: Id, nombre: string, tipo: TipoCriterio): Promise<void> {
    await db.transaction(
      'rw',
      db.criterios,
      db.criterios_trimestre,
      db.outbox,
      async () => {
        const momento = ahora()

        // El catálogo se reutiliza: «Tareas» tiene que ser el mismo criterio en
        // los tres trimestres para que copiar el esquema signifique algo.
        const existente = (await db.criterios.where('tipo').equals(tipo).toArray()).find(
          (c) => c.deleted_at === null && c.nombre.localeCompare(nombre, 'es', {
            sensitivity: 'base',
          }) === 0,
        )

        let criterio = existente
        if (!criterio) {
          criterio = {
            id: nuevoId(),
            nombre,
            tipo,
            updated_at: momento,
            deleted_at: null,
          } satisfies Criterio
          await db.criterios.add(criterio)
          await db.outbox.add({
            tabla: 'criterios',
            registro_id: criterio.id,
            op: 'upsert',
            at: momento,
          })
        }

        const yaEsta = (
          await db.criterios_trimestre.where('trimestre_id').equals(trimestreId).toArray()
        ).filter((c) => c.deleted_at === null)

        if (yaEsta.some((c) => c.criterio_id === criterio.id)) return

        const ponderado: CriterioTrimestre = {
          id: nuevoId(),
          trimestre_id: trimestreId,
          criterio_id: criterio.id,
          // Nace en 0: un valor de arranque obligaría a adivinar el reparto.
          peso: 0,
          orden: yaEsta.length,
          meta_participacion: null,
          updated_at: momento,
          deleted_at: null,
        }

        await db.criterios_trimestre.add(ponderado)
        await db.outbox.add({
          tabla: 'criterios_trimestre',
          registro_id: ponderado.id,
          op: 'upsert',
          at: momento,
        })
      },
    )
  }

  async ajustarPeso(criterioTrimestreId: Id, peso: number): Promise<void> {
    await db.transaction('rw', db.criterios_trimestre, db.outbox, async () => {
      const ponderado = await db.criterios_trimestre.get(criterioTrimestreId)
      if (!ponderado) throw new Error(`No existe el criterio ${criterioTrimestreId}`)

      const momento = ahora()
      await db.criterios_trimestre.put({ ...ponderado, peso, updated_at: momento })
      await db.outbox.add({
        tabla: 'criterios_trimestre',
        registro_id: ponderado.id,
        op: 'upsert',
        at: momento,
      })
    })
  }

  async quitarCriterio(criterioTrimestreId: Id): Promise<void> {
    await db.transaction('rw', db.criterios_trimestre, db.outbox, async () => {
      const ponderado = await db.criterios_trimestre.get(criterioTrimestreId)
      if (!ponderado) return

      const momento = ahora()
      // Borrado suave, y solo de la fila del trimestre: la entrada del catálogo
      // se queda porque otros trimestres la comparten.
      await db.criterios_trimestre.put({
        ...ponderado,
        deleted_at: momento,
        updated_at: momento,
      })
      await db.outbox.add({
        tabla: 'criterios_trimestre',
        registro_id: ponderado.id,
        op: 'delete',
        at: momento,
      })
    })
  }

  async copiarEsquema(desdeTrimestreId: Id, haciaTrimestreId: Id): Promise<void> {
    await db.transaction('rw', db.criterios_trimestre, db.outbox, async () => {
      const origen = (
        await db.criterios_trimestre.where('trimestre_id').equals(desdeTrimestreId).toArray()
      )
        .filter((c) => c.deleted_at === null)
        .sort((a, b) => a.orden - b.orden)

      const destino = (
        await db.criterios_trimestre.where('trimestre_id').equals(haciaTrimestreId).toArray()
      ).filter((c) => c.deleted_at === null)

      const yaEsta = new Set(destino.map((c) => c.criterio_id))
      const porCopiar = origen.filter((c) => !yaEsta.has(c.criterio_id))
      if (porCopiar.length === 0) return

      const momento = ahora()
      // Filas **nuevas**, no las mismas: es lo que hace que cambiar un peso aquí
      // no pueda tocar nada de lo ya calculado en el trimestre de origen.
      // Se copia el peso y la meta; nunca actividades ni calificaciones, que no
      // cuelgan de esta tabla, y por lo tanto tampoco rúbricas.
      const copias: CriterioTrimestre[] = porCopiar.map((c, i) => ({
        id: nuevoId(),
        trimestre_id: haciaTrimestreId,
        criterio_id: c.criterio_id,
        peso: c.peso,
        orden: destino.length + i,
        meta_participacion: c.meta_participacion,
        updated_at: momento,
        deleted_at: null,
      }))

      await db.criterios_trimestre.bulkAdd(copias)
      await db.outbox.bulkAdd(
        copias.map((c) => ({
          tabla: 'criterios_trimestre' as const,
          registro_id: c.id,
          op: 'upsert' as const,
          at: momento,
        })),
      )
    })
  }

  async rubricas(): Promise<RubricaConCriterios[]> {
    const rubricas = (await db.rubricas.toArray()).filter((r) => r.deleted_at === null)
    if (rubricas.length === 0) return []

    const renglones = (await db.rubrica_criterios.toArray()).filter(
      (c) => c.deleted_at === null,
    )
    // Una sola pasada por las actividades para saber qué rúbricas están en uso:
    // así `enUso` no cuesta una consulta por rúbrica. La rúbrica cuelga de la
    // actividad, no del criterio (docs/DATA-MODEL.md).
    const usadas = new Set(
      (await db.actividades.toArray())
        .filter((a) => a.deleted_at === null && a.rubrica_id !== null)
        .map((a) => a.rubrica_id),
    )

    return rubricas
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map((rubrica) => ({
        rubrica,
        criterios: renglones
          .filter((c) => c.rubrica_id === rubrica.id)
          .sort((a, b) => a.orden - b.orden),
        enUso: usadas.has(rubrica.id),
      }))
  }

  observarRubricas(): Suscribible<RubricaConCriterios[]> {
    return liveQuery(() => this.rubricas())
  }

  async guardarRubrica(
    rubrica: { id?: Id; nombre: string },
    renglones: RenglonDeRubrica[],
  ): Promise<Id> {
    return db.transaction('rw', db.rubricas, db.rubrica_criterios, db.outbox, async () => {
      const momento = ahora()
      const existente = rubrica.id ? await db.rubricas.get(rubrica.id) : undefined

      const guardada: Rubrica = existente
        ? { ...existente, nombre: rubrica.nombre, updated_at: momento }
        : {
            id: rubrica.id ?? nuevoId(),
            nombre: rubrica.nombre,
            activa: true,
            updated_at: momento,
            deleted_at: null,
          }

      await db.rubricas.put(guardada)
      await db.outbox.add({
        tabla: 'rubricas',
        registro_id: guardada.id,
        op: 'upsert',
        at: momento,
      })

      const anteriores = (
        await db.rubrica_criterios.where('rubrica_id').equals(guardada.id).toArray()
      ).filter((c) => c.deleted_at === null)
      const porId = new Map(anteriores.map((c) => [c.id, c]))

      const escritos: RubricaCriterio[] = renglones.map((renglon, orden) => {
        const previo = renglon.id ? porId.get(renglon.id) : undefined
        // Conservar el `id` es lo que mantiene vivo lo ya calificado: es la clave
        // de `EvaluacionRubrica.niveles`.
        return {
          id: previo?.id ?? renglon.id ?? nuevoId(),
          rubrica_id: guardada.id,
          nombre: renglon.nombre,
          descriptores: renglon.descriptores,
          orden,
          updated_at: momento,
          deleted_at: null,
        }
      })

      const conservados = new Set(escritos.map((c) => c.id))
      const quitados = anteriores.filter((c) => !conservados.has(c.id))

      await db.rubrica_criterios.bulkPut([
        ...escritos,
        ...quitados.map((c) => ({ ...c, deleted_at: momento, updated_at: momento })),
      ])
      await db.outbox.bulkAdd([
        ...escritos.map((c) => ({
          tabla: 'rubrica_criterios' as const,
          registro_id: c.id,
          op: 'upsert' as const,
          at: momento,
        })),
        ...quitados.map((c) => ({
          tabla: 'rubrica_criterios' as const,
          registro_id: c.id,
          op: 'delete' as const,
          at: momento,
        })),
      ])

      return guardada.id
    })
  }

  async cambiarActivaRubrica(rubricaId: Id, activa: boolean): Promise<void> {
    await db.transaction('rw', db.rubricas, db.outbox, async () => {
      const rubrica = await db.rubricas.get(rubricaId)
      if (!rubrica) throw new Error(`No existe la rúbrica ${rubricaId}`)

      const momento = ahora()
      await db.rubricas.put({ ...rubrica, activa, updated_at: momento })
      await db.outbox.add({
        tabla: 'rubricas',
        registro_id: rubrica.id,
        op: 'upsert',
        at: momento,
      })
    })
  }

  async borrarRubrica(rubricaId: Id): Promise<void> {
    await db.transaction('rw', db.rubricas, db.rubrica_criterios, db.outbox, async () => {
      const rubrica = await db.rubricas.get(rubricaId)
      if (!rubrica) return

      const momento = ahora()
      const renglones = (
        await db.rubrica_criterios.where('rubrica_id').equals(rubricaId).toArray()
      ).filter((c) => c.deleted_at === null)

      await db.rubricas.put({ ...rubrica, deleted_at: momento, updated_at: momento })
      await db.rubrica_criterios.bulkPut(
        renglones.map((c) => ({ ...c, deleted_at: momento, updated_at: momento })),
      )
      await db.outbox.bulkAdd([
        { tabla: 'rubricas' as const, registro_id: rubrica.id, op: 'delete' as const, at: momento },
        ...renglones.map((c) => ({
          tabla: 'rubrica_criterios' as const,
          registro_id: c.id,
          op: 'delete' as const,
          at: momento,
        })),
      ])
    })
  }

  async actividadesDeTrimestre(trimestreId: Id): Promise<ActividadesDelCriterio[]> {
    const esquema = await this.esquemaDeTrimestre(trimestreId)
    if (!esquema) return []

    // Solo los criterios que admiten actividades: el examen se captura por
    // aciertos sobre el CriterioTrimestre, no por actividades.
    const conActividades = esquema.criterios.filter((c) => admiteActividades(c.criterio.tipo))
    if (conActividades.length === 0) return []

    const deEsteTrimestre = new Set(conActividades.map((c) => c.ponderado.id))
    const actividades = (await db.actividades.toArray()).filter(
      (a) => a.deleted_at === null && deEsteTrimestre.has(a.criterio_trimestre_id),
    )

    // Los registros de captura en una sola pasada por actividad, no una consulta
    // por fila. Con rúbrica o sin ella, cualquiera de los dos cuenta como
    // calificada.
    const cuenta = new Map<Id, number>()
    for (const tabla of [db.entregas, db.eval_rubrica]) {
      for (const registro of await tabla.toArray()) {
        if (registro.deleted_at !== null) continue
        cuenta.set(registro.actividad_id, (cuenta.get(registro.actividad_id) ?? 0) + 1)
      }
    }

    return conActividades.map(({ ponderado, criterio }) => ({
      ponderado,
      criterio,
      actividades: actividades
        .filter((a) => a.criterio_trimestre_id === ponderado.id)
        // Las más recientes primero. A igual fecha, la última capturada arriba:
        // es la que ella acaba de crear.
        .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.updated_at.localeCompare(a.updated_at))
        .map((actividad) => ({ actividad, registros: cuenta.get(actividad.id) ?? 0 })),
    }))
  }

  observarActividadesDeTrimestre(trimestreId: Id): Suscribible<ActividadesDelCriterio[]> {
    return liveQuery(() => this.actividadesDeTrimestre(trimestreId))
  }

  async crearActividad(datos: DatosActividad): Promise<Id> {
    return db.transaction('rw', db.actividades, db.outbox, async () => {
      const momento = ahora()
      const actividad: Actividad = {
        id: nuevoId(),
        ...datos,
        updated_at: momento,
        deleted_at: null,
      }

      await db.actividades.add(actividad)
      await db.outbox.add({
        tabla: 'actividades',
        registro_id: actividad.id,
        op: 'upsert',
        at: momento,
      })

      return actividad.id
    })
  }

  async editarActividad(
    actividadId: Id,
    datos: DatosActividad,
    descartarCaptura: boolean,
  ): Promise<void> {
    await db.transaction(
      'rw',
      db.actividades,
      db.entregas,
      db.eval_rubrica,
      db.outbox,
      async () => {
        const actividad = await db.actividades.get(actividadId)
        if (!actividad) throw new Error(`No existe la actividad ${actividadId}`)

        const momento = ahora()
        await db.actividades.put({ ...actividad, ...datos, updated_at: momento })
        await db.outbox.add({
          tabla: 'actividades',
          registro_id: actividad.id,
          op: 'upsert',
          at: momento,
        })

        if (descartarCaptura) await this.descartarCapturaDe(actividadId, momento)
      },
    )
  }

  async borrarActividad(actividadId: Id): Promise<void> {
    await db.transaction(
      'rw',
      db.actividades,
      db.entregas,
      db.eval_rubrica,
      db.outbox,
      async () => {
        const actividad = await db.actividades.get(actividadId)
        if (!actividad) return

        const momento = ahora()
        await db.actividades.put({ ...actividad, deleted_at: momento, updated_at: momento })
        await db.outbox.add({
          tabla: 'actividades',
          registro_id: actividad.id,
          op: 'delete',
          at: momento,
        })

        await this.descartarCapturaDe(actividadId, momento)
      },
    )
  }

  async entregasDeActividad(actividadId: Id): Promise<Entrega[]> {
    const registros = await db.entregas.where('actividad_id').equals(actividadId).toArray()
    // El filtro va en memoria: IndexedDB no indexa `null`. Ver la nota en
    // alumnos.adapter.ts.
    return registros.filter((e) => e.deleted_at === null)
  }

  observarEntregasDeActividad(actividadId: Id): Suscribible<Entrega[]> {
    return liveQuery(() => this.entregasDeActividad(actividadId))
  }

  async materializarEntregas(actividadId: Id, alumnoIds: Id[]): Promise<void> {
    await db.transaction('rw', db.entregas, db.outbox, async () => {
      const yaRegistrados = new Set(
        (await db.entregas.where('actividad_id').equals(actividadId).toArray())
          .filter((e) => e.deleted_at === null)
          .map((e) => e.alumno_id),
      )

      const faltantes = alumnoIds.filter((id) => !yaRegistrados.has(id))
      if (faltantes.length === 0) return

      const momento = ahora()
      const nuevas: Entrega[] = faltantes.map((alumnoId) => ({
        id: nuevoId(),
        actividad_id: actividadId,
        alumno_id: alumnoId,
        // El estado más probable es el estado por defecto: casi todos entregan, y
        // solo se toca a los pocos que no (docs/UX.md).
        entregada: true,
        updated_at: momento,
        deleted_at: null,
      }))

      await db.entregas.bulkPut(nuevas)
      await db.outbox.bulkAdd(
        nuevas.map((e) => ({
          tabla: 'entregas' as const,
          registro_id: e.id,
          op: 'upsert' as const,
          at: momento,
        })),
      )
    })
  }

  async marcarEntrega(actividadId: Id, alumnoId: Id, entregada: boolean): Promise<void> {
    await db.transaction('rw', db.entregas, db.outbox, async () => {
      const existente = await db.entregas
        .where('[actividad_id+alumno_id]')
        .equals([actividadId, alumnoId])
        .first()

      const registro: Entrega = {
        id: existente?.id ?? nuevoId(),
        actividad_id: actividadId,
        alumno_id: alumnoId,
        entregada,
        updated_at: ahora(),
        // Volver a marcar revive un registro borrado: para la maestra es el mismo
        // alumno en la misma actividad, no uno nuevo.
        deleted_at: null,
      }

      await db.entregas.put(registro)
      await db.outbox.add({
        tabla: 'entregas',
        registro_id: registro.id,
        op: 'upsert',
        at: ahora(),
      })
    })
  }

  async evaluacionesDeActividad(actividadId: Id): Promise<EvaluacionRubrica[]> {
    const registros = await db.eval_rubrica.where('actividad_id').equals(actividadId).toArray()
    // El filtro va en memoria: IndexedDB no indexa `null`. Ver la nota en
    // alumnos.adapter.ts.
    return registros.filter((e) => e.deleted_at === null)
  }

  observarEvaluacionesDeActividad(actividadId: Id): Suscribible<EvaluacionRubrica[]> {
    return liveQuery(() => this.evaluacionesDeActividad(actividadId))
  }

  async calificarRenglon(
    actividadId: Id,
    alumnoId: Id,
    rubricaCriterioId: Id,
    nivel: Nivel,
  ): Promise<void> {
    await db.transaction('rw', db.eval_rubrica, db.outbox, async () => {
      const existente = await db.eval_rubrica
        .where('[actividad_id+alumno_id]')
        .equals([actividadId, alumnoId])
        .first()

      const momento = ahora()
      const registro: EvaluacionRubrica = {
        id: existente?.id ?? nuevoId(),
        actividad_id: actividadId,
        alumno_id: alumnoId,
        // Se copia el mapa en vez de mutarlo: el objeto que devolvió Dexie puede
        // ser el mismo que ya tiene una suscripción en la mano.
        niveles: { ...existente?.niveles, [rubricaCriterioId]: nivel },
        updated_at: momento,
        // Volver a calificar revive un registro borrado: para la maestra es el
        // mismo alumno en la misma actividad, no uno nuevo.
        deleted_at: null,
      }

      await db.eval_rubrica.put(registro)
      await db.outbox.add({
        tabla: 'eval_rubrica',
        registro_id: registro.id,
        op: 'upsert',
        at: momento,
      })
    })
  }

  async examenesDeTrimestre(trimestreId: Id): Promise<ExamenDelTrimestre[]> {
    const esquema = await this.esquemaDeTrimestre(trimestreId)
    if (!esquema) return []

    const deExamen = esquema.criterios.filter((c) => c.criterio.tipo === 'examen')
    if (deExamen.length === 0) return []

    // Una sola pasada por la tabla y no una consulta por criterio: son a lo más
    // dos filas y la tabla tiene una configuración por examen.
    const configs = (await db.examen_config.toArray()).filter((c) => c.deleted_at === null)

    return deExamen.map(({ ponderado, criterio }) => ({
      ponderado,
      criterio,
      config: configs.find((c) => c.criterio_trimestre_id === ponderado.id) ?? null,
    }))
  }

  observarExamenesDeTrimestre(trimestreId: Id): Suscribible<ExamenDelTrimestre[]> {
    return liveQuery(() => this.examenesDeTrimestre(trimestreId))
  }

  async guardarPreguntasExamen(
    criterioTrimestreId: Id,
    preguntas: Partial<Record<CampoFormativo, number>>,
  ): Promise<void> {
    await db.transaction('rw', db.examen_config, db.outbox, async () => {
      const existente = (
        await db.examen_config.where('criterio_trimestre_id').equals(criterioTrimestreId).toArray()
      ).find((c) => c.deleted_at === null)

      const momento = ahora()
      const registro: ExamenConfig = {
        id: existente?.id ?? nuevoId(),
        criterio_trimestre_id: criterioTrimestreId,
        preguntas,
        updated_at: momento,
        deleted_at: null,
      }

      await db.examen_config.put(registro)
      await db.outbox.add({
        tabla: 'examen_config',
        registro_id: registro.id,
        op: 'upsert',
        at: momento,
      })
    })
  }

  async resultadosDeExamen(criterioTrimestreId: Id): Promise<ResultadoExamen[]> {
    const registros = await db.resultados_examen
      .where('criterio_trimestre_id')
      .equals(criterioTrimestreId)
      .toArray()
    // El filtro va en memoria: IndexedDB no indexa `null`. Ver la nota en
    // alumnos.adapter.ts.
    return registros.filter((r) => r.deleted_at === null)
  }

  observarResultadosDeExamen(criterioTrimestreId: Id): Suscribible<ResultadoExamen[]> {
    return liveQuery(() => this.resultadosDeExamen(criterioTrimestreId))
  }

  async registrarAciertos(
    criterioTrimestreId: Id,
    alumnoId: Id,
    campo: CampoFormativo,
    aciertos: number | null,
  ): Promise<void> {
    await db.transaction('rw', db.resultados_examen, db.outbox, async () => {
      const existente = await db.resultados_examen
        .where('[criterio_trimestre_id+alumno_id]')
        .equals([criterioTrimestreId, alumnoId])
        .first()

      // Se copia el mapa en vez de mutarlo: el objeto que devolvió Dexie puede ser
      // el mismo que ya tiene una suscripción en la mano.
      const mapa = { ...existente?.aciertos }
      if (aciertos === null) delete mapa[campo]
      else mapa[campo] = aciertos

      const momento = ahora()
      const registro: ResultadoExamen = {
        id: existente?.id ?? nuevoId(),
        criterio_trimestre_id: criterioTrimestreId,
        alumno_id: alumnoId,
        aciertos: mapa,
        updated_at: momento,
        // Volver a capturar revive un registro borrado: para la maestra es el
        // mismo alumno en el mismo examen, no uno nuevo.
        deleted_at: null,
      }

      await db.resultados_examen.put(registro)
      await db.outbox.add({
        tabla: 'resultados_examen',
        registro_id: registro.id,
        op: 'upsert',
        at: momento,
      })
    })
  }

  /**
   * Borra en suave las entregas y evaluaciones de una actividad. Privado y sin
   * transacción propia: siempre se llama dentro de una, porque descartar la
   * captura y el cambio que la motivó tienen que caer juntos o no caer.
   */
  private async descartarCapturaDe(actividadId: Id, momento: Instante): Promise<void> {
    for (const nombre of ['entregas', 'eval_rubrica'] as const) {
      // `db.table()` en vez de `db.entregas` / `db.eval_rubrica`: son dos tablas
      // de tipos distintos y el bucle solo usa lo que ambas comparten —`id`,
      // `actividad_id`, `deleted_at`—. Escribirlo dos veces por separado sería
      // duplicar el mismo borrado.
      const tabla = db.table<CapturaDeActividad>(nombre)
      const registros = (
        await tabla.where('actividad_id').equals(actividadId).toArray()
      ).filter((r) => r.deleted_at === null)
      if (registros.length === 0) continue

      await tabla.bulkPut(
        registros.map((r) => ({ ...r, deleted_at: momento, updated_at: momento })),
      )
      await db.outbox.bulkAdd(
        registros.map((r) => ({
          tabla: nombre,
          registro_id: r.id,
          op: 'delete' as const,
          at: momento,
        })),
      )
    }
  }
}
