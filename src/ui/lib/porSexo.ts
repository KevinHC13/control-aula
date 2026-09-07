import type { FaltantesPorSexo } from '@/application/asistencia'

import { plural } from './plural'

/**
 * «1 niño · 2 niñas · 1 sin asignar»: quiénes faltaron, dicho en palabras.
 *
 * Vive aquí y no dentro del contador porque la dicen dos pantallas —el contador
 * del día y el reporte de la semana— y son las **mismas reglas**: si una de las
 * dos las escribiera por su cuenta, tarde o temprano dirían cosas distintas del
 * mismo dato.
 *
 * Y son reglas, no un `join`:
 *
 * - **Las partes en cero no se dicen.** «0 niños · 1 niña» obliga a leer un dato
 *   que no aporta, y armarlo sin filtrar deja un separador suelto: «1 niño · » es
 *   peor que no enseñar la línea.
 * - **`sinAsignar` se dice, no se reparte.** Un alumno sin sexo no es medio niño
 *   (docs/DECISIONES.md D-029): un hueco que se ve vale más que dos cifras que
 *   suman bien y mienten.
 *
 * Devuelve la cadena vacía cuando no hay nada que decir, para que quien la use
 * decida si esconde la línea entera.
 */
export function frasePorSexo({ ninos, ninas, sinAsignar }: FaltantesPorSexo): string {
  return [
    ninos > 0 && `${ninos} ${plural(ninos, 'niño', 'niños')}`,
    ninas > 0 && `${ninas} ${plural(ninas, 'niña', 'niñas')}`,
    sinAsignar > 0 && `${sinAsignar} sin asignar`,
  ]
    .filter((parte): parte is string => parte !== false)
    .join(' · ')
}
