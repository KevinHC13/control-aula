/**
 * La apariencia que elige la usuaria, y nada más que eso.
 *
 * Es lógica pura a propósito —ni React, ni `localStorage`, ni `document`— para que
 * se pueda probar entera: lo que tiene que ser cierto es que un valor guardado
 * corrupto, de una versión vieja o escrito a mano nunca deje la aplicación sin
 * color, y eso se comprueba con una función, no abriendo el navegador.
 *
 * **Se guarda en el dispositivo, no en la base.** Es preferencia de quien mira la
 * pantalla, no información del salón: meterla en Dexie costaría una versión más del
 * esquema, una tabla más entre las sincronizables y su renglón en el respaldo, para
 * que restaurar en un iPad nuevo le impusiera el tema del viejo.
 */

/** Un color de la aplicación, con su versión para fondo claro y para fondo oscuro. */
export interface ColorDeMarca {
  id: string
  nombre: string
  /** Sobre papel. Contrasta al menos 4.5:1 con el texto blanco que lleva encima. */
  claro: string
  /** Sobre fondo oscuro, aclarado: el tono de papel no se ve contra la tinta. */
  oscuro: string
}

/**
 * Los seis colores que se ofrecen.
 *
 * Salen de la familia del propio lápiz bicolor, no de una rueda de color: la
 * aplicación tiene una identidad —papel, tinta, lápiz— y un turquesa fosforescente
 * se vería prestado de otro programa. Todos pasan 4.5:1 contra el texto que llevan
 * encima, en los dos modos; si no, el día seleccionado de la tira dejaría de leerse.
 */
export const COLORES = [
  { id: 'azul', nombre: 'Azul', claro: '#1b4f9c', oscuro: '#7ba7e8' },
  { id: 'indigo', nombre: 'Índigo', claro: '#4c3a9e', oscuro: '#a99bf0' },
  { id: 'verde', nombre: 'Verde', claro: '#1f6b57', oscuro: '#6cc0a4' },
  { id: 'vino', nombre: 'Vino', claro: '#8e2f4a', oscuro: '#e88ba3' },
  { id: 'ocre', nombre: 'Ocre', claro: '#8a5010', oscuro: '#e0a34e' },
  { id: 'grafito', nombre: 'Grafito', claro: '#3a4046', oscuro: '#b3bcc4' },
] as const satisfies readonly [ColorDeMarca, ...ColorDeMarca[]]

export type ModoDeColor = 'claro' | 'oscuro' | 'sistema'
export type TamanoDeTexto = 'normal' | 'grande' | 'mayor'

export interface Apariencia {
  color: string
  modo: ModoDeColor
  tamano: TamanoDeTexto
  cuadricula: boolean
  nombreDelGrupo: string
}

/**
 * Lo que se ve sin haber elegido nada: exactamente la aplicación de siempre.
 *
 * La cuadrícula nace **encendida** porque es la identidad que docs/UX.md describe
 * desde el principio —la referencia al cuaderno que la aplicación reemplaza—, no un
 * adorno que haya que ir a buscar.
 */
export const POR_OMISION: Apariencia = {
  color: 'azul',
  modo: 'sistema',
  tamano: 'normal',
  cuadricula: true,
  nombreDelGrupo: '',
}

/** Cuánto crece la raíz. El paso más chico que se nota sin romper ninguna fila. */
const ESCALAS: Record<TamanoDeTexto, string> = {
  normal: '100%',
  grande: '112.5%',
  mayor: '125%',
}

export const TAMANOS: readonly { id: TamanoDeTexto; nombre: string; ejemplo: string }[] = [
  { id: 'normal', nombre: 'Normal', ejemplo: '16 px' },
  { id: 'grande', nombre: 'Grande', ejemplo: '18 px' },
  { id: 'mayor', nombre: 'Muy grande', ejemplo: '20 px' },
]

export const MODOS: readonly { id: ModoDeColor; nombre: string }[] = [
  { id: 'claro', nombre: 'Claro' },
  { id: 'oscuro', nombre: 'Oscuro' },
  { id: 'sistema', nombre: 'Según el iPad' },
]

/** El color elegido, o el de siempre si el guardado ya no existe. */
export function colorDe(apariencia: Apariencia): ColorDeMarca {
  return COLORES.find((c) => c.id === apariencia.color) ?? COLORES[0]
}

export function escalaDe(apariencia: Apariencia): string {
  return ESCALAS[apariencia.tamano]
}

/**
 * Si toca pintar oscuro, contando lo que dice el dispositivo cuando el modo es
 * «según el iPad». Se pasa `prefiereOscuro` en vez de consultar `matchMedia` aquí
 * para que esto siga siendo una función pura.
 */
export function tocaOscuro(apariencia: Apariencia, prefiereOscuro: boolean): boolean {
  if (apariencia.modo === 'oscuro') return true
  if (apariencia.modo === 'claro') return false
  return prefiereOscuro
}

/**
 * Lee lo guardado campo por campo.
 *
 * **Nunca lanza y nunca devuelve algo a medias.** Un JSON roto, una clave que ya no
 * existe o un color que se quitó de la lista caen al valor de siempre en ese campo
 * y dejan los demás en pie: quedarse sin color de marca por un carácter de más en
 * `localStorage` sería perder la aplicación entera por una preferencia.
 */
export function leerApariencia(crudo: string | null): Apariencia {
  if (crudo === null || crudo === '') return POR_OMISION

  let dato: unknown
  try {
    dato = JSON.parse(crudo)
  } catch {
    return POR_OMISION
  }
  if (typeof dato !== 'object' || dato === null || Array.isArray(dato)) return POR_OMISION

  const guardado = dato as Record<string, unknown>

  return {
    color: COLORES.some((c) => c.id === guardado.color)
      ? (guardado.color as string)
      : POR_OMISION.color,
    modo: MODOS.some((m) => m.id === guardado.modo)
      ? (guardado.modo as ModoDeColor)
      : POR_OMISION.modo,
    tamano: TAMANOS.some((t) => t.id === guardado.tamano)
      ? (guardado.tamano as TamanoDeTexto)
      : POR_OMISION.tamano,
    cuadricula:
      typeof guardado.cuadricula === 'boolean'
        ? guardado.cuadricula
        : POR_OMISION.cuadricula,
    nombreDelGrupo:
      typeof guardado.nombreDelGrupo === 'string'
        ? guardado.nombreDelGrupo.slice(0, LARGO_DEL_NOMBRE)
        : POR_OMISION.nombreDelGrupo,
  }
}

/** «3.º B» cabe de sobra; un párrafo en la cabecera, no. */
export const LARGO_DEL_NOMBRE = 40
