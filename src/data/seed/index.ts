import type { DatosAlumno } from '@/domain/entities'

import { GRUPO as EJEMPLO } from './grupo.example'

/**
 * Elige la lista del grupo: la real si existe, el ejemplo si no.
 *
 * `grupo.ts` está ignorado por git —son nombres de menores— así que en un clon
 * limpio no existe y un `import` normal rompería el build. `import.meta.glob`
 * devuelve un objeto vacío cuando el archivo no está, que es exactamente el
 * comportamiento que hace falta.
 */
const modulos = import.meta.glob<{ GRUPO: DatosAlumno[] }>('./grupo.ts', {
  eager: true,
})

const real = Object.values(modulos)[0]?.GRUPO

export const GRUPO: DatosAlumno[] = real ?? EJEMPLO

/** Para que la interfaz pueda avisar que está corriendo con datos inventados. */
export const usaEjemplo = real === undefined
