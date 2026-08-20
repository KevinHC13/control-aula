import type { CriterioTrimestre, Trimestre } from './entities'
import type { Fecha } from './values'

/**
 * Reglas de estructura de la evaluación: qué trimestre le toca a una fecha, si
 * los pesos cierran, si un periodo acepta escrituras. Funciones puras, sin
 * acceso a base de datos.
 *
 * La cadena de cálculo de calificaciones —rúbricas, criterios, examen, base 10—
 * llega en C28 y vive aparte. Este archivo es la estructura, no los números.
 *
 * Los parámetros piden solo los campos que usan (`Pick<...>`) en vez de la
 * entidad completa. Una entidad la satisface por estructura, así que no cuesta
 * nada en los llamadores, y las pruebas no tienen que inventar `id`,
 * `updated_at` y `deleted_at` para preguntar si dos rangos se traslapan.
 */

type Rango = Pick<Trimestre, 'inicio' | 'fin'>
type RangoDeCiclo = Rango & Pick<Trimestre, 'ciclo_id'>

/** El total corriente de pesos, que se muestra mientras ella edita. */
export function sumaDePesos(criterios: readonly Pick<CriterioTrimestre, 'peso'>[]): number {
  return criterios.reduce((acc, c) => acc + c.peso, 0)
}

/**
 * Si los pesos del trimestre cierran en 100.
 *
 * Es requisito para **cerrar** el trimestre, no para guardar: editar pesos pasa
 * siempre por estados intermedios inválidos, y bloquear el guardado obligaría a
 * dejar la pantalla cuadrada antes de poder salir de ella.
 *
 * La comparación tolera error de punto flotante. Con pesos enteros no haría
 * falta, pero 33.4 + 33.3 + 33.3 no da exactamente 100 en binario y negarle el
 * cierre por eso sería un error que ella no podría corregir.
 */
export function pesosSuman100(criterios: readonly Pick<CriterioTrimestre, 'peso'>[]): boolean {
  return Math.abs(sumaDePesos(criterios) - 100) < 1e-9
}

/**
 * Si el rango del trimestre está bien formado. Un trimestre que termina antes de
 * empezar no contiene ninguna fecha, así que no atribuiría ningún registro.
 */
export function rangoValido(t: Rango): boolean {
  return t.inicio <= t.fin
}

/**
 * Si la fecha cae dentro del trimestre, extremos incluidos.
 *
 * Comparar `Fecha` como cadena ordena bien: ISO-8601 con ceros a la izquierda es
 * lexicográficamente igual que cronológicamente.
 */
export function contieneFecha(t: Rango, fecha: Fecha): boolean {
  return fecha >= t.inicio && fecha <= t.fin
}

/**
 * El trimestre al que pertenece una fecha, o `null`.
 *
 * `null` es un resultado normal, no un error: las vacaciones y los puentes caen
 * fuera de todo rango. Un registro con esa fecha existe y se muestra, pero no
 * cuenta para ningún trimestre.
 */
export function trimestreDeFecha<T extends Rango>(
  fecha: Fecha,
  trimestres: readonly T[],
): T | null {
  return trimestres.find((t) => contieneFecha(t, fecha)) ?? null
}

/** Si dos rangos comparten al menos un día. */
export function seTraslapan(a: Rango, b: Rango): boolean {
  return a.inicio <= b.fin && b.inicio <= a.fin
}

/**
 * Los pares de trimestres del **mismo ciclo** que se traslapan.
 *
 * La regla se verifica por ciclo y no globalmente: el T1 de 2027–2028 empieza
 * mucho después del T3 de 2026–2027, pero nada impide que dos ciclos se
 * traslapen entre sí en una base con historia.
 *
 * Devuelve los pares y no un booleano para que la pantalla pueda decir *cuáles*
 * chocan. Vacío significa que el ciclo es consistente.
 */
export function traslapes<T extends RangoDeCiclo>(trimestres: readonly T[]): [T, T][] {
  const pares: [T, T][] = []

  for (let i = 0; i < trimestres.length; i++) {
    for (let j = i + 1; j < trimestres.length; j++) {
      const a = trimestres[i]
      const b = trimestres[j]
      if (!a || !b) continue
      if (a.ciclo_id !== b.ciclo_id) continue
      if (seTraslapan(a, b)) pares.push([a, b])
    }
  }

  return pares
}

/**
 * Si el periodo acepta escrituras. Un trimestre cerrado las rechaza todas: sus
 * calificaciones ya salieron en una boleta.
 */
export function aceptaEscrituras(t: Pick<Trimestre, 'estado'>): boolean {
  return t.estado === 'abierto'
}

/**
 * Si el trimestre se puede cerrar. Un trimestre sin criterios no se cierra
 * aunque la suma dé cero: cerrarlo escribiría un snapshot vacío que después
 * nadie podría distinguir de un trimestre bien cerrado en el que todos sacaron 0.
 */
export function puedeCerrarse(
  t: Pick<Trimestre, 'estado'>,
  criterios: readonly Pick<CriterioTrimestre, 'peso'>[],
): boolean {
  if (!aceptaEscrituras(t)) return false
  if (criterios.length === 0) return false
  return pesosSuman100(criterios)
}
