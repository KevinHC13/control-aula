import { promedioDe } from './rules'
import { aciertosCompletos, camposConPreguntas, nivelesCompletos } from './evaluacion'
import { NIVEL_MAXIMO, VALOR_NIVEL } from './values'
import type { CampoFormativo, Id, Nivel } from './values'

/**
 * La cadena de cálculo de calificaciones. Funciones puras: no leen la base, no
 * conocen Dexie y no saben qué pantalla las llama.
 *
 * Vive aparte de `evaluacion.ts` —que es la **estructura**: qué trimestre le toca
 * a una fecha, si los pesos cierran, si una rúbrica está completa— porque esto son
 * los **números**. Se cambian por razones distintas y se leen en momentos
 * distintos.
 *
 * Dos reglas gobiernan todo el archivo:
 *
 * 1. **Todo en base 1.** La conversión a base 10 ocurre una sola vez, al
 *    presentar, y es la única que redondea. Ningún paso intermedio redondea:
 *    hacerlo acumularía error y volvería el resultado dependiente del orden en que
 *    se calculó.
 * 2. **`null` significa «no hay dato», nunca cero.** Un alumno sin nada capturado
 *    no es un alumno con cero: si `null` se volviera `0`, el promedio de medio
 *    trimestre se vería hundido por lo que todavía no se califica, que es
 *    exactamente lo que hace que una app de calificaciones no se use.
 */

/*
 * Actividad
 * =========
 */

/**
 * El valor de una captura con rúbrica: el promedio de los niveles elegidos sobre
 * el nivel máximo.
 *
 * Todos los renglones pesan lo mismo —no hay ponderación interna— y se usa
 * `VALOR_NIVEL`, no el índice: el índice es solo la forma de almacenarlo.
 *
 * En base 10: todo Excelente da 10.0, todo Bien 8.3, todo Regular 6.7 y todo Mal
 * 0.0. El salto de Regular a Mal es un acantilado deliberado (docs/DATA-MODEL.md).
 */
export function valorConRubrica(niveles: readonly Nivel[]): number | null {
  const valores = niveles.map((n) => VALOR_NIVEL[n] ?? 0)
  const media = promedioDe(valores)
  return media === null ? null : media / NIVEL_MAXIMO
}

/**
 * El valor de la captura de un alumno en una actividad con rúbrica, o `null` si
 * está **incompleta**.
 *
 * Una captura a medias no produce calificación: se excluye del promedio igual que
 * una actividad sin ningún registro. Es la misma regla vista desde el alumno, y
 * la única coherente con lo que la pantalla ya dice —«sin calificar»—: promediar
 * tres renglones de cuatro daría un número que se ve final, sacado de menos
 * evidencia que el de los demás, y nadie se enteraría de la diferencia.
 *
 * `renglones` son los renglones **vivos** de la rúbrica, así que un nivel guardado
 * de un renglón que ya se borró no cuenta ni completa nada.
 */
export function valorDeEvaluacion(
  niveles: Readonly<Record<Id, Nivel>>,
  renglones: readonly Id[],
): number | null {
  if (!nivelesCompletos(niveles, renglones)) return null

  return valorConRubrica(renglones.map((id) => niveles[id] as Nivel))
}

/** El valor de una captura binaria: entregó o no entregó. */
export function valorSinRubrica(entregada: boolean): number {
  return entregada ? 1 : 0
}

/*
 * Criterio
 * ========
 */

/** El valor de una actividad para un alumno, con el campo que la agrupa. */
export interface ValorDeActividad {
  campo: CampoFormativo
  valor: number
}

/** El criterio en general y desglosado por campo formativo. */
export interface CalificacionDeCriterio {
  /** Promedio de **todas** las actividades. `null` si no hay ninguna con valor. */
  general: number | null
  /** Solo los campos con al menos una actividad con valor. */
  porCampo: Partial<Record<CampoFormativo, number>>
}

/**
 * El valor de un criterio: el promedio simple de sus actividades. `null` sin
 * ninguna, nunca 0.
 *
 * Quien llama ya excluyó las actividades sin captura y las capturas incompletas
 * —son las que valen `null`—: aquí solo entran valores.
 */
export function valorCriterio(valores: readonly number[]): number | null {
  return promedioDe([...valores])
}

/**
 * El criterio en general y por campo.
 *
 * **El general no es el promedio de los promedios por campo**: es el promedio de
 * todas las actividades. Con seis actividades de Lenguajes y dos de Saberes,
 * Lenguajes pesa el triple, y así debe ser —todas las actividades del criterio
 * valen lo mismo—. Promediar los promedios le daría a cada campo el mismo peso
 * aunque tenga una sola actividad, y el número dejaría de corresponder al trabajo
 * que el alumno hizo (docs/DATA-MODEL.md).
 */
export function calificacionDeCriterio(
  actividades: readonly ValorDeActividad[],
): CalificacionDeCriterio {
  const porCampo: Partial<Record<CampoFormativo, number>> = {}

  for (const campo of new Set(actividades.map((a) => a.campo))) {
    const valor = valorCriterio(
      actividades.filter((a) => a.campo === campo).map((a) => a.valor),
    )
    if (valor !== null) porCampo[campo] = valor
  }

  return { general: valorCriterio(actividades.map((a) => a.valor)), porCampo }
}

/*
 * Examen
 * ======
 */

/**
 * El valor de un campo del examen: aciertos sobre preguntas.
 *
 * `null` cuando el campo no trae preguntas —no lo evaluó el examen— o cuando no
 * hay aciertos capturados. Sin preguntas la división no existe; sin captura, el
 * dato no está.
 */
export function valorExamenPorCampo(
  aciertos: number | undefined,
  preguntas: number,
): number | null {
  if (preguntas <= 0 || aciertos === undefined) return null
  return aciertos / preguntas
}

/**
 * El general del examen: **aciertos totales sobre preguntas totales**, no el
 * promedio de los cuatro campos.
 *
 * Así, un campo de 30 preguntas pesa más que uno de 20, que es el comportamiento
 * correcto: son 50 preguntas del mismo examen. Promediar los campos le daría a
 * cada uno el mismo peso y una calificación distinta a la del papel.
 *
 * `null` mientras falte algún campo por capturar: un examen a medias no produce
 * calificación, igual que una rúbrica a medias.
 */
export function valorExamenGeneral(
  aciertos: Readonly<Partial<Record<CampoFormativo, number>>>,
  preguntas: Readonly<Partial<Record<CampoFormativo, number>>>,
): number | null {
  const campos = camposConPreguntas(preguntas)
  if (!aciertosCompletos(aciertos, campos)) return null

  const totalPreguntas = campos.reduce((acc, c) => acc + (preguntas[c] ?? 0), 0)
  if (totalPreguntas <= 0) return null

  const totalAciertos = campos.reduce((acc, c) => acc + (aciertos[c] ?? 0), 0)
  return totalAciertos / totalPreguntas
}

/*
 * Trimestre
 * =========
 */

/** Lo que un criterio aporta al trimestre: su peso y su valor, si lo tiene. */
export interface ParcialDeCriterio {
  peso: number
  valor: number | null
}

/** La calificación del trimestre y sobre cuánto del trimestre se calculó. */
export interface CalificacionDeTrimestre {
  valor: number | null
  /**
   * La suma de los pesos que sí aportaron. `100` es el trimestre completo; menos
   * significa que hay criterios sin nada capturado todavía.
   */
  pesoConsiderado: number
}

/**
 * La calificación del trimestre: el promedio de los criterios ponderado por sus
 * pesos, **normalizado sobre los pesos que sí aportan**.
 *
 * La normalización es la diferencia entre una cifra útil y una que miente. A mitad
 * del trimestre, con solo Tareas capturado y un peso de 40%, sumar `valor × peso`
 * daría 0.4 —un 4.0 en base 10— para un alumno que lleva todo perfecto. El
 * criterio que todavía no tiene nada capturado no vale cero: no está. Es la misma
 * regla que excluye del promedio a una actividad sin registros
 * (docs/DATA-MODEL.md), aplicada un nivel más arriba.
 *
 * Al cerrar el trimestre los pesos suman 100 y todos los criterios tienen valor,
 * así que ahí normalizar no cambia nada: `pesoConsiderado` sale en 100 y se puede
 * verificar. Ese campo existe justamente para que la pantalla pueda decir sobre
 * cuánto está calculando en vez de dar una cifra sin contexto.
 *
 * Un peso de 0 no aporta aunque el criterio tenga valor: pesa cero.
 */
export function calificacionDeTrimestre(
  parciales: readonly ParcialDeCriterio[],
): CalificacionDeTrimestre {
  const aportan = parciales.filter((p) => p.valor !== null && p.peso > 0)
  const pesoConsiderado = aportan.reduce((acc, p) => acc + p.peso, 0)

  if (pesoConsiderado <= 0) return { valor: null, pesoConsiderado: 0 }

  const suma = aportan.reduce((acc, p) => acc + (p.valor ?? 0) * p.peso, 0)
  return { valor: suma / pesoConsiderado, pesoConsiderado }
}

/*
 * Presentación
 * ============
 */

/** Decimales al presentar. Uno: 8.4 y 8.6 no deben verse iguales (D-018). */
export const DECIMALES = 1

/**
 * De base 1 a base 10, sin redondear.
 *
 * **Sin piso de escala.** El rango completo es 0 a 10 y una calificación menor a 5
 * se muestra tal cual: el modelo es de puntos, y 3 de 10 tareas es un 3.0.
 * Levantarla a 5 sería inventar un dato.
 */
export function aBase10(valor: number): number {
  return valor * 10
}

/**
 * La calificación como la ve la maestra: base 10 con un decimal, y `—` cuando no
 * hay dato.
 *
 * Es el **único** lugar donde se redondea, y por eso el único que puede hacerlo
 * sin acumular error. El porcentaje no aparece nunca: ella ve base 10 en todas las
 * pantallas (docs/DATA-MODEL.md).
 */
export function comoCalificacion(valor: number | null): string {
  if (valor === null) return '—'
  return aBase10(valor).toFixed(DECIMALES)
}
