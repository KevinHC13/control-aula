/**
 * Contenedor de la capa de datos: el único archivo que sabe qué adaptador
 * concreto se usa. `ui/` y `application/` importan de aquí, nunca de
 * `data/dexie/` (docs/ARCHITECTURE.md).
 */
import { db } from './dexie/db'

/**
 * Abre la base. Dexie abriría sola en la primera consulta, pero llamarla al
 * arrancar hace que un fallo de IndexedDB —Safari en navegación privada, cuota
 * agotada— se vea de inmediato y no a mitad de una captura.
 */
export async function abrirBase(): Promise<void> {
  await db.open()
}
