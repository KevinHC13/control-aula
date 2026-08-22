import { repos } from '@/data'
import type { ConteoPorTabla } from '@/data/ports/respaldo'
import type { LotePorSubir } from '@/data/ports/sincronia'
import {
  bajarFilas,
  entrar as entrarALaNube,
  salir as salirDeLaNube,
  type Sesion,
  sesionGuardada,
  subirFilas,
} from '@/services/sincronia'
import { nubeConfigurada } from '@/services/supabase'

/**
 * El motor de sincronía: subir lo pendiente y restaurar todo.
 *
 * Dos operaciones y ninguna más (docs/DECISIONES.md D-006): un usuario y un
 * dispositivo no producen conflictos, así que no hay merge, ni
 * last-write-wins, ni vectores de versión.
 *
 * **No pasa por el repositorio de casos de uso.** Este archivo es el único que
 * junta las dos mitades —la `outbox` de `data/` y la red de `services/`— y lo hace
 * sin volver a «marcar asistencia» ni «calificar»: sube filas y las escribe tal
 * cual. Restaurar reusa el camino del respaldo en JSON, que ya es un upsert por
 * `id` que no encola nada (D-022).
 *
 * El login se pide aquí y no al arrancar: sin sesión la app funciona idéntico
 * contra los datos locales, y la nube es un respaldo, no una dependencia (D-023).
 */

/** De a cuántos cambios se sube. Un trimestre entero son miles de filas. */
export const TOPE_DEL_LOTE = 200

/** Cuántas rondas de lote se permiten antes de rendirse. Es el freno de un ciclo. */
const RONDAS_MAXIMAS = 200

export type { Sesion }

/** Si el dispositivo tiene con qué hablarle a la nube: `.env` lleno. */
export function hayNube(): boolean {
  return nubeConfigurada()
}

/** La sesión guardada, si hay. Es lo que decide si la pantalla pide el login. */
export async function sesion(): Promise<Sesion | null> {
  return sesionGuardada()
}

export async function entrar(correo: string, contrasena: string): Promise<Sesion> {
  const limpio = correo.trim()
  if (limpio === '' || contrasena === '') {
    throw new Error('Hay que escribir el correo y la contraseña')
  }
  return entrarALaNube(limpio, contrasena)
}

export async function salir(): Promise<void> {
  await salirDeLaNube()
}

/** Cuántos cambios esperan turno. La pantalla la enseña antes de subir. */
export async function pendientes(): Promise<number> {
  return repos.sincronia.cuantosPendientes()
}

/** Lo que dejó una subida, para poder decirlo sin adornos. */
export interface ResultadoDeSubida {
  /** Cambios sacados de la `outbox`, ya confirmados por el servidor. */
  subidos: number
  /** Los que quedaron sin subir. Con red buena es cero. */
  pendientes: number
}

/**
 * Sube lo que haya en la `outbox`, por lotes, hasta vaciarla.
 *
 * El orden importa y es la mitad del commit: se sube el lote, **el servidor
 * contesta**, y solo entonces se saca de la `outbox`. Una cola que se vacía al
 * mandar la petición pierde lo capturado en cuanto la red falla, que es
 * exactamente lo que no puede pasar en una app cuyo único ejemplar de los datos
 * vive en un iPad.
 *
 * Si un lote falla, se propaga el error con la cola intacta: el siguiente intento
 * empieza donde este se quedó, sin duplicar nada —todo es upsert por `id`—.
 */
export async function subirPendientes(): Promise<ResultadoDeSubida> {
  let subidos = 0

  for (let ronda = 0; ronda < RONDAS_MAXIMAS; ronda++) {
    const lote = await repos.sincronia.lotePorSubir(TOPE_DEL_LOTE)
    if (lote.cambios.length === 0) break

    for (const [tabla, filas] of Object.entries(lote.filas)) {
      await subirFilas(tabla, filas)
    }

    await repos.sincronia.confirmar(lote.cambios.map((c) => c.seq))
    subidos += lote.cambios.length
  }

  return { subidos, pendientes: await repos.sincronia.cuantosPendientes() }
}

/**
 * Baja todo y lo escribe encima de lo local.
 *
 * Es la operación de *cambié de iPad* o *reinstalé*, no una lectura de todos los
 * días: trae las dieciséis tablas completas, borrados incluidos, y las pasa por el
 * mismo `restaurar` del respaldo en JSON —upsert por `id`, sin borrar lo que la
 * nube no traiga y sin encolar nada—.
 */
export async function restaurarDeLaNube(): Promise<ConteoPorTabla> {
  const tablas: Record<string, unknown[]> = {}

  for (const tabla of repos.sincronia.tablasSincronizables()) {
    tablas[tabla] = await bajarFilas(tabla)
  }

  return repos.respaldo.restaurar(tablas)
}

/**
 * Sube si hay sesión y hay algo que subir. Es la que se llama al abrir la app, al
 * mandarla a segundo plano y al recuperar la red, y por eso **no lanza**: un fallo
 * de red no puede ser un error en la cara de nadie cuando nadie pidió sincronizar
 * —los cambios se quedan en la cola, que es su trabajo—.
 *
 * Devuelve `null` cuando no hizo nada: sin nube configurada, sin sesión o con la
 * cola vacía.
 */
export async function sincronizarSiSePuede(): Promise<ResultadoDeSubida | null> {
  if (!hayNube()) return null

  try {
    if ((await sesionGuardada()) === null) return null
    if ((await repos.sincronia.cuantosPendientes()) === 0) return null

    return await subirPendientes()
  } catch {
    // En silencio a propósito: esto corre sin que nadie lo haya pedido.
    return null
  }
}

/**
 * Cuántas filas distintas viajan en un lote. Se cuenta para poder decirlo, y
 * porque no coincide con los cambios: la `outbox` encola un cambio por toque, así
 * que ciclar el estado de un alumno cinco veces son cinco cambios y una sola fila.
 */
export function filasDelLote(lote: LotePorSubir): number {
  return Object.values(lote.filas).reduce((total, filas) => total + filas.length, 0)
}
