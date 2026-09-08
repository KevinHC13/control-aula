/**
 * Poner un archivo en manos de quien usa la app.
 *
 * Dos caminos, y **el primero es el del iPad**: con el archivo en la hoja de
 * compartir, «Guardar en Archivos» es una opción de esa hoja, y también lo son
 * mandarlo por correo o a la impresora. La descarga por ancla es el camino del
 * navegador de escritorio, donde no hay hoja que abrir.
 *
 * Sale del respaldo, que fue el primero en necesitarlo, y vive aquí desde que hubo
 * un segundo —el PDF de un reporte—. No es un `<a download>` con adornos: el orden
 * de los dos caminos es una decisión sobre el dispositivo de destino, y copiarla
 * es la manera de que en tres meses uno de los dos guarde donde no debe.
 */
export async function entregarArchivo(
  contenido: Blob,
  nombre: string,
  tipo: string,
): Promise<void> {
  const comoArchivo = new File([contenido], nombre, { type: tipo })

  if (navigator.canShare?.({ files: [comoArchivo] })) {
    await navigator.share({ files: [comoArchivo], title: nombre })
    return
  }

  const url = URL.createObjectURL(contenido)
  const ancla = document.createElement('a')
  ancla.href = url
  ancla.download = nombre
  ancla.click()
  URL.revokeObjectURL(url)
}

/**
 * Si el fallo fue que se canceló la hoja de compartir.
 *
 * Cancelar no es un error que valga la pena enseñar: quien cerró la hoja sabe muy
 * bien lo que hizo, y un mensaje rojo diciéndoselo convierte una decisión en un
 * problema.
 */
export function seCancelo(fallo: unknown): boolean {
  return fallo instanceof DOMException && fallo.name === 'AbortError'
}
