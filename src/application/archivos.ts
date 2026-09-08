import { fechaLocal } from '@/domain/fechas'
import type { Fecha } from '@/domain/values'

/**
 * Cómo se llaman los archivos que salen de la aplicación.
 *
 * Sale de `respaldo.ts`, que fue el primero en generar uno, y vive aquí desde que
 * hubo un segundo —el PDF de un reporte—. Todos siguen la misma forma
 * —`palomita-<qué>-<grupo>-<fecha>.<ext>`— por una razón práctica: en Archivos del
 * iPad acaban todos en la misma carpeta, y ahí un nombre que se ordena solo y se
 * reconoce sin abrirlo vale más que uno bonito.
 */

/**
 * El nombre del grupo, limpio de lo que no cabe en un nombre de archivo.
 *
 * Se limpia en vez de rechazarse: quien escribe «3.º B» no tiene por qué saber
 * qué caracteres admite iPadOS.
 */
function etiquetaDeGrupo(grupo: string): string {
  return grupo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

/**
 * `palomita-faltas-3-b-2026-09-07.pdf`.
 *
 * La fecha va al final y en ISO para que la carpeta se ordene sola por ella, que
 * es como se busca «el de la semana pasada». `que` distingue un respaldo de un
 * reporte y un reporte de otro; vacío, es el respaldo entero.
 */
export function nombreDeArchivo(
  extension: string,
  que = '',
  grupo = '',
  hoy: Fecha = fechaLocal(new Date()),
): string {
  const partes = ['palomita', que, etiquetaDeGrupo(grupo)].filter((p) => p !== '')
  return `${partes.join('-')}-${hoy}.${extension}`
}
