import { repos } from '@/data'
import type { Alumno, Reporte, Trimestre } from '@/domain/entities'
import type { Fecha, Id } from '@/domain/values'

/**
 * Un alumno con sus reportes del trimestre, más reciente primero.
 *
 * El conteo no se guarda en un campo: es `reportes.length`. Contar es lo que la
 * pantalla hace todo el tiempo, y un contador almacenado sería un dato que puede
 * dejar de coincidir con la lista que está debajo.
 */
export interface FilaBitacora {
  alumno: Alumno
  reportes: Reporte[]
}

/**
 * Cruza el grupo con los reportes del trimestre. Todos los alumnos salen, tengan
 * reportes o no: la pantalla es la lista del grupo, no la lista de los
 * reportados —buscar a un alumno para anotarle el primero es el caso normal—.
 *
 * Función pura: no lee la base. Recibe los reportes ya recortados al trimestre,
 * porque la atribución es por fecha y se deriva al leer.
 */
export function filasDeBitacora(alumnos: Alumno[], reportes: Reporte[]): FilaBitacora[] {
  const porAlumno = new Map<Id, Reporte[]>()
  for (const reporte of reportes) {
    const suyos = porAlumno.get(reporte.alumno_id)
    if (suyos) suyos.push(reporte)
    else porAlumno.set(reporte.alumno_id, [reporte])
  }

  return alumnos.map((alumno) => ({
    alumno,
    // El orden viene del repositorio —más reciente primero— y agrupar lo
    // conserva.
    reportes: porAlumno.get(alumno.id) ?? [],
  }))
}

/** Lo único que se pide de un texto de reporte: que diga algo. */
export function textoDeReporteValido(texto: string): boolean {
  return texto.trim().length > 0
}

/**
 * Los reportes de un trimestre. El rango son sus fechas: un reporte pertenece al
 * trimestre que contiene su día, y eso no se almacena en ninguna parte
 * (docs/DATA-MODEL.md).
 */
export async function reportesDelTrimestre(trimestre: Trimestre): Promise<Reporte[]> {
  return repos.bitacora.porRango(trimestre.inicio, trimestre.fin)
}

/**
 * Anota un reporte. Se niega con el texto vacío —una fila sin texto contaría para
 * conducta sin decir por qué— y recorta los espacios de los extremos, que es lo
 * que deja el teclado del iPad al terminar una frase.
 */
export async function registrarReporte(
  alumnoId: Id,
  fecha: Fecha,
  texto: string,
): Promise<Id> {
  if (!textoDeReporteValido(texto)) {
    throw new Error('Falta escribir qué pasó')
  }
  return repos.bitacora.registrar(alumnoId, fecha, texto.trim())
}

/**
 * Quita un reporte. Existe porque un reporte de más **baja una calificación**:
 * sin forma de deshacerlo, un toque equivocado se arreglaría editando la base.
 */
export async function quitarReporte(reporteId: Id): Promise<void> {
  await repos.bitacora.quitar(reporteId)
}
