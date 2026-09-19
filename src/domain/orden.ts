import type { Alumno } from './entities'

/**
 * En qué orden se lee el grupo: **alfabético por apellido**.
 *
 * Hasta ahora era `numero_lista`, y coincidía con el alfabético mientras la
 * lista fuera la oficial —Control Escolar la imprime alfabetizada—. Deja de
 * coincidir en cuanto alguien se da de alta durante el año: el que llega en
 * noviembre toma el 39 y aparecía al final, no donde su apellido lo pone. El
 * orden de alta no puede decidir dónde se busca a un niño.
 *
 * **Desde D-033, `numero_lista` deja de ser un dato fijo**: el adaptador lo
 * sustituye por la posición 1-based en este mismo orden antes de devolver cada
 * `Alumno`, así que el número que ella canta al pasar lista se mueve solo al
 * lugar que le toca por apellido. Ya no identifica a nadie —ni al fusionar la
 * lista importada ni al elegir a quién corregir—; para eso, `sembrar()` usa el
 * CURP y, si no lo hay, el nombre exacto.
 */

/**
 * El comparador del grupo. `nombre` viene «Apellidos, Nombres» —el orden de la
 * lista oficial—, así que comparar el campo entero ya ordena por apellido sin
 * partirlo.
 *
 * `sensitivity: 'base'` para que «Ávila» caiga entre «Aguilar» y «Barrera» y no
 * después de la Z, y para que un acento que el OCR perdió no mande a nadie a
 * otro sitio de la lista.
 *
 * El desempate por número no es adorno: dos homónimos con el mismo nombre
 * exacto tienen que salir siempre en el mismo orden, o la lista cambia de forma
 * entre lecturas y quien la mira deja de fiarse de dónde estaba cada uno.
 */
export function porNombre(a: Alumno, b: Alumno): number {
  const porApellido = a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
  return porApellido !== 0 ? porApellido : a.numero_lista - b.numero_lista
}
