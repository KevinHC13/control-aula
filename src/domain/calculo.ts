import { promedioDe } from './rules'
import { aciertosCompletos, camposConPreguntas, nivelesCompletos } from './evaluacion'
import { NIVEL_MAXIMO, VALOR_NIVEL } from './values'
import type { CampoFormativo, EstadoAsistencia, Id, Nivel } from './values'

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
 * Criterios automáticos
 * =====================
 *
 * Los tres se **derivan** de lo que ya está capturado y nunca se almacenan
 * (D-020). Ninguno aporta a un campo formativo —un retardo no es de Lenguajes—,
 * así que solo cuentan para el general del trimestre; eso lo resuelve quien los
 * compone, devolviendo su `porCampo` vacío.
 */

/**
 * La puntualidad de un alumno: los días que llegó a tiempo, sobre los días
 * capturados.
 *
 * ```
 * extra = retardosPorFalta === null ? 0 : ⌊retardos ÷ retardosPorFalta⌋
 * valor = máx(0, (días − faltas − extra) ÷ días)
 * ```
 *
 * `justificada` **nunca penaliza**: es la misma regla que ya usa el porcentaje de
 * asistencia, y es el trato con la escuela.
 *
 * `null` sin días capturados, no 0: un alumno del que no hay un solo día no es un
 * alumno impuntual. El `máx(0, …)` existe porque con muchos retardos la resta se
 * pasa —veinte retardos en diez días no es una calificación negativa, es un cero—.
 */
export function valorPuntualidad(
  estados: readonly EstadoAsistencia[],
  retardosPorFalta: number | null,
): number | null {
  const dias = estados.length
  if (dias === 0) return null

  const faltas = estados.filter((e) => e === 'ausente').length
  const retardos = estados.filter((e) => e === 'retardo').length
  const extra = retardosPorFalta === null ? 0 : Math.floor(retardos / retardosPorFalta)

  return Math.max(0, (dias - faltas - extra) / dias)
}

/**
 * La conducta de un alumno, a partir de **cuántos reportes** tiene en el
 * trimestre. Todos los reportes de la bitácora son negativos, así que basta
 * contarlos.
 *
 * | Reportes | Valor | Base 10 |
 * |---|---|---|
 * | 0 o 1 | 1.0 | 10.0 |
 * | 2 | 0.5 | 5.0 |
 * | 3 o más | 0.0 | 0.0 |
 *
 * El primero se deja pasar a propósito (D-020).
 *
 * **Nunca devuelve `null`**, y es el único de los tres que no puede: no tener
 * reportes no es falta de dato, es el dato. Un grupo sin reportes tiene 10.0 de
 * conducta desde el primer día, y eso es correcto —con la consecuencia de que el
 * trimestre deja de mostrar `—` en cuanto el criterio existe—.
 */
export function valorConducta(reportes: number): number {
  if (reportes <= 1) return 1
  if (reportes === 2) return 0.5
  return 0
}

/**
 * La participación de un alumno: **proporcional con tope** contra la meta del
 * trimestre.
 *
 * ```
 * valor = mín(participaciones ÷ meta, 1)
 * ```
 *
 * Con la meta en 5, una participación vale 2.0 y cinco o más valen 10.0. Con tope,
 * porque premiar volumen sin límite convierte el criterio en una carrera entre los
 * tres de siempre; y contra la meta y **no contra el máximo del grupo**, porque un
 * alumno muy participativo hundiría a todos los demás.
 *
 * Dos `null` distintos, y los dos importan:
 *
 * - **Sin meta** el criterio no está configurado y no hay con qué normalizar.
 * - **Sin una sola participación en todo el grupo** ella no usó el criterio ese
 *   trimestre, y calificar a treinta niños con 0.0 por algo que nadie capturó
 *   sería inventar el dato. En cuanto alguien tiene marcas, quien no tiene ninguna
 *   saca 0.0: participar es lo que el criterio mide. `[POR VALIDAR]`
 */
export function valorParticipacion(
  delAlumno: number,
  meta: number | null,
  totalDelGrupo: number,
): number | null {
  if (meta === null || meta <= 0) return null
  if (totalDelGrupo === 0) return null

  return Math.min(delAlumno / meta, 1)
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

/**
 * Cuánto de la calificación final pone un criterio: su valor por la parte del
 * trimestre que le toca.
 *
 * Existe porque el desglose por alumno mostraba «Conducta 40% → 10.0» y el final
 * «4.6», y entre las dos cifras había una multiplicación que había que hacer de
 * cabeza. Con esto la columna **suma exactamente el final**, y se puede verificar
 * de un vistazo.
 *
 * Se divide entre `pesoConsiderado` y no entre 100, por la misma razón que la
 * fórmula del trimestre: cuando falta capturar criterios, el final se normaliza
 * sobre los que sí aportan (D-019), y las aportaciones tienen que sumar ese mismo
 * final o la columna mentiría.
 *
 * `null` cuando el criterio no aporta —sin calificar, o con peso cero—: es lo
 * mismo que devuelve el criterio, y así la pantalla lo pinta igual que el resto de
 * lo que no hay.
 */
export function aportacionAlFinal(
  valor: number | null,
  peso: number,
  pesoConsiderado: number,
): number | null {
  if (valor === null || peso <= 0 || pesoConsiderado <= 0) return null
  return (valor * peso) / pesoConsiderado
}

/**
 * Las aportaciones ajustadas para que, **mostradas con un decimal, sumen exactamente
 * la calificación final**.
 *
 * Sin esto la columna se contradice a la vista: con pesos 40 y 20 sobre 90, las
 * aportaciones reales son 4.44 y 2.22, que mostradas dan «4.4 + 2.2 = 6.6» mientras
 * el total dice 6.7. Quien hace la suma concluye que la app está mal, y deja de
 * confiar en el resto de los números —que sí están bien—.
 *
 * El reparto es por **resto mayor**: se truncan todas a la décima, se cuenta lo que
 * falta para llegar al total y esa diferencia se reparte entre las que quedaron más
 * cerca de subir. Es lo que hace cualquier tabla de porcentajes que tenga que cerrar
 * en 100.
 *
 * Lo que cuesta: una aportación puede salir en 4.5 donde el producto exacto da 4.44.
 * Se acepta a cambio de que la columna cuadre, porque el lector la usa para verificar
 * la suma, no para recalcular el producto —si quisiera el producto tiene el peso y la
 * nota, que están al lado—.
 *
 * Devuelve los valores en base 1, como todo lo demás: `comoCalificacion` sigue siendo
 * el único lugar que redondea.
 */
export function aportacionesQueSuman(
  aportaciones: readonly (number | null)[],
  total: number | null,
): (number | null)[] {
  if (total === null) return aportaciones.map(() => null)

  // Todo en décimas de la base 10, que es la unidad que se muestra: una
  // aportación en base 1 por 100 son las décimas que se ven.
  const enDecimas = aportaciones.map((a) => (a === null ? null : a * 100))
  const objetivo = Math.round(total * 100)

  const truncadas = enDecimas.map((d) => (d === null ? null : Math.floor(d)))
  const yaRepartido = truncadas.reduce<number>((suma, d) => suma + (d ?? 0), 0)

  // Las que están más cerca de la siguiente décima suben primero.
  const porResto = enDecimas
    .map((d, i) => ({ i, resto: d === null ? -1 : d - Math.floor(d) }))
    .filter((x) => x.resto >= 0)
    .sort((a, b) => b.resto - a.resto)

  const ajustadas = [...truncadas]
  let faltan = objetivo - yaRepartido
  for (const { i } of porResto) {
    if (faltan <= 0) break
    ajustadas[i] = (ajustadas[i] ?? 0) + 1
    faltan -= 1
  }

  return ajustadas.map((d) => (d === null ? null : d / 100))
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
