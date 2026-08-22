import { repos } from '@/data'
import type { ActividadConEstado } from '@/data/ports/evaluacion'
import type { Alumno, EvaluacionRubrica, RubricaCriterio, Trimestre } from '@/domain/entities'
import {
  aceptaEscrituras,
  nivelesCompletos,
  siguienteSinCapturar,
} from '@/domain/evaluacion'
import type { Id, Nivel } from '@/domain/values'

/**
 * Captura con rúbrica de una actividad, alumno por alumno.
 *
 * Vive aparte de `evaluacion.ts` por la misma razón que `entregas.ts`: es camino
 * de captura, no de configuración. Y aparte de `entregas.ts` porque no comparte
 * nada con él: allá una fila es un toque, aquí un alumno son tantos toques como
 * renglones tenga la rúbrica, y el orden en que se recorre el grupo es parte del
 * problema.
 *
 * A diferencia de la captura binaria, **abrir no escribe**: el registro nace con
 * el primer nivel elegido. Escribir 30 registros vacíos al abrir dejaría la
 * actividad contando 30 capturas sin que nadie esté calificado, y «cero registros
 * ⇒ sin calificar» dejaría de ser cierto (docs/DATA-MODEL.md).
 */

/** Una fila de la lista de alumnos de la actividad. */
export interface FilaCalificacion {
  alumno: Alumno
  /** `rubrica_criterio_id` → índice del nivel elegido. Vacío si no se ha tocado. */
  niveles: Record<Id, Nivel>
  /** Cuántos renglones de la rúbrica ya tienen nivel. */
  capturados: number
  /** Si tiene nivel en **todos** los renglones. Es lo que «Siguiente» respeta. */
  completa: boolean
}

/**
 * Cruza el grupo con lo capturado. Un alumno sin registro sale con el mapa vacío:
 * aquí no hay valor por omisión que adivinar —lo contrario de la entrega, donde
 * «entregada» es lo probable—, porque ningún nivel es el más probable.
 *
 * Función pura: no lee la base.
 */
export function filasDeCalificacion(
  alumnos: Alumno[],
  evaluaciones: EvaluacionRubrica[],
  renglones: readonly RubricaCriterio[],
): FilaCalificacion[] {
  const porAlumno = new Map(evaluaciones.map((e) => [e.alumno_id, e]))
  const ids = renglones.map((r) => r.id)

  return alumnos.map((alumno) => {
    const niveles = porAlumno.get(alumno.id)?.niveles ?? {}
    return {
      alumno,
      niveles,
      capturados: ids.filter((id) => niveles[id] !== undefined).length,
      completa: nivelesCompletos(niveles, ids),
    }
  })
}

/** Calificados sobre total: el «12 de 30» de la pantalla. */
export function contarCalificados(filas: FilaCalificacion[]): {
  calificados: number
  total: number
} {
  return {
    calificados: filas.filter((f) => f.completa).length,
    total: filas.length,
  }
}

/**
 * El índice del siguiente alumno **sin calificar**, empezando después de `desde`
 * y dando la vuelta al final de la lista. `null` cuando ya no falta nadie.
 *
 * El recorrido lo decide `siguienteSinCapturar`, en `domain/`: la comparte con la
 * captura del examen. Aquí solo se traduce qué cuenta como capturado —un alumno a
 * medias cuenta como pendiente, porque un promedio sacado de tres renglones de
 * cuatro no se compara con el de nadie—.
 *
 * Con `desde` en -1 devuelve el primero que falte, que es con lo que se entra
 * desde la lista.
 */
export function siguienteSinCalificar(
  filas: FilaCalificacion[],
  desde: number,
): number | null {
  return siguienteSinCapturar(
    filas.map((f) => f.completa),
    desde,
  )
}

/**
 * Guarda el nivel de un renglón. Cada toque escribe: no hay botón de Guardar.
 *
 * Recibe la fila que la pantalla ya tiene por suscripción y no la vuelve a leer,
 * igual que `alternarEntrega`: un viaje extra por toque es lo que el presupuesto
 * no paga.
 */
export async function calificarRenglon(
  trimestre: Trimestre,
  actividad: ActividadConEstado,
  fila: FilaCalificacion,
  renglonId: Id,
  nivel: Nivel,
): Promise<void> {
  if (!aceptaEscrituras(trimestre)) {
    throw new Error('Este trimestre está cerrado: ya no se pueden registrar calificaciones')
  }

  await repos.evaluacion.calificarRenglon(
    actividad.actividad.id,
    fila.alumno.id,
    renglonId,
    nivel,
  )
}
