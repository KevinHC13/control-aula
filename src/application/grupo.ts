import { repos } from '@/data'
import { GRUPO } from '@/data/seed'

/**
 * Carga la lista oficial del grupo. Se llama al arrancar: es idempotente, así
 * que no hay que recordar si ya corrió, y si el archivo cambió —nombre corregido,
 * alumno nuevo— el cambio entra en el siguiente arranque.
 *
 * La maestra no importa nada ni teclea 30 nombres: no hay pantalla de alta
 * (docs/DECISIONES.md D-008).
 */
export async function sembrarGrupo(): Promise<void> {
  await repos.alumnos.sembrar(GRUPO)
}
