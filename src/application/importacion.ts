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
 * Partículas que van en minúscula dentro de un apellido español: "De la Cruz",
 * "Núñez del Ángel". Al principio de los apellidos o de los nombres sí llevan
 * mayúscula, y por eso la posición se mira antes que la lista.
 */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'do', 'dos', 'van', 'von', 'di'])

/** Mayúscula tras el inicio, un guion o un apóstrofo: "Jean-Pierre", "D'Angelo". */
function capitalizarPalabra(palabra: string): string {
  return palabra.replace(/(^|[-'’])(\p{Ll})/gu, (_, separador: string, letra: string) =>
    separador + letra.toLocaleUpperCase('es'),
  )
}

function capitalizarSegmento(segmento: string): string {
  return segmento
    .split(' ')
    .map((palabra, i) => (i > 0 && PARTICULAS.has(palabra) ? palabra : capitalizarPalabra(palabra)))
    .join(' ')
}

/**
 * "AGUILAR MENDOZA, BRUNO ALEJANDRO" → "Aguilar Mendoza, Bruno Alejandro".
 *
 * Las listas oficiales vienen en mayúsculas y así se quedarían todo el ciclo
 * escolar: son 30 nombres gritando en una pantalla que se lee todos los días.
 *
 * **Solo actúa si no hay una sola minúscula.** Un nombre que ya trae mezcla —
 * porque la IA lo leyó bien, o porque lo está tecleando la maestra— no se toca:
 * si se recapitalizara en cada tecla, escribir "de la Cruz" a mano sería
 * imposible. Los acentos no se inventan: "RIOS" sale "Rios", no "Ríos", porque
 * adivinarlos es exactamente el error que la revisión existe para atrapar.
 */
function capitalizar(nombre: string): string {
  if (/\p{Ll}/u.test(nombre)) return nombre
  return nombre
    .toLocaleLowerCase('es')
    .split(',')
    .map((segmento, i) => (i === 0 ? '' : ' ') + capitalizarSegmento(segmento.trim()))
    .join(',')
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
  return revalidar(
    crudo.map((alumno, i) => ({
      nombre: capitalizar(limpiar(alumno.nombre ?? '')),
      numero_lista: alumno.numero_lista ?? i + 1,
      fecha_nacimiento: limpiar(alumno.fecha_nacimiento ?? ''),
    })),
  )
}

/**
 * Recalcula los problemas de una lista que ya se normalizó. Es lo que corre en
 * cada tecla de la pantalla de revisión, y por eso está separada de
 * `normalizarExtraccion`: no recorta espacios ni recapitaliza, que le pelearía
 * al teclado. Marcar un número repetido depende de la lista entera, así que
 * revisar una sola fila no sirve.
 */
export function revalidar(filas: FilaImportada[]): FilaImportada[] {
  const veces = new Map<number, number>()
  for (const { numero_lista } of filas) {
    veces.set(numero_lista, (veces.get(numero_lista) ?? 0) + 1)
  }

  return filas.map(({ nombre, numero_lista, fecha_nacimiento }) => {
    const fila = { nombre, numero_lista, fecha_nacimiento }
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
