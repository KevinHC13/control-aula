import { repos } from '@/data'
import { GRUPO } from '@/data/seed'

/**
 * Carga la lista oficial del grupo al arrancar, **solo si la base está vacía**.
 *
 * La condición no es una optimización. Desde que la lista también puede entrar
 * por la carga asistida por IA (docs/DECISIONES.md D-014), sembrar en cada
 * arranque pisaría lo importado: la semilla fusiona por `numero_lista` igual que
 * la importación, así que devolvería los nombres del archivo de desarrollo en el
 * siguiente arranque, en silencio y sin que nada se vea roto.
 *
 * Con la base vacía la semilla sigue siendo lo que arranca el ciclo: es la
 * primera carga del grupo, no un respaldo que se reaplica.
 */
export async function sembrarGrupo(): Promise<void> {
  if ((await repos.alumnos.lista()).length > 0) return
  await repos.alumnos.sembrar(GRUPO)
}
