import { repos } from '@/data'
import type { CapturasDelTrimestre, CriterioDelTrimestre } from '@/data/ports/evaluacion'
import {
  type CalificacionDeCriterio,
  calificacionDeCriterio,
  calificacionDeTrimestre,
  valorDeEvaluacion,
  valorExamenGeneral,
  valorExamenPorCampo,
  valorSinRubrica,
  type ValorDeActividad,
} from '@/domain/calculo'
import type { Alumno, CierreTrimestre, Trimestre } from '@/domain/entities'
import { camposConPreguntas, puedeCerrarse } from '@/domain/evaluacion'
import type { CampoFormativo, Id } from '@/domain/values'

/**
 * Las calificaciones de un trimestre: leer lo capturado, pasarlo por la cadena de
 * cálculo y —al cerrar— congelarlo en un snapshot.
 *
 * `domain/calculo.ts` es puro y no sabe leer; el puerto lee y no sabe calcular.
 * Este archivo es el único que hace las dos cosas, y por eso también es el que
 * cierra el trimestre: cerrar **es** calcular y guardar el resultado.
 *
 * Un trimestre cerrado no se recalcula: sus números vienen del snapshot. Es toda
 * la razón por la que el snapshot existe —una boleta entregada no cambia porque
 * después se corrija un peso— y está en el mismo lugar donde se decide leer, para
 * que no haya forma de saltárselo.
 */

/** Un criterio ya calificado para un alumno, con lo que hace falta para pintarlo. */
export interface CriterioCalificado {
  nombre: string
  peso: number
  /** El general del criterio. `null` es «sin calificar», nunca 0. */
  general: number | null
  porCampo: Partial<Record<CampoFormativo, number>>
}

/** Un alumno con su trimestre desglosado. */
export interface CalificacionDeAlumno {
  alumno: Alumno
  criterios: CriterioCalificado[]
  /** La calificación del trimestre, en base 1. */
  general: number | null
  /**
   * Sobre cuánto del trimestre se calculó. Menos de 100 significa que hay
   * criterios sin nada capturado, y la pantalla **tiene** que decirlo: una cifra
   * normalizada sin contexto se lee como una de boleta (D-019).
   */
  pesoConsiderado: number
  /** El trimestre por campo formativo, que es como ella reporta. */
  porCampo: Partial<Record<CampoFormativo, number>>
}

/** El reporte completo de un trimestre. */
export interface ReporteDeTrimestre {
  trimestre: Trimestre
  /** Si los números vienen del snapshot del cierre en vez de recalcularse. */
  delSnapshot: boolean
  /** En el orden del grupo, que es el de la lista. */
  alumnos: CalificacionDeAlumno[]
}

/**
 * El valor de una actividad para un alumno, o `null` si no se puede calificar.
 *
 * Sin registro no hay valor: la actividad se excluye para ese alumno, que es la
 * regla de «una actividad sin registros se excluye del promedio» vista alumno por
 * alumno. Con rúbrica, una captura incompleta tampoco produce valor (D-019).
 */
function valorDeActividadParaAlumno(
  capturas: CapturasDelTrimestre,
  actividadId: Id,
  rubricaId: Id | null,
  alumnoId: Id,
): number | null {
  if (rubricaId === null) {
    const entrega = capturas.entregas.find(
      (e) => e.actividad_id === actividadId && e.alumno_id === alumnoId,
    )
    return entrega === undefined ? null : valorSinRubrica(entrega.entregada)
  }

  const evaluacion = capturas.evaluaciones.find(
    (e) => e.actividad_id === actividadId && e.alumno_id === alumnoId,
  )
  if (evaluacion === undefined) return null

  return valorDeEvaluacion(evaluacion.niveles, capturas.renglonesPorRubrica[rubricaId] ?? [])
}

/** El criterio entregable de un alumno: el promedio de sus actividades. */
function criterioEntregable(
  capturas: CapturasDelTrimestre,
  criterioTrimestreId: Id,
  alumnoId: Id,
): CalificacionDeCriterio {
  const valores: ValorDeActividad[] = []

  for (const actividad of capturas.actividades) {
    if (actividad.criterio_trimestre_id !== criterioTrimestreId) continue
    const valor = valorDeActividadParaAlumno(
      capturas,
      actividad.id,
      actividad.rubrica_id,
      alumnoId,
    )
    if (valor !== null) valores.push({ campo: actividad.campo, valor })
  }

  return calificacionDeCriterio(valores)
}

/** El criterio de examen de un alumno: aciertos sobre preguntas. */
function criterioExamen(
  capturas: CapturasDelTrimestre,
  criterioTrimestreId: Id,
  alumnoId: Id,
): CalificacionDeCriterio {
  const config = capturas.configuraciones.find(
    (c) => c.criterio_trimestre_id === criterioTrimestreId,
  )
  if (!config) return { general: null, porCampo: {} }

  const resultado = capturas.resultados.find(
    (r) => r.criterio_trimestre_id === criterioTrimestreId && r.alumno_id === alumnoId,
  )
  const aciertos = resultado?.aciertos ?? {}

  const porCampo: Partial<Record<CampoFormativo, number>> = {}
  for (const campo of camposConPreguntas(config.preguntas)) {
    const valor = valorExamenPorCampo(aciertos[campo], config.preguntas[campo] ?? 0)
    if (valor !== null) porCampo[campo] = valor
  }

  return { general: valorExamenGeneral(aciertos, config.preguntas), porCampo }
}

/**
 * Qué calificación produce un criterio para un alumno, según su tipo.
 *
 * Los criterios automáticos —puntualidad, conducta, participación— y el
 * `personalizado` devuelven `null`: están pospuestos y no tienen captura, así que
 * no aportan. Devolver 0 los haría reprobar a todos.
 */
function calificarCriterio(
  capturas: CapturasDelTrimestre,
  { ponderado, criterio }: CriterioDelTrimestre,
  alumnoId: Id,
): CriterioCalificado {
  const calculada =
    criterio.tipo === 'entregable'
      ? criterioEntregable(capturas, ponderado.id, alumnoId)
      : criterio.tipo === 'examen'
        ? criterioExamen(capturas, ponderado.id, alumnoId)
        : { general: null, porCampo: {} }

  return {
    nombre: criterio.nombre,
    peso: ponderado.peso,
    general: calculada.general,
    porCampo: calculada.porCampo,
  }
}

/**
 * El trimestre por campo formativo: se pondera campo por campo, con los mismos
 * pesos y la misma normalización que el general.
 *
 * No es el general desglosado ni el promedio de los campos de cada criterio: es la
 * misma fórmula aplicada a una columna. Un criterio que no evaluó ese campo no
 * aporta a ese campo, igual que un criterio sin captura no aporta al general.
 */
function trimestrePorCampo(
  criterios: readonly CriterioCalificado[],
): Partial<Record<CampoFormativo, number>> {
  const campos = new Set(criterios.flatMap((c) => Object.keys(c.porCampo) as CampoFormativo[]))
  const porCampo: Partial<Record<CampoFormativo, number>> = {}

  for (const campo of campos) {
    const { valor } = calificacionDeTrimestre(
      criterios.map((c) => ({ peso: c.peso, valor: c.porCampo[campo] ?? null })),
    )
    if (valor !== null) porCampo[campo] = valor
  }

  return porCampo
}

/**
 * Calcula el trimestre de todos los alumnos a partir de lo capturado.
 *
 * Función pura: recibe la lectura completa y no vuelve a la base. Se cruza una vez
 * para los 30 alumnos, no una consulta por alumno.
 */
export function reporteDeCapturas(
  capturas: CapturasDelTrimestre,
  alumnos: readonly Alumno[],
): CalificacionDeAlumno[] {
  return alumnos.map((alumno) => {
    const criterios = capturas.criterios.map((c) => calificarCriterio(capturas, c, alumno.id))
    const { valor, pesoConsiderado } = calificacionDeTrimestre(
      criterios.map((c) => ({ peso: c.peso, valor: c.general })),
    )

    return {
      alumno,
      criterios,
      general: valor,
      pesoConsiderado,
      porCampo: trimestrePorCampo(criterios),
    }
  })
}

/**
 * Reconstruye el reporte desde el snapshot de un trimestre cerrado.
 *
 * No recalcula nada: los pesos y los nombres salen del snapshot, no de las filas
 * vivas, así que renombrar o borrar un criterio después no altera lo que se
 * reportó. Un alumno que se dio de alta después del cierre no tiene snapshot y
 * sale sin calificación, que es la verdad.
 */
export function reporteDeCierres(
  cierres: readonly CierreTrimestre[],
  alumnos: readonly Alumno[],
): CalificacionDeAlumno[] {
  return alumnos.map((alumno) => {
    const cierre = cierres.find((c) => c.alumno_id === alumno.id)
    const criterios: CriterioCalificado[] = (cierre?.desglose ?? []).map((d) => ({
      nombre: d.criterio,
      peso: d.peso,
      general: d.calificacion,
      porCampo: d.porCampo,
    }))

    return {
      alumno,
      criterios,
      general: cierre?.final ?? null,
      pesoConsiderado: criterios
        .filter((c) => c.general !== null)
        .reduce((acc, c) => acc + c.peso, 0),
      porCampo: trimestrePorCampo(criterios),
    }
  })
}

/**
 * El reporte del trimestre: del snapshot si está cerrado, calculado si está
 * abierto.
 *
 * **Esta es la única función que decide entre las dos cosas**, y por eso es pura y
 * la usan las dos entradas —la lectura de una sola vez y el hook reactivo—. Con la
 * decisión repetida, cualquier pantalla podría recalcular un trimestre cerrado por
 * descuido, y ese descuido cambiaría una calificación ya reportada.
 */
export function armarReporte(
  capturas: CapturasDelTrimestre,
  cierres: readonly CierreTrimestre[],
  alumnos: readonly Alumno[],
): ReporteDeTrimestre {
  if (capturas.trimestre.estado === 'cerrado') {
    return {
      trimestre: capturas.trimestre,
      delSnapshot: true,
      alumnos: reporteDeCierres(cierres, alumnos),
    }
  }

  return {
    trimestre: capturas.trimestre,
    delSnapshot: false,
    alumnos: reporteDeCapturas(capturas, alumnos),
  }
}

/** Lo mismo, leyendo. `null` si el trimestre no existe. */
export async function reporteDeTrimestre(
  trimestreId: Id,
): Promise<ReporteDeTrimestre | null> {
  const capturas = await repos.evaluacion.capturasDelTrimestre(trimestreId)
  if (!capturas) return null

  const [alumnos, cierres] = await Promise.all([
    repos.alumnos.lista(),
    repos.evaluacion.cierresDeTrimestre(trimestreId),
  ])

  return armarReporte(capturas, cierres, alumnos)
}

/** Los snapshots que se escribirían al cerrar, en el orden del grupo. */
export function snapshotsDe(alumnos: readonly CalificacionDeAlumno[]) {
  return alumnos.map((a) => ({
    alumno_id: a.alumno.id,
    final: a.general,
    desglose: a.criterios.map((c) => ({
      criterio: c.nombre,
      peso: c.peso,
      calificacion: c.general,
      porCampo: c.porCampo,
    })),
  }))
}

/** Cuántos alumnos quedarían sin calificación si se cerrara ahora. */
export function sinCalificacion(alumnos: readonly CalificacionDeAlumno[]): number {
  return alumnos.filter((a) => a.general === null).length
}

/**
 * Cierra el trimestre: calcula el snapshot de cada alumno y lo guarda junto con el
 * cambio de estado, en una transacción.
 *
 * Exige que los pesos sumen 100 —es lo único que el cierre exige y que editar no—
 * y que el trimestre esté abierto. Si algún alumno queda sin calificación pide
 * confirmación explícita: cerrar así es legítimo —un alumno que llegó en la última
 * semana— pero no es lo que ella espera al apretar el botón.
 */
export async function cerrarTrimestre(
  trimestre: Trimestre,
  criterios: readonly { peso: number }[],
  confirmado = false,
): Promise<void> {
  if (!puedeCerrarse(trimestre, criterios)) {
    throw new Error('Para cerrar el trimestre los pesos tienen que sumar 100')
  }

  const reporte = await reporteDeTrimestre(trimestre.id)
  if (!reporte) throw new Error('No existe el trimestre que se quiere cerrar')

  const faltan = sinCalificacion(reporte.alumnos)
  if (faltan > 0 && !confirmado) {
    throw new Error(
      `${faltan} de ${reporte.alumnos.length} alumnos se cerrarían sin calificación`,
    )
  }

  await repos.evaluacion.cerrarTrimestre(trimestre.id, snapshotsDe(reporte.alumnos))
}

/**
 * Reabre un trimestre cerrado. Borra su snapshot: con el trimestre abierto las
 * calificaciones vuelven a calcularse de lo capturado, y dejar los cierres vivos
 * dejaría dos verdades a la vez.
 *
 * Quien llama ya se lo advirtió a la maestra: reabrir es lo que permite que una
 * calificación ya reportada cambie, que es exactamente lo que cerrar impide.
 */
export async function reabrirTrimestre(
  trimestre: Trimestre,
  confirmado = false,
): Promise<void> {
  if (trimestre.estado !== 'cerrado') {
    throw new Error('Este trimestre no está cerrado')
  }
  if (!confirmado) {
    throw new Error('Reabrir el trimestre borra las calificaciones que ya se reportaron')
  }

  await repos.evaluacion.reabrirTrimestre(trimestre.id)
}
