import type { FilaAsistencia } from '@/application/asistencia'
import type { FilaParticipacion } from '@/application/participacion'
import type { Alumno } from '@/domain/entities'
import { estaEnElSalon } from '@/domain/rules'
import { elegirPonderado } from '@/domain/sorteo'

/**
 * Sortear quién participa: sale un nombre, ella dice si participó (D-021).
 *
 * **El sorteo no registra nada por sí solo.** Es lo que sostiene que la
 * calificación de participación signifique algo: registrar por haber salido
 * sorteado mediría *salir sorteado*, no participar. Quien confirme llama a
 * `sumarParticipacion` —el mismo caso de uso del modo de captura— y quien diga que
 * no, no escribe nada.
 */

/** Un candidato listo para pintar: el alumno y lo que lleva en el trimestre. */
export interface CandidatoDelSorteo {
  alumno: Alumno
  participaciones: number
}

/**
 * Quiénes entran al sorteo: los que **están en el salón**, con lo que llevan
 * participado en el trimestre.
 *
 * `justificada` no entra, aunque cuente como asistencia: el niño no está ahí y no
 * puede pasar al pizarrón. Es la única parte de la app donde esos dos estados se
 * separan (`estaEnElSalon`).
 *
 * Función pura: recibe las dos listas que la pantalla ya tiene y no vuelve a la
 * base.
 */
export function candidatosPresentes(
  asistencia: readonly FilaAsistencia[],
  participacion: readonly FilaParticipacion[],
): CandidatoDelSorteo[] {
  const porAlumno = new Map(participacion.map((f) => [f.alumno.id, f.delTrimestre]))

  return asistencia
    .filter((f) => estaEnElSalon(f.estado))
    .map((f) => ({ alumno: f.alumno, participaciones: porAlumno.get(f.alumno.id) ?? 0 }))
}

/**
 * El sorteado, o `null` si no hay nadie a quien sortear —día sin nadie presente,
 * lista sin cargar—, que es un resultado normal y la pantalla lo dice en vez de
 * sortear entre nadie.
 *
 * `azar` entra como argumento hasta acá: el `Math.random()` vive en la pantalla,
 * así que esta función y la del dominio se prueban con un número fijo.
 */
export function sortearEntre(
  candidatos: readonly CandidatoDelSorteo[],
  azar: number,
): CandidatoDelSorteo | null {
  const elegido = elegirPonderado(
    candidatos.map((c) => ({ id: c.alumno.id, participaciones: c.participaciones })),
    azar,
  )

  return candidatos.find((c) => c.alumno.id === elegido) ?? null
}
