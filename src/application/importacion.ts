import { repos } from '@/data'
import type { DatosAlumno } from '@/domain/entities'
import { comoDate, fechaLocal } from '@/domain/fechas'
import type { AlumnoExtraido } from '@/services/extraccion'

/**
 * Una fila de la pantalla de revisión: lo que la IA leyó, ya limpio, más lo que
 * está mal con ella.
 *
 * `problema` existe porque la revisión es obligatoria y necesita señalar dónde
 * mirar. La IA falla con acentos y apellidos compuestos, y la app no tiene
 * edición de alumnos donde corregir después (docs/DECISIONES.md D-014).
 */
export interface FilaImportada {
  nombre: string
  numero_lista: number
  fecha_nacimiento: string
  /** Ausente cuando la fila está bien. Mensaje para mostrar tal cual. */
  problema?: string
}

/** Espacios de sobra, los típicos de un OCR que leyó una tabla. */
function limpiar(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim()
}

/**
 * Una fecha es válida si sobrevive el viaje de ida y vuelta: `comoDate` corrige
 * en silencio un 31 de febrero a un 3 de marzo, así que si vuelve distinta es
 * que el día no existe. El formato lo filtra antes la expresión regular —una
 * fecha en `12/03/2015` es ambigua entre día y mes y no se adivina, se marca—.
 */
function fechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false
  return fechaLocal(comoDate(fecha)) === fecha
}

/**
 * Deja la extracción cruda lista para revisar: limpia, numerada y con cada
 * problema señalado. Pura: no toca red ni base.
 *
 * Al que no trae número se le da el de su posición, que es lo que hace una lista
 * oficial impresa sin numerar. Si eso choca con un número ya usado, el duplicado
 * se marca y lo resuelve la maestra en la pantalla de revisión.
 */
export function normalizarExtraccion(crudo: AlumnoExtraido[]): FilaImportada[] {
  const filas = crudo.map((alumno, i) => ({
    nombre: limpiar(alumno.nombre ?? ''),
    numero_lista: alumno.numero_lista ?? i + 1,
    fecha_nacimiento: limpiar(alumno.fecha_nacimiento ?? ''),
  }))

  const veces = new Map<number, number>()
  for (const { numero_lista } of filas) {
    veces.set(numero_lista, (veces.get(numero_lista) ?? 0) + 1)
  }

  return filas.map((fila) => {
    const problema = revisar(fila, veces)
    return problema ? { ...fila, problema } : fila
  })
}

function revisar(
  fila: Omit<FilaImportada, 'problema'>,
  veces: Map<number, number>,
): string | undefined {
  if (fila.nombre === '') return 'Falta el nombre'
  if (!Number.isInteger(fila.numero_lista) || fila.numero_lista < 1) {
    return 'El número de lista no es válido'
  }
  if ((veces.get(fila.numero_lista) ?? 0) > 1) return 'Número de lista repetido'
  if (fila.fecha_nacimiento !== '' && !fechaValida(fila.fecha_nacimiento)) {
    return 'La fecha debe ser AAAA-MM-DD'
  }
  return undefined
}

/** La conversión final al tipo del dominio. La fecha vacía es un dato ausente. */
export function aDatosAlumno(filas: FilaImportada[]): DatosAlumno[] {
  return filas.map((fila) => ({
    nombre: fila.nombre,
    numero_lista: fila.numero_lista,
    fecha_nacimiento: fila.fecha_nacimiento === '' ? null : fila.fecha_nacimiento,
  }))
}

/**
 * Guarda la lista revisada. La única función impura del módulo.
 *
 * Reutiliza `sembrar()` sin cambiarlo: su fusión por `numero_lista` conservando
 * el `id` es exactamente el comportamiento que se quiere aquí. Reimportar el
 * archivo con un nombre corregido no pierde la asistencia ya capturada, y nadie
 * desaparece del grupo por no estar en el archivo nuevo.
 */
export async function importarLista(filas: FilaImportada[]): Promise<void> {
  await repos.alumnos.sembrar(aDatosAlumno(filas))
}
