import { repos } from '@/data'
import { curpValido, fechaDeCurp, normalizarCurp } from '@/domain/curp'
import type { DatosAlumno } from '@/domain/entities'
import { fechaValida } from '@/domain/fechas'
import type { AlumnoExtraido } from '@/services/extraccion'

/**
 * Una fila de la pantalla de revisión: lo que la IA leyó, ya limpio, más lo que
 * está mal con ella.
 *
 * `problema` existe porque la revisión es obligatoria y necesita señalar dónde
 * mirar. La IA falla con acentos y apellidos compuestos, y aunque desde `C37` se
 * puede corregir un alumno en Ajustes, un nombre mal escrito que nadie mira aquí
 * se queda mal escrito todo el ciclo (docs/DECISIONES.md D-014).
 */
export interface FilaImportada {
  nombre: string
  numero_lista: number
  fecha_nacimiento: string
  /** 18 caracteres o vacío. Lo que trae la lista oficial de Control Escolar. */
  curp: string
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
 * Deja la extracción cruda lista para revisar: limpia, numerada y con cada
 * problema señalado. Pura: no toca red ni base.
 *
 * Al que no trae número se le da el de su posición, que es lo que hace una lista
 * oficial impresa sin numerar. Si eso choca con un número ya usado, el duplicado
 * se marca y lo resuelve la maestra en la pantalla de revisión.
 */
export function normalizarExtraccion(crudo: AlumnoExtraido[]): FilaImportada[] {
  return revalidar(
    crudo.map((alumno, i) => {
      const curp = normalizarCurp(alumno.curp ?? '')

      return {
        nombre: capitalizar(limpiar(alumno.nombre ?? '')),
        numero_lista: alumno.numero_lista ?? i + 1,
        // Lo impreso gana; la CURP rellena. Nunca al revés: si el documento
        // trae las dos y no coinciden, la que se ve es la que se respeta y la
        // maestra decide en la revisión.
        fecha_nacimiento: limpiar(alumno.fecha_nacimiento ?? '') || (fechaDeCurp(curp) ?? ''),
        curp,
      }
    }),
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
  const vecesCurp = new Map<string, number>()
  for (const { numero_lista, curp } of filas) {
    veces.set(numero_lista, (veces.get(numero_lista) ?? 0) + 1)
    if (curp !== '') vecesCurp.set(curp, (vecesCurp.get(curp) ?? 0) + 1)
  }

  return filas.map(({ nombre, numero_lista, fecha_nacimiento, curp }) => {
    const fila = { nombre, numero_lista, fecha_nacimiento, curp }
    const problema = revisar(fila, veces, vecesCurp)
    return problema ? { ...fila, problema } : fila
  })
}

function revisar(
  fila: Omit<FilaImportada, 'problema'>,
  veces: Map<number, number>,
  vecesCurp: Map<string, number>,
): string | undefined {
  if (fila.nombre === '') return 'Falta el nombre'
  if (!Number.isInteger(fila.numero_lista) || fila.numero_lista < 1) {
    return 'El número de lista no es válido'
  }
  if ((veces.get(fila.numero_lista) ?? 0) > 1) return 'Número de lista repetido'
  if (fila.fecha_nacimiento !== '' && !fechaValida(fila.fecha_nacimiento)) {
    return 'La fecha debe ser AAAA-MM-DD'
  }
  if (fila.curp !== '' && !curpValido(fila.curp)) return 'El CURP no es válido'
  // Dos veces el mismo CURP es la misma persona leída dos veces: pasa al
  // fotografiar una hoja que ya se había cargado.
  if ((vecesCurp.get(fila.curp) ?? 0) > 1) return 'CURP repetido'
  return undefined
}

/**
 * Suma una hoja recién leída a lo que ya se estaba revisando.
 *
 * Una lista oficial de treinta y siete alumnos no cabe en una foto: viene en
 * dos páginas, o en una hoja de cálculo y una foto de la que se agregó después.
 * Leerlas por separado y quedarse con la última sería perder la mitad del grupo
 * sin avisar.
 *
 * Dos reglas, y las dos existen por lo mismo —que se pueda repetir una hoja sin
 * miedo—:
 *
 * 1. **Identidad por CURP y, si no la hay, por número de lista.** El CURP manda
 *    porque es el único dato que no cambia entre páginas; el número, porque la
 *    mayoría de las listas no trae CURP.
 * 2. **Lo que ya estaba escrito gana**, y lo nuevo solo rellena huecos. Volver a
 *    fotografiar una hoja que ya se cargó no pisa la corrección que ella acaba
 *    de teclear.
 *
 * Al final se reordena por número de lista —dos páginas llegan en orden, pero
 * dos fotos no tienen por qué— y se revalida, que es lo que marca los repetidos
 * que esta fusión no supo unir.
 */
export function fusionarHojas(
  previas: FilaImportada[],
  nuevas: FilaImportada[],
): FilaImportada[] {
  const juntas = previas.map((fila) => ({ ...fila }))

  for (const nueva of nuevas) {
    const i = juntas.findIndex(
      (previa) =>
        (previa.curp !== '' && previa.curp === nueva.curp) ||
        (previa.curp === '' && nueva.curp === '' && previa.numero_lista === nueva.numero_lista),
    )

    if (i === -1) {
      juntas.push({ ...nueva })
      continue
    }

    juntas[i] = {
      ...juntas[i]!,
      nombre: juntas[i]!.nombre || nueva.nombre,
      fecha_nacimiento: juntas[i]!.fecha_nacimiento || nueva.fecha_nacimiento,
      curp: juntas[i]!.curp || nueva.curp,
    }
  }

  return revalidar(juntas.sort((a, b) => a.numero_lista - b.numero_lista))
}

/** La conversión final al tipo del dominio. La fecha vacía es un dato ausente. */
export function aDatosAlumno(filas: FilaImportada[]): DatosAlumno[] {
  return filas.map((fila) => ({
    nombre: fila.nombre,
    numero_lista: fila.numero_lista,
    fecha_nacimiento: fila.fecha_nacimiento === '' ? null : fila.fecha_nacimiento,
    curp: fila.curp === '' ? null : fila.curp,
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
