/**
 * Tipos base del dominio. Este archivo no importa nada: ni React, ni Dexie, ni
 * librerías. Ver docs/ARCHITECTURE.md.
 */

/** ISO 8601, solo fecha: "2026-08-18" */
export type Fecha = string

/** UUID v4 generado en el cliente con `crypto.randomUUID()` */
export type Id = string

/** ISO 8601 completo en UTC: "2026-08-18T14:32:07.123Z" */
export type Instante = string

export type EstadoAsistencia = 'presente' | 'ausente' | 'retardo' | 'justificada'

/**
 * Orden del ciclo al tocar una fila de asistencia. Cuatro estados es el límite:
 * un quinto vuelve el ciclo más lento que un menú (docs/UX.md).
 */
export const CICLO_ESTADOS = [
  'presente',
  'ausente',
  'retardo',
  'justificada',
] as const satisfies readonly EstadoAsistencia[]

/**
 * Campos base de todo registro sincronizable.
 *
 * - `updated_at` se reescribe en cada mutación, sin excepción: es lo único que
 *   le dice al motor de sincronía qué falta subir.
 * - `deleted_at` implementa el borrado suave; toda lectura filtra
 *   `deleted_at === null`.
 */
export interface Sincronizable {
  id: Id
  updated_at: Instante
  deleted_at: Instante | null
}

/**
 * Suscripción mínima, declarada aquí para que `data/ports/` no tenga que
 * importar el `Observable` de Dexie: la reactividad es parte del contrato del
 * puerto, no un detalle del adaptador (docs/ARCHITECTURE.md).
 *
 * El observable de Dexie satisface esta interfaz sin adaptación. Un adaptador
 * de Supabase la cumpliría con Realtime, y uno de SQL con un emisor propio
 * invalidado tras cada escritura.
 */
export interface Suscribible<T> {
  subscribe(next: (valor: T) => void): { unsubscribe(): void }
}
