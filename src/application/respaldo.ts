import { repos } from '@/data'
import type { ConteoPorTabla, VolcadoDeTablas } from '@/data/ports/respaldo'
import { fechaLocal } from '@/domain/fechas'
import type { Fecha, Instante } from '@/domain/values'

/**
 * El respaldo en JSON: la única forma de que el año no viva en un solo iPad.
 *
 * No es sincronía ni la reemplaza (C16). Es un archivo que ella guarda en
 * Archivos o en su correo, y que restaura en un dispositivo nuevo. Sin esto, un
 * iPad perdido —o el ícono borrado de la pantalla de inicio, que se lleva
 * IndexedDB con él— es el ciclo escolar completo perdido (docs/PWA-IOS.md).
 */

/** La marca que distingue un respaldo de esta app de cualquier otro JSON. */
export const MARCA = 'palomita/respaldo'

/**
 * El archivo, con todo lo que hace falta para decidir si se puede restaurar
 * **antes** de escribir una sola fila.
 *
 * `esquema` es lo que permite negarse a un archivo hecho con una versión más
 * nueva de la app: sus tablas pueden tener campos que esta versión no sabe leer,
 * y escribirlos a medias es peor que no restaurar.
 */
export interface ArchivoDeRespaldo {
  app: typeof MARCA
  esquema: number
  generado_en: Instante
  tablas: VolcadoDeTablas
}

/** Todo lo que hay en el dispositivo, listo para escribirse a un archivo. */
export async function armarRespaldo(): Promise<ArchivoDeRespaldo> {
  return {
    app: MARCA,
    esquema: repos.respaldo.versionDelEsquema(),
    generado_en: new Date().toISOString(),
    tablas: await repos.respaldo.volcar(),
  }
}

/**
 * El nombre del archivo lleva la fecha del dispositivo, no un consecutivo: en
 * Archivos, «palomita-2026-12-18.json» se ordena solo y se reconoce sin abrirlo.
 */
export function nombreDeArchivo(
  hoy: Fecha = fechaLocal(new Date()),
  grupo = '',
): string {
  // Con varios respaldos en la misma carpeta de Archivos, la fecha sola no dice
  // de qué grupo es cada uno. Se limpia lo que no cabe en un nombre de archivo
  // —acentos, barras, dos puntos— en vez de rechazarlo: quien escribe «3.º B» no
  // tiene por qué saber qué caracteres admite iPadOS.
  const etiqueta = grupo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return etiqueta === ''
    ? `palomita-${hoy}.json`
    : `palomita-${etiqueta}-${hoy}.json`
}

/** Cuántos registros trae el archivo, para poder decirlo antes de restaurar. */
export function contarRegistros(archivo: ArchivoDeRespaldo): number {
  return Object.values(archivo.tablas).reduce((total, filas) => total + filas.length, 0)
}

/**
 * Lee y **juzga** el texto de un archivo. Devuelve el respaldo o lanza un error
 * con un mensaje que la pantalla puede mostrar tal cual: aquí no hay
 * programadores leyendo la consola.
 *
 * Valida antes de escribir, y no mientras escribe, porque restaurar es una sola
 * transacción: descubrir en la fila 2 000 que el archivo estaba roto significa
 * deshacer todo, y descubrirlo antes significa no haber empezado.
 */
export function leerRespaldo(texto: string, esquemaLocal: number): ArchivoDeRespaldo {
  let crudo: unknown
  try {
    crudo = JSON.parse(texto)
  } catch {
    throw new Error('El archivo está dañado o no es un respaldo de Palomita')
  }

  if (typeof crudo !== 'object' || crudo === null) {
    throw new Error('Este archivo no es un respaldo de Palomita')
  }

  const posible = crudo as Partial<ArchivoDeRespaldo>

  if (posible.app !== MARCA) {
    throw new Error('El archivo no es un respaldo de Palomita')
  }

  if (typeof posible.esquema !== 'number') {
    throw new Error('El respaldo no indica de qué versión de la aplicación viene')
  }

  if (posible.esquema > esquemaLocal) {
    // Al revés sí se puede: un respaldo viejo trae menos tablas y menos campos,
    // y los que falten se leen como ausentes, que es lo que ya hace la app con
    // los datos de antes de cada migración.
    throw new Error(
      `El respaldo viene de una versión más nueva de la app (esquema ${posible.esquema}, ` +
        `esta app usa ${esquemaLocal}). Actualiza la app antes de restaurar.`,
    )
  }

  if (
    typeof posible.tablas !== 'object' ||
    posible.tablas === null ||
    Object.values(posible.tablas).some((filas) => !Array.isArray(filas))
  ) {
    throw new Error('El respaldo está incompleto o dañado')
  }

  return {
    app: MARCA,
    esquema: posible.esquema,
    generado_en: typeof posible.generado_en === 'string' ? posible.generado_en : '',
    tablas: posible.tablas,
  }
}

/** La versión del esquema de este dispositivo, para juzgar un archivo. */
export function esquemaLocal(): number {
  return repos.respaldo.versionDelEsquema()
}

/**
 * Escribe el respaldo en la base. Devuelve cuántas filas quedaron por tabla, que
 * es lo que la pantalla enseña después: «restauré» sin números no se puede creer.
 *
 * No borra lo que el archivo no trae. Restaurar en un dispositivo con datos
 * **mezcla**: es lo correcto para el caso que existe —recuperar lo perdido— y
 * quien quiera empezar limpio desinstala la app, que en iPadOS se lleva
 * IndexedDB con ella.
 */
export async function restaurarRespaldo(
  archivo: ArchivoDeRespaldo,
): Promise<ConteoPorTabla> {
  return repos.respaldo.restaurar(archivo.tablas)
}

/**
 * **TEMPORAL — a petición del usuario, hasta que la base del iPad esté limpia.**
 *
 * Deja el dispositivo en cero. Existe por un motivo concreto y acotado: en el
 * iPad no hay consola con la que borrar IndexedDB a mano, y la app venía
 * arrancando con un grupo de ejemplo que hay que sacar una vez antes de empezar
 * con datos reales (D-024).
 *
 * No pide confirmación aquí. La pide la pantalla, que es quien puede explicar
 * qué se pierde antes de que se pierda.
 */
export async function borrarTodo(): Promise<ConteoPorTabla> {
  return repos.respaldo.vaciar()
}

/** Cuántas filas se borraron en total, para poder decirlo con un número. */
export function totalBorrado(conteo: ConteoPorTabla): number {
  return Object.values(conteo).reduce((total, filas) => total + filas, 0)
}
