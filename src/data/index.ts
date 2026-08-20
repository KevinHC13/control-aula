/**
 * Contenedor de la capa de datos: el único archivo que sabe qué adaptador
 * concreto se usa. `ui/` y `application/` importan de aquí, nunca de
 * `data/dexie/` (docs/ARCHITECTURE.md).
 *
 * Cambiar de fuente de datos es cambiar estas líneas. Nada más.
 */
import { DexieAlumnosRepo } from './dexie/alumnos.adapter'
import { DexieAsistenciaRepo } from './dexie/asistencia.adapter'
import { db } from './dexie/db'
import { DexieEvaluacionRepo } from './dexie/evaluacion.adapter'

export const repos = {
  alumnos: new DexieAlumnosRepo(),
  asistencia: new DexieAsistenciaRepo(),
  evaluacion: new DexieEvaluacionRepo(),
} as const

/**
 * Abre la base. Dexie abriría sola en la primera consulta, pero llamarla al
 * arrancar hace que un fallo de IndexedDB —Safari en navegación privada, cuota
 * agotada— se vea de inmediato y no a mitad de una captura.
 */
export async function abrirBase(): Promise<void> {
  await db.open()
}
