/**
 * Formar equipos: repartir a los alumnos en grupos, con el sobrante repartido y
 * sin equipos vacíos (D-021).
 *
 * Funciones puras, y el azar entra como **semilla**: el `Math.random()` vive en
 * la pantalla y aquí se convierte en una secuencia determinista, así que un
 * reparto se puede reproducir en una prueba. Es el mismo trato que en
 * `sorteo.ts`.
 *
 * Nada de esto se guarda: los equipos son estado de interfaz y viven mientras la
 * pantalla está abierta. Guardarlos significaría una tabla, una fecha y una
 * pantalla de historial, y eso solo se paga el día que pida «los equipos de
 * ayer».
 */

/**
 * Generador determinista a partir de una semilla (mulberry32).
 *
 * Doce líneas de aritmética en vez de `Math.random()` porque `domain/` tiene que
 * ser reproducible: con la misma semilla, el mismo reparto, y una prueba puede
 * afirmar quién quedó con quién.
 */
function aleatorioDe(semilla: number): () => number {
  let estado = Math.floor(semilla * 2 ** 32) || 1

  return () => {
    estado = (estado + 0x6d2b79f5) | 0
    let t = estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Los elementos en otro orden. Fisher–Yates, que es el único barajado que reparte
 * uniforme: ordenar por un número al azar sesga y además depende de cómo esté
 * implementado el `sort`.
 */
export function mezclar<T>(items: readonly T[], semilla: number): T[] {
  const azar = aleatorioDe(semilla)
  const copia = [...items]

  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j]!, copia[i]!]
  }

  return copia
}

/**
 * De cuántos queda cada equipo. **El sobrante se reparte**: con 30 alumnos y 4
 * equipos toca 8, 8, 7 y 7, nunca 8, 8, 8 y 6 —un equipo de dos contra tres de
 * ocho no es un reparto, es un castigo—.
 *
 * Nunca devuelve un equipo vacío: pedir más equipos que alumnos da tantos equipos
 * como alumnos haya, y quien llama compara para poder decirlo.
 */
export function tamanos(total: number, equipos: number): number[] {
  if (total <= 0 || equipos <= 0) return []

  const cuantos = Math.min(equipos, total)
  const base = Math.floor(total / cuantos)
  const sobrante = total % cuantos

  return Array.from({ length: cuantos }, (_, i) => base + (i < sobrante ? 1 : 0))
}

/**
 * Cuántos equipos salen si ella pide *tantos niños por equipo*. Es el mismo dato
 * visto al revés, y por eso vive junto al otro: con 30 alumnos de 4 en 4 son 8
 * equipos —el último de 2— que `tamanos` va a volver a repartir en 4, 4, 4, 4, 4,
 * 4, 3 y 3.
 */
export function equiposPara(total: number, porEquipo: number): number {
  if (total <= 0 || porEquipo <= 0) return 0
  return Math.ceil(total / porEquipo)
}

/**
 * Reparte los elementos en equipos, mezclados. Los tamaños salen de `tamanos`, así
 * que el sobrante ya viene repartido y no hay equipos vacíos.
 */
export function repartir<T>(
  items: readonly T[],
  equipos: number,
  semilla: number,
): T[][] {
  const mezclados = mezclar(items, semilla)
  const reparto: T[][] = []

  let desde = 0
  for (const cuantos of tamanos(items.length, equipos)) {
    reparto.push(mezclados.slice(desde, desde + cuantos))
    desde += cuantos
  }

  return reparto
}
