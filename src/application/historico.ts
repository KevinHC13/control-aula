import { repos } from '@/data'
import type { CicloEnCurso } from '@/data/ports/evaluacion'

/**
 * Los ciclos que ya terminaron.
 *
 * Es todo lo que necesita el histórico: una vez elegido el ciclo y el trimestre,
 * el reporte se pinta con la misma pantalla del camino diario, que ya sabe leer
 * el snapshot de un trimestre cerrado. Consultar el año pasado no es una función
 * nueva, es la que ya existe apuntando a otro sitio (D-025).
 *
 * Solo los cerrados: el abierto se consulta por su pestaña, y ofrecerlo aquí
 * sería dos caminos a lo mismo.
 */
export async function ciclosAnteriores(): Promise<CicloEnCurso[]> {
  const todos = await repos.evaluacion.ciclos()
  return todos.filter((c) => c.ciclo.estado === 'cerrado')
}

/**
 * Qué trimestres de un ciclo cerrado tienen algo que enseñar.
 *
 * Uno abierto dentro de un ciclo cerrado no debería existir —cerrar el ciclo lo
 * exige (C34)— pero un ciclo de antes de esa regla podría tenerlo, y calcularlo
 * al vuelo daría números que ya no corresponden a los criterios de entonces.
 * Vale más no ofrecerlo.
 */
export function trimestresConsultables(ciclo: CicloEnCurso) {
  return ciclo.trimestres.filter((t) => t.estado === 'cerrado')
}
