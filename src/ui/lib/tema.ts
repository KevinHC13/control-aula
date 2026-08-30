/**
 * La apariencia que elige la usuaria, y nada más que eso.
 *
 * Es lógica pura a propósito —ni React, ni `localStorage`, ni `document`— para que
 * se pueda probar entera: lo que tiene que ser cierto es que un valor guardado
 * corrupto, de una versión vieja o escrito a mano nunca deje la aplicación sin
 * color, y que **ningún color elegido pueda volver ilegible la pantalla**. Eso se
 * comprueba con funciones, no abriendo el navegador.
 *
 * **Se guarda en el dispositivo, no en la base.** Es preferencia de quien mira la
 * pantalla, no información del salón: meterla en Dexie costaría una versión más del
 * esquema, una tabla más entre las sincronizables y su renglón en el respaldo, para
 * que restaurar en un iPad nuevo le impusiera el tema del viejo.
 */

/* ---------------------------------------------------------------------------
   Contraste. Lo que permite ofrecer un color libre sin romper nada.
   --------------------------------------------------------------------------- */

/** `#rgb` o `#rrggbb`, con o sin almohadilla. Es lo que teclea una persona. */
const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

export function esHexValido(texto: string): boolean {
  return HEX.test(texto.trim())
}

/** Normaliza a `#rrggbb` en minúsculas, o `null` si no es un color. */
export function normalizarHex(texto: string): string | null {
  const limpio = texto.trim().replace(/^#/, '')
  if (!HEX.test(limpio)) return null

  const largo =
    limpio.length === 3
      ? limpio
          .split('')
          .map((c) => c + c)
          .join('')
      : limpio

  return `#${largo.toLowerCase()}`
}

function componentes(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * Luminancia relativa de la WCAG.
 *
 * **No es la «claridad» de HSL**, y la diferencia es justo la que rompe esto: un
 * amarillo puro y un azul puro tienen la misma claridad en HSL y el amarillo es
 * cuatro veces más luminoso. Ajustar por claridad dejaría pasar un amarillo
 * ilegible con texto blanco encima.
 */
function luminancia(hex: string): number {
  const [r, g, b] = componentes(hex).map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Cuánto contrastan dos colores, de 1 (iguales) a 21 (negro contra blanco). */
export function contraste(a: string, b: string): number {
  const [clara, oscura] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [
    number,
    number,
  ]
  return (clara + 0.05) / (oscura + 0.05)
}

function aHsl(hex: string): [number, number, number] {
  const [r, g, b] = componentes(hex).map((c) => c / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) return [0, 0, l]

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0)) / 6
      : max === g
        ? ((b - r) / d + 2) / 6
        : ((r - g) / d + 4) / 6

  return [h, s, l]
}

function deHsl(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12
    const a = s * Math.min(l, 1 - l)
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(v * 255)
  }
  return `#${[f(0), f(8), f(4)].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

/** El mínimo de la WCAG para texto normal. Debajo de esto, un dato deja de leerse. */
const CONTRASTE_MINIMO = 4.5

/**
 * Acerca o aleja un color del negro hasta que contraste con el texto que va a
 * llevar encima, **conservando su tono**.
 *
 * Es lo que hace posible ofrecer un color libre sin condiciones: quien elige un
 * amarillo canario obtiene un amarillo, oscurecido lo justo para que el número del
 * día seleccionado siga leyéndose. Sin esto habría que rechazar la mitad de los
 * colores, o dejar pasar una pantalla ilegible.
 *
 * Se mueve de uno en uno por la claridad y se para en el primero que cumple: el
 * color queda lo más cerca posible del que se pidió.
 */
export function ajustarParaContraste(hex: string, contra: string): string {
  if (contraste(hex, contra) >= CONTRASTE_MINIMO) return hex

  const [h, s, l] = aHsl(hex)
  // Hacia dónde: si el fondo es claro hay que oscurecer, y al revés.
  const oscurecer = luminancia(contra) > 0.18
  const paso = oscurecer ? -0.01 : 0.01

  for (let i = 1; i <= 100; i++) {
    const nueva = Math.min(1, Math.max(0, l + paso * i))
    const candidato = deHsl(h, s, nueva)
    if (contraste(candidato, contra) >= CONTRASTE_MINIMO) return candidato
    if (nueva === 0 || nueva === 1) break
  }

  // Inalcanzable en teoría —negro sobre blanco da 21:1— pero mejor devolver algo
  // legible que algo que se pidió.
  return oscurecer ? '#000000' : '#ffffff'
}

/* ---------------------------------------------------------------------------
   Lo que se puede elegir.
   --------------------------------------------------------------------------- */

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
 * Los seis colores que se ofrecen hechos.
 *
 * Salen de la familia del propio lápiz bicolor, no de una rueda de color: la
 * aplicación tiene una identidad —papel, tinta, lápiz— y un turquesa fosforescente
 * se vería prestado de otro programa. Quien quiera exactamente el suyo lo teclea:
 * está `PROPIO`.
 */
export const COLORES = [
  { id: 'azul', nombre: 'Azul', claro: '#1b4f9c', oscuro: '#7ba7e8' },
  { id: 'indigo', nombre: 'Índigo', claro: '#4c3a9e', oscuro: '#a99bf0' },
  { id: 'verde', nombre: 'Verde', claro: '#1f6b57', oscuro: '#6cc0a4' },
  { id: 'vino', nombre: 'Vino', claro: '#8e2f4a', oscuro: '#e88ba3' },
  { id: 'ocre', nombre: 'Ocre', claro: '#8a5010', oscuro: '#e0a34e' },
  { id: 'grafito', nombre: 'Grafito', claro: '#3a4046', oscuro: '#b3bcc4' },
] as const satisfies readonly [ColorDeMarca, ...ColorDeMarca[]]

/** El identificador del color libre. No está en `COLORES` porque no es fijo. */
export const PROPIO = 'propio'

export type ModoDeColor = 'claro' | 'oscuro' | 'sistema'
export type TamanoDeTexto = 'normal' | 'grande' | 'mayor'
export type Papel = 'blanco' | 'amarillo'
export type Lineas = 'ninguna' | 'cuadricula' | 'renglones'

export const MODOS = [
  { id: 'claro', nombre: 'Claro' },
  { id: 'oscuro', nombre: 'Oscuro' },
  { id: 'sistema', nombre: 'Según el iPad' },
] as const satisfies readonly { id: ModoDeColor; nombre: string }[]

export const TAMANOS = [
  { id: 'normal', nombre: 'Normal', ejemplo: '16 px' },
  { id: 'grande', nombre: 'Grande', ejemplo: '18 px' },
  { id: 'mayor', nombre: 'Muy grande', ejemplo: '20 px' },
] as const satisfies readonly { id: TamanoDeTexto; nombre: string; ejemplo: string }[]

export const PAPELES = [
  { id: 'blanco', nombre: 'Blanco', muestra: '#fbfaf7' },
  { id: 'amarillo', nombre: 'Amarillo', muestra: '#fcf3d0' },
] as const satisfies readonly { id: Papel; nombre: string; muestra: string }[]

export const LINEAS = [
  { id: 'ninguna', nombre: 'Sin líneas' },
  { id: 'cuadricula', nombre: 'Cuadrícula' },
  { id: 'renglones', nombre: 'Renglones' },
] as const satisfies readonly { id: Lineas; nombre: string }[]

export interface Apariencia {
  color: string
  /** El color libre, en `#rrggbb`. Solo se usa si `color` es `PROPIO`. */
  propio: string
  modo: ModoDeColor
  tamano: TamanoDeTexto
  papel: Papel
  lineas: Lineas
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
  propio: '#1b4f9c',
  modo: 'sistema',
  tamano: 'normal',
  papel: 'blanco',
  lineas: 'cuadricula',
  nombreDelGrupo: '',
}

/** Cuánto crece la raíz. El paso más chico que se nota sin romper ninguna fila. */
const ESCALAS: Record<TamanoDeTexto, string> = {
  normal: '100%',
  grande: '112.5%',
  mayor: '125%',
}

/** El fondo de cada papel, para poder ajustar contra él sin leer el CSS. */
const FONDOS: Record<Papel, { claro: string; oscuro: string }> = {
  blanco: { claro: '#fbfaf7', oscuro: '#15181b' },
  amarillo: { claro: '#fcf3d0', oscuro: '#1a1712' },
}

export function fondoDe(apariencia: Apariencia, oscuro: boolean): string {
  return oscuro ? FONDOS[apariencia.papel].oscuro : FONDOS[apariencia.papel].claro
}

/**
 * El color de la marca, ya listo para pintarse.
 *
 * Un color de la lista trae sus dos tonos hechos. Uno libre se **ajusta**: se
 * oscurece o se aclara lo justo para contrastar con el papel del modo en que se
 * está, conservando su tono. Así no hay ningún color que la usuaria pueda elegir y
 * deje la pantalla sin leerse.
 */
export function marcaDe(apariencia: Apariencia, oscuro: boolean): string {
  if (apariencia.color === PROPIO) {
    const suyo = normalizarHex(apariencia.propio) ?? POR_OMISION.propio
    return ajustarParaContraste(suyo, fondoDe(apariencia, oscuro))
  }

  const color = COLORES.find((c) => c.id === apariencia.color) ?? COLORES[0]
  return oscuro ? color.oscuro : color.claro
}

/** El color elegido de la lista, o el de siempre. `PROPIO` no está aquí. */
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

/** «3.º B» cabe de sobra; un párrafo en la cabecera, no. */
export const LARGO_DEL_NOMBRE = 40

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
  const conocido = guardado.color === PROPIO || COLORES.some((c) => c.id === guardado.color)

  return {
    color: conocido ? (guardado.color as string) : POR_OMISION.color,
    propio:
      typeof guardado.propio === 'string'
        ? (normalizarHex(guardado.propio) ?? POR_OMISION.propio)
        : POR_OMISION.propio,
    modo: MODOS.some((m) => m.id === guardado.modo)
      ? (guardado.modo as ModoDeColor)
      : POR_OMISION.modo,
    tamano: TAMANOS.some((t) => t.id === guardado.tamano)
      ? (guardado.tamano as TamanoDeTexto)
      : POR_OMISION.tamano,
    papel: PAPELES.some((p) => p.id === guardado.papel)
      ? (guardado.papel as Papel)
      : POR_OMISION.papel,
    lineas: leerLineas(guardado),
    nombreDelGrupo:
      typeof guardado.nombreDelGrupo === 'string'
        ? guardado.nombreDelGrupo.slice(0, LARGO_DEL_NOMBRE)
        : POR_OMISION.nombreDelGrupo,
  }
}

/**
 * El fondo del papel pasó de ser un interruptor —`cuadricula: true`— a tres
 * opciones, porque una libreta de verdad puede tener cuadrícula o renglones.
 *
 * Quien ya tenía una preferencia guardada no la pierde: el `true` de antes es la
 * cuadrícula de antes. Migrar aquí y no en el arranque es lo que evita tener que
 * acordarse de esto nunca más.
 */
function leerLineas(guardado: Record<string, unknown>): Lineas {
  if (LINEAS.some((l) => l.id === guardado.lineas)) return guardado.lineas as Lineas
  if (typeof guardado.cuadricula === 'boolean') {
    return guardado.cuadricula ? 'cuadricula' : 'ninguna'
  }
  return POR_OMISION.lineas
}
