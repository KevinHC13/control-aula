import type { Id } from './values'

/**
 * El sorteo de participación: elegir a quién le toca pasar, **ponderado a favor
 * de quien menos ha participado** (D-021).
 *
 * Es una regla de aula, no de software. Un sorteo uniforme repite —treinta tiros
 * y alguien sale tres veces mientras otro no sale ninguna— y los niños lo notan
 * antes que nadie. Ponderado empuja hacia donde el criterio quiere llegar y se
 * puede decir en voz alta: *le toca a quien menos ha pasado*.
 *
 * El azar entra como argumento y no se genera aquí: `domain/` es puro y
 * `Math.random()` haría estas funciones imposibles de probar. Quien llama pasa un
 * número en `[0, 1)`.
 */

/** Un participante del sorteo: solo lo que decide su probabilidad. */
export interface Candidato {
  id: Id
  /** Cuántas participaciones lleva en el trimestre. */
  participaciones: number
}

/**
 * El peso de un candidato: `máximo + 1 − sus participaciones`.
 *
 * El `+ 1` es lo que evita que quien va a la cabeza quede con peso cero y no
 * pueda salir nunca: el sorteo favorece, no excluye. Con el grupo empatado todos
 * pesan lo mismo, que es el sorteo uniforme —el caso en que ponderar no cambia
 * nada—.
 *
 * Ejemplo: con un máximo de 5, quien no ha participado pesa 6 y quien lleva 5
 * pesa 1, así que sale seis veces menos seguido.
 */
export function pesoDeCandidato(participaciones: number, maximo: number): number {
  return Math.max(1, maximo + 1 - participaciones)
}

/**
 * Elige un candidato con probabilidad proporcional a su peso. `null` sin
 * candidatos —nadie presente, o sin lista cargada—, que es un resultado normal y
 * no un error.
 *
 * `azar` viene en `[0, 1)`; se acota por si llega justo en 1, para que el último
 * tramo no se salga del arreglo.
 */
export function elegirPonderado(candidatos: readonly Candidato[], azar: number): Id | null {
  if (candidatos.length === 0) return null

  const maximo = Math.max(...candidatos.map((c) => c.participaciones))
  const pesos = candidatos.map((c) => pesoDeCandidato(c.participaciones, maximo))
  const total = pesos.reduce((suma, peso) => suma + peso, 0)

  let restante = Math.min(Math.max(azar, 0), 0.999999) * total
  for (const [i, peso] of pesos.entries()) {
    restante -= peso
    if (restante < 0) return candidatos[i]!.id
  }

  // Inalcanzable con `azar` acotado; el último es la respuesta correcta si el
  // redondeo del flotante se pasa por un pelo.
  return candidatos[candidatos.length - 1]!.id
}
