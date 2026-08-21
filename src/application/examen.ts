import { repos } from '@/data'
import type { ExamenDelTrimestre } from '@/data/ports/evaluacion'
import type { Alumno, ResultadoExamen, Trimestre } from '@/domain/entities'
import {
  aceptaEscrituras,
  aciertosCompletos,
  aciertosEnRango,
  camposConPreguntas,
  examenConfigurado,
  siguienteSinCapturar,
} from '@/domain/evaluacion'
import type { CampoFormativo, Id } from '@/domain/values'

import { CAMPOS_CON_NOMBRE } from './evaluacion'

/**
 * Captura del examen: aciertos por campo formativo, alumno por alumno.
 *
 * Hay **un** examen por trimestre y cuelga del `CriterioTrimestre`, no de una
 * actividad (docs/DECISIONES.md D-018). Por eso no aparece en la lista de
 * actividades: ahí invitaría a crearle actividades que no van a ningún lado.
 *
 * Dos pasos, y el primero solo se hace una vez por trimestre: decir cuántas
 * preguntas trae cada campo, y luego capturar. Sin preguntas no hay denominador, y
 * `aciertos ÷ preguntas` sería una división entre cero disfrazada de calificación.
 */

/** Un campo del examen con su nombre y su denominador. */
export interface CampoDelExamen {
  campo: CampoFormativo
  nombre: string
  preguntas: number
}

/** Una fila de la lista de alumnos del examen. */
export interface FilaExamen {
  alumno: Alumno
  /** Aciertos por campo. Vacío si no se ha capturado nada. */
  aciertos: Partial<Record<CampoFormativo, number>>
  /** Cuántos campos del examen ya tienen cifra. */
  capturados: number
  /** Si tiene cifra en **todos** los campos con preguntas. */
  completa: boolean
}

/**
 * Los campos que el examen evalúa, en el orden en que se reportan, con su nombre y
 * su total de preguntas.
 *
 * Los campos sin preguntas no salen: un campo que el examen no evaluó no es un
 * hueco por llenar, y ofrecerlo haría capturar aciertos sobre cero preguntas.
 */
export function camposDelExamen(examen: ExamenDelTrimestre): CampoDelExamen[] {
  const preguntas = examen.config?.preguntas ?? {}
  const conPreguntas = new Set(camposConPreguntas(preguntas))

  return CAMPOS_CON_NOMBRE.filter((c) => conPreguntas.has(c.campo)).map((c) => ({
    campo: c.campo,
    nombre: c.nombre,
    preguntas: preguntas[c.campo] ?? 0,
  }))
}

/** Si el examen ya se puede capturar: alguien dijo cuántas preguntas trae. */
export function examenListo(examen: ExamenDelTrimestre): boolean {
  return examenConfigurado(examen.config?.preguntas ?? {})
}

/**
 * Cruza el grupo con lo capturado. Un alumno sin registro sale con el mapa vacío:
 * no hay cifra por omisión que adivinar —cero aciertos es un dato, no una ausencia—.
 *
 * Función pura: no lee la base.
 */
export function filasDeExamen(
  alumnos: Alumno[],
  resultados: ResultadoExamen[],
  campos: readonly CampoDelExamen[],
): FilaExamen[] {
  const porAlumno = new Map(resultados.map((r) => [r.alumno_id, r]))
  const soloCampos = campos.map((c) => c.campo)

  return alumnos.map((alumno) => {
    const aciertos = porAlumno.get(alumno.id)?.aciertos ?? {}
    return {
      alumno,
      aciertos,
      capturados: soloCampos.filter((campo) => aciertos[campo] !== undefined).length,
      completa: aciertosCompletos(aciertos, soloCampos),
    }
  })
}

/** Con resultado sobre total: el «12 de 30» de la pantalla. */
export function contarConResultado(filas: FilaExamen[]): {
  capturados: number
  total: number
} {
  return {
    capturados: filas.filter((f) => f.completa).length,
    total: filas.length,
  }
}

/**
 * El índice del siguiente alumno **sin resultado**, dando la vuelta al final de la
 * lista. `null` cuando ya no falta nadie. Mismo recorrido que la captura con
 * rúbrica, con la misma regla en `domain/`.
 */
export function siguienteSinResultado(filas: FilaExamen[], desde: number): number | null {
  return siguienteSinCapturar(
    filas.map((f) => f.completa),
    desde,
  )
}

/**
 * Lo que dejaría fuera de rango cambiar los totales de preguntas: los campos donde
 * algún alumno ya tiene más aciertos que las preguntas nuevas.
 *
 * Corregir un total es normal —el examen traía 18 y se anotó 20— y bajar uno no
 * borra lo capturado. Pero bajarlo por debajo de lo ya capturado dejaría
 * calificaciones por arriba de 10, así que la pantalla lo tiene que impedir y
 * decir en qué campo.
 */
export function camposQueQuedanFueraDeRango(
  resultados: ResultadoExamen[],
  preguntas: Partial<Record<CampoFormativo, number>>,
): CampoFormativo[] {
  return camposConPreguntas(preguntas).filter((campo) =>
    resultados.some((r) => {
      const capturado = r.aciertos[campo]
      return capturado !== undefined && capturado > (preguntas[campo] ?? 0)
    }),
  )
}

/**
 * Guarda cuántas preguntas trae cada campo. Se hace una vez por trimestre, así que
 * esta sí es una pantalla de configuración con su botón de guardar.
 *
 * Rechaza dejar aciertos ya capturados por arriba del nuevo total: preferir el
 * dato viejo sería conservar una calificación imposible.
 */
export async function guardarPreguntasExamen(
  trimestre: Trimestre,
  examen: ExamenDelTrimestre,
  preguntas: Partial<Record<CampoFormativo, number>>,
): Promise<void> {
  if (!aceptaEscrituras(trimestre)) {
    throw new Error('Un trimestre cerrado no admite cambiar el examen')
  }
  if (!examenConfigurado(preguntas)) {
    throw new Error('El examen necesita preguntas en al menos un campo')
  }

  const resultados = await repos.evaluacion.resultadosDeExamen(examen.ponderado.id)
  if (camposQueQuedanFueraDeRango(resultados, preguntas).length > 0) {
    throw new Error('Hay alumnos con más aciertos que las preguntas nuevas')
  }

  await repos.evaluacion.guardarPreguntasExamen(examen.ponderado.id, preguntas)
}

/**
 * Guarda los aciertos de un campo. Cada dígito escribe: no hay botón de Guardar en
 * el camino de captura.
 *
 * `null` borra la cifra, que es lo que pasa al vaciarla con el teclado. Recibe la
 * fila que la pantalla ya tiene por suscripción y no la vuelve a leer, igual que
 * las otras dos capturas.
 */
export async function registrarAciertos(
  trimestre: Trimestre,
  examen: ExamenDelTrimestre,
  fila: FilaExamen,
  campo: CampoDelExamen,
  aciertos: number | null,
): Promise<void> {
  if (!aceptaEscrituras(trimestre)) {
    throw new Error('Un trimestre cerrado no admite capturar el examen')
  }
  if (aciertos !== null && !aciertosEnRango(aciertos, campo.preguntas)) {
    throw new Error(
      `${aciertos} no cabe en ${campo.nombre}: el examen trae ${campo.preguntas} preguntas`,
    )
  }

  await repos.evaluacion.registrarAciertos(
    examen.ponderado.id,
    fila.alumno.id,
    campo.campo,
    aciertos,
  )
}

/**
 * Qué cifra queda al teclear un dígito sobre la que ya está, y `null` si no cabe.
 *
 * Es la regla que sostiene «no se aceptan aciertos mayores al total»: el dígito que
 * sacaría la cifra del rango simplemente **no entra**, en vez de escribirse y
 * mostrar un error. Con teclado en pantalla, un dígito rechazado se siente como no
 * haberlo tocado; un error que hay que leer y descartar cuesta bastante más.
 *
 * Un `0` sobre una cifra vacía es cero aciertos, no el comienzo de «05»: por eso
 * `0` seguido de `7` da 7 y no falla.
 */
export function conDigito(
  actual: number | undefined,
  digito: number,
  preguntas: number,
): number | null {
  const nuevo = actual === undefined || actual === 0 ? digito : actual * 10 + digito
  return aciertosEnRango(nuevo, preguntas) ? nuevo : null
}

/**
 * Qué cifra queda al borrar el último dígito, y `null` cuando ya no queda cifra
 * —que es lo que se guarda como campo sin capturar—.
 */
export function sinUltimoDigito(actual: number | undefined): number | null {
  if (actual === undefined) return null
  const recortado = Math.floor(actual / 10)
  return recortado === 0 ? null : recortado
}

/** Los exámenes del trimestre, con sus preguntas. Lectura para la pantalla. */
export async function examenesDelTrimestre(trimestreId: Id): Promise<ExamenDelTrimestre[]> {
  return repos.evaluacion.examenesDeTrimestre(trimestreId)
}
