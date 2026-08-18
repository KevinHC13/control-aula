/**
 * La medida de la tira de días. Vive aparte del componente para poder probar la
 * aritmética sin montar React.
 */

/** Ancho de la caja de un día, en px: la clase `w-12` de `TiraDeDias`. */
export const ANCHO_DIA = 48

/** Separación entre cajas, en px: la clase `gap-2`. */
export const SEPARACION = 8

/** Días que pinta la tira mientras no se ha medido el ancho real. */
export const DIAS_DE_RESPALDO = 7

/**
 * Cuántas cajas de día caben en `ancho`. `n` cajas ocupan `n` anchos más `n - 1`
 * separaciones, de ahí el `+ SEPARACION` antes de dividir.
 *
 * Nunca menos de una: una tira vacía dejaría a la maestra sin forma de volver al
 * día de hoy.
 */
export function cuantosDiasCaben(ancho: number): number {
  return Math.max(1, Math.floor((ancho + SEPARACION) / (ANCHO_DIA + SEPARACION)))
}
