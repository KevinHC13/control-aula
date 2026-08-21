import type { CalificacionDeAlumno } from '@/application/calificaciones'
import { aBase10 } from '@/domain/calculo'
import type { Alumno, RegistroAsistencia } from '@/domain/entities'
import { cuentaComoAsistencia, enRiesgo, promedioDe, UMBRAL_ASISTENCIA, UMBRAL_PROMEDIO } from '@/domain/rules'
import type { Id } from '@/domain/values'

/**
 * El resumen del grupo: asistencia y promedio, del grupo y por alumno.
 *
 * Es la pantalla de *revisar*, no de capturar, y la única que mira el trimestre
 * completo de un jalón. Las dos cifras vienen de lugares distintos —la asistencia
 * de sus registros, el promedio del reporte del trimestre— y se cruzan aquí, que
 * es donde se puede decidir a quién marcar.
 *
 * Todo lo de este archivo es puro: recibe lo leído y no vuelve a la base.
 */

/** Un alumno en el resumen, con las dos cifras y si hay que mirarlo. */
export interface FilaResumen {
  alumno: Alumno
  /** Días con registro en el trimestre. Es el denominador de todo lo demás. */
  dias: number
  ausencias: number
  retardos: number
  /**
   * Porcentaje de asistencia. `null` sin un solo día capturado: un alumno del que
   * no hay registros no es un alumno con 0 % ni con 100 %.
   */
  porcentaje: number | null
  /** El general del trimestre, en base 1. `null` sin nada capturado. */
  promedio: number | null
  /** Si hay que mirarlo. Con los umbrales del prototipo, todavía sin validar. */
  riesgo: boolean
}

/** Las cifras del grupo, que son las dos que van arriba en grande. */
export interface ResumenDelGrupo {
  filas: FilaResumen[]
  /** Asistencia de todo el grupo: presentes sobre registros. `null` sin ninguno. */
  asistencia: number | null
  /** Promedio del grupo: el de los alumnos que tienen calificación. */
  promedio: number | null
  /** Cuántos alumnos están marcados. Es el número que ella busca al abrir. */
  enRiesgo: number
  /** Cuántos días distintos se han capturado en el trimestre. */
  diasCapturados: number
}

/**
 * Cruza el grupo con sus registros y su reporte.
 *
 * `retardo` y `justificada` **cuentan como asistencia** —es la regla de la escuela,
 * `cuentaComoAsistencia`— así que el porcentaje no baja por llegar tarde. El
 * resumen muestra los retardos aparte, que es lo que permite ver un patrón que el
 * porcentaje esconde.
 */
export function resumenDelGrupo(
  alumnos: readonly Alumno[],
  registros: readonly RegistroAsistencia[],
  calificaciones: readonly CalificacionDeAlumno[],
): ResumenDelGrupo {
  const porAlumno = new Map<Id, RegistroAsistencia[]>()
  for (const registro of registros) {
    const suyos = porAlumno.get(registro.alumno_id)
    if (suyos) suyos.push(registro)
    else porAlumno.set(registro.alumno_id, [registro])
  }

  const filas = alumnos.map((alumno) => {
    const suyos = porAlumno.get(alumno.id) ?? []
    const presentes = suyos.filter((r) => cuentaComoAsistencia(r.estado)).length
    // Se calcula aquí y no con `porcentajeAsistencia`, que devuelve 100 sin
    // registros: para el resumen, «no hay días» no es asistencia perfecta.
    const porcentaje = suyos.length === 0 ? null : (presentes / suyos.length) * 100
    const promedio =
      calificaciones.find((c) => c.alumno.id === alumno.id)?.general ?? null

    return {
      alumno,
      dias: suyos.length,
      ausencias: suyos.filter((r) => !cuentaComoAsistencia(r.estado)).length,
      retardos: suyos.filter((r) => r.estado === 'retardo').length,
      porcentaje,
      promedio,
      // Sin días capturados no se marca a nadie: marcar por falta de datos
      // convertiría el aviso en ruido las dos primeras semanas del trimestre.
      //
      // El promedio se convierte a **base 10** antes de comparar: el umbral es 6.0,
      // que es la escala en que ella lo lee, y toda la cadena de cálculo viaja en
      // base 1. Sin la conversión, un 9.0 se compararía como 0.9 y el grupo entero
      // saldría marcado.
      riesgo: porcentaje !== null && enRiesgo(porcentaje, promedio === null ? null : aBase10(promedio)),
    }
  })

  const presentesDelGrupo = registros.filter((r) => cuentaComoAsistencia(r.estado)).length

  return {
    filas,
    asistencia: registros.length === 0 ? null : (presentesDelGrupo / registros.length) * 100,
    // El promedio del grupo es el de los que tienen calificación, no el de todos
    // con los huecos en cero: media captura no puede hundir al grupo (D-019).
    promedio: promedioDe(
      filas.map((f) => f.promedio).filter((p): p is number => p !== null),
    ),
    enRiesgo: filas.filter((f) => f.riesgo).length,
    diasCapturados: new Set(registros.map((r) => r.fecha)).size,
  }
}

/**
 * Con qué umbrales se marca a un alumno, para poder decirlo en la pantalla.
 *
 * `[POR VALIDAR]`: son los del prototipo —90 % de asistencia, 6.0 de promedio— y
 * nadie los ha confirmado con la usuaria. Mientras eso pase, la pantalla los
 * **enseña** en vez de esconderlos: un color de alerta cuyo criterio no se ve es
 * un color en el que no se puede confiar (docs/ESTADO.md).
 */
export const UMBRALES = {
  asistencia: UMBRAL_ASISTENCIA,
  promedio: UMBRAL_PROMEDIO,
} as const
