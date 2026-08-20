import { repos } from '@/data'
import type { ActividadConEstado } from '@/data/ports/evaluacion'
import type { Alumno, Entrega, Trimestre } from '@/domain/entities'
import { aceptaEscrituras } from '@/domain/evaluacion'

/**
 * Captura binaria de una actividad: entregada o no entregada.
 *
 * Vive aparte de `evaluacion.ts` por la misma razón que `asistencia.ts` vive
 * aparte del resto: es el camino de captura, se mide con cronómetro y no comparte
 * nada con configurar un ciclo.
 *
 * La de rúbrica es otra pantalla y otro archivo (C23).
 */

/**
 * Una fila de la pantalla de captura.
 *
 * `registrado` distingue «entregada porque así se capturó» de «entregada porque es
 * el valor por defecto y todavía no se ha escrito nada». Al abrir la actividad se
 * materializan las 30, así que en la práctica siempre viene en `true`; se conserva
 * porque `filasDeEntrega` es pura y se usa antes de que la escritura termine.
 */
export interface FilaEntrega {
  alumno: Alumno
  entregada: boolean
  registrado: boolean
}

/**
 * Cruza el grupo con lo capturado. Un alumno sin registro sale `entregada`: casi
 * todos entregan, y solo se toca a los pocos que no (docs/UX.md).
 *
 * Función pura: no lee la base.
 */
export function filasDeEntrega(alumnos: Alumno[], entregas: Entrega[]): FilaEntrega[] {
  const porAlumno = new Map(entregas.map((e) => [e.alumno_id, e]))

  return alumnos.map((alumno) => {
    const registro = porAlumno.get(alumno.id)
    return {
      alumno,
      entregada: registro?.entregada ?? true,
      registrado: registro !== undefined,
    }
  })
}

/** Entregadas sobre total, que es la única cifra de la pantalla. */
export function contarEntregadas(filas: FilaEntrega[]): {
  entregadas: number
  total: number
} {
  return {
    entregadas: filas.filter((f) => f.entregada).length,
    total: filas.length,
  }
}

/**
 * Deja la actividad materializada: los 30 alumnos con registro, en `entregada`.
 *
 * Se llama **al abrir** la pantalla, y es lo contrario de la asistencia, donde
 * navegar un día no escribe (D-013). La diferencia es que en asistencia se hojean
 * días para consultar, y a una actividad no se entra si no es a calificarla. Así
 * «cero registros ⇒ sin calificar» queda inequívoco y el promedio no tiene huecos
 * (docs/DATA-MODEL.md).
 *
 * Idempotente: llamarla dos veces no duplica ni revierte lo capturado. En un
 * trimestre cerrado no escribe nada, en vez de fallar: abrir para consultar una
 * actividad de un trimestre cerrado es legítimo.
 */
export async function abrirCaptura(
  trimestre: Trimestre,
  actividad: ActividadConEstado,
): Promise<void> {
  if (!aceptaEscrituras(trimestre)) return

  const alumnos = await repos.alumnos.lista()
  await repos.evaluacion.materializarEntregas(
    actividad.actividad.id,
    alumnos.map((a) => a.id),
  )
}

/**
 * Alterna una fila y la guarda. Devuelve cómo quedó, para que quien llama no tenga
 * que recalcularlo.
 *
 * Recibe el estado actual en vez de leerlo: la pantalla ya lo tiene fresco por
 * suscripción, y un viaje extra a la base por cada toque es justo lo que el
 * presupuesto de 15 segundos no puede pagar.
 */
export async function alternarEntrega(
  trimestre: Trimestre,
  actividad: ActividadConEstado,
  fila: FilaEntrega,
): Promise<boolean> {
  if (!aceptaEscrituras(trimestre)) {
    throw new Error('Un trimestre cerrado no admite capturar entregas')
  }

  const entregada = !fila.entregada
  await repos.evaluacion.marcarEntrega(actividad.actividad.id, fila.alumno.id, entregada)
  return entregada
}
