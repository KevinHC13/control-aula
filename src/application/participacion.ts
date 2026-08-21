import { repos } from '@/data'
import type { Alumno, Participacion, Trimestre } from '@/domain/entities'
import type { Fecha, Id } from '@/domain/values'

/**
 * La participación: se marca desde la pantalla de asistencia, con un **modo**
 * (D-020). Con el interruptor prendido, tocar a un alumno le suma una
 * participación del día en vez de ciclar su asistencia.
 *
 * El modo es lo correcto aquí porque la participación ocurre en rondas —«a ver,
 * ¿quién más?»— y no de una en una repartida por el día. Lo que cuesta es que el
 * mismo gesto signifique dos cosas, y eso se paga en la interfaz: la pantalla se
 * ve distinta, el modo se apaga solo y se puede deshacer sin salir de él.
 */

/**
 * Un alumno con lo que ha participado. `delDia` es lo que se está capturando;
 * `delTrimestre` es lo que califica, y se ve al mismo tiempo para que marcar no
 * sea a ciegas.
 */
export interface FilaParticipacion {
  alumno: Alumno
  delDia: number
  delTrimestre: number
}

/**
 * Cruza el grupo con los contadores. Función pura: no lee la base.
 *
 * Recibe los del trimestre ya recortados por fecha —la atribución se deriva al
 * leer— y los del día aparte, aunque el día casi siempre esté dentro del
 * trimestre: hay días que no caen en ningún trimestre —vacaciones, puentes— y ahí
 * el conteo del día sigue siendo un dato aunque no vaya a calificar.
 */
export function filasDeParticipacion(
  alumnos: Alumno[],
  delDia: Participacion[],
  delTrimestre: Participacion[],
): FilaParticipacion[] {
  const hoyPorAlumno = new Map(delDia.map((p) => [p.alumno_id, p.cantidad]))

  const trimestrePorAlumno = new Map<Id, number>()
  for (const p of delTrimestre) {
    trimestrePorAlumno.set(p.alumno_id, (trimestrePorAlumno.get(p.alumno_id) ?? 0) + p.cantidad)
  }

  return alumnos.map((alumno) => ({
    alumno,
    delDia: hoyPorAlumno.get(alumno.id) ?? 0,
    delTrimestre: trimestrePorAlumno.get(alumno.id) ?? 0,
  }))
}

/**
 * Cuántas participaciones y de cuántos alumnos, para el contador del modo.
 *
 * Son dos cifras y no una porque dicen cosas distintas: doce participaciones de
 * tres alumnos es una clase donde participaron los mismos de siempre, y es
 * justamente lo que el criterio existe para hacer visible.
 */
export function totalDelDia(filas: FilaParticipacion[]): {
  participaciones: number
  alumnos: number
} {
  const conMarcas = filas.filter((f) => f.delDia > 0)
  return {
    participaciones: conMarcas.reduce((suma, f) => suma + f.delDia, 0),
    alumnos: conMarcas.length,
  }
}

/**
 * Suma una participación del día a un alumno.
 *
 * No revisa si el trimestre está cerrado, igual que la asistencia: la captura
 * diaria no pregunta por trimestres —la atribución es por fecha— y un trimestre
 * cerrado ya no recalcula, lee su snapshot. Marcar en un día de un trimestre
 * cerrado no puede cambiar una calificación reportada.
 */
export async function sumarParticipacion(alumnoId: Id, fecha: Fecha): Promise<void> {
  await repos.participaciones.sumarUna(alumnoId, fecha)
}

/**
 * Deshace una. Es el gesto de sostener el dedo, y existe porque un modo sin
 * deshacer obliga a salir de la pantalla a arreglar un toque de más —o a dejarlo—.
 */
export async function quitarParticipacion(alumnoId: Id, fecha: Fecha): Promise<void> {
  await repos.participaciones.restarUna(alumnoId, fecha)
}

/** Las participaciones del trimestre, atribuidas por sus fechas. */
export async function participacionesDelTrimestre(
  trimestre: Trimestre,
): Promise<Participacion[]> {
  return repos.participaciones.porRango(trimestre.inicio, trimestre.fin)
}
