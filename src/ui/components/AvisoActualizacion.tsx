import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Aviso de versión nueva. La app **no** se recarga sola: ella decide cuándo.
 *
 * Con `registerType: 'autoUpdate'` el service worker puede recargar la página a
 * mitad de una captura, y perder tres faltas a medio pasar lista es exactamente
 * el tipo de cosa que hace abandonar una herramienta para siempre (docs/UX.md).
 *
 * Va arriba y no abajo: abajo está la barra de pestañas, y un aviso encima del
 * pulgar se toca sin querer.
 *
 * `sticky` y no `fixed`: fijo se sale del flujo y se monta encima de la tira de
 * días, o sea que tapa el primer control de la pantalla que más se usa justo el
 * día que aparece. Pegajoso ocupa su lugar, empuja lo de abajo y sigue a la vista
 * al desplazar.
 */
export function AvisoActualizacion() {
  const {
    needRefresh: [hayVersionNueva, setHayVersionNueva],
    updateServiceWorker,
  } = useRegisterSW({
    // Sin esto, un registro fallido es invisible: la librería se traga el error y
    // la app parece funcionar hasta el primer arranque sin red, que es el peor
    // momento para descubrirlo.
    onRegisterError(error) {
      console.error('No se pudo registrar el service worker', error)
    },
  })

  if (!hayVersionNueva) return null

  return (
    <div
      role="status"
      className="sticky top-0 z-20 -mx-4 mb-4 flex items-center gap-3 border-b border-linea bg-cuadro px-4 py-2"
    >
      <p className="flex-1 text-base text-tinta">Hay una versión nueva.</p>
      <button
        type="button"
        onClick={() => void updateServiceWorker(true)}
        className="min-h-11 rounded-lg bg-azul px-4 text-base font-medium text-papel"
      >
        Actualizar
      </button>
      <button
        type="button"
        onClick={() => setHayVersionNueva(false)}
        className="min-h-11 px-3 text-base text-tinta-2"
      >
        Después
      </button>
    </div>
  )
}
