import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from '@/ui/App'
import { abrirBase } from '@/data'

// La base se abre al arrancar para que un fallo de IndexedDB se vea de entrada y
// no a mitad de una captura. No se siembra nada: la app arranca vacía y la lista
// del grupo entra por Ajustes —cargándola con IA o restaurando un respaldo—.
// El aviso al usuario llega con Sonner, más adelante.
void abrirBase().catch((error: unknown) => {
  console.error('No se pudo preparar la base local', error)
})

/**
 * Sincronía al abrir, al cerrar y al recuperar la red, nunca en segundo plano: iOS
 * no tiene Background Sync, así que toda subida ocurre con la app abierta
 * (docs/PWA-IOS.md).
 *
 * **Con `import()` y no con un import normal**, y esa es la diferencia entre pasar
 * lista y esperar: el cliente de Supabase pesa 240 kB y no hace falta para capturar
 * nada. Así queda en un trozo aparte que se descarga después de que la pantalla ya
 * está, en vez de sumarse a lo que el navegador tiene que interpretar antes de
 * pintar la primera fila.
 *
 * No lanza y no hace nada si falta la nube, la sesión o los pendientes: esto corre
 * sin que nadie lo haya pedido, y un fallo de red en el arranque no puede ser un
 * error en la cara de nadie. Lo capturado se queda en la cola, que es su trabajo.
 *
 * `pagehide` y no `beforeunload`: en iOS es el único que se dispara de verdad al
 * cambiar de app o cerrar la pestaña. Se acompaña de `visibilitychange` porque en
 * la PWA instalada el paso a segundo plano suele llegar solo por ahí.
 *
 * Y `online`, que **no** es sincronía en segundo plano: sigue ocurriendo con la app
 * abierta y a la vista. Sin él, quedarse sin red a media clase y recuperarla no
 * subía nada hasta que ella cambiara de app o la volviera a abrir —un gesto que no
 * tiene por qué hacer—, y lo capturado se quedaba esperando en la cola sin motivo.
 */
function sincronizar() {
  void import('@/application/sincronia')
    .then((motor) => motor.sincronizarSiSePuede())
    .catch(() => {
      // Sin red, el trozo del motor puede no estar en caché todavía. No es un
      // error que valga contar: la app entera funciona sin él.
    })
}

sincronizar()
window.addEventListener('pagehide', sincronizar)
window.addEventListener('online', sincronizar)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') sincronizar()
})

// Safari puede borrar los datos locales de un sitio tras 7 días sin uso. Las PWA
// instaladas en la pantalla de inicio están exentas, y esto lo pide explícito.
// No se puede dar por hecho: si devuelve false, el respaldo es la única red
// (docs/PWA-IOS.md).
void navigator.storage?.persist?.().then((persistente) => {
  if (!persistente) {
    console.warn('El almacenamiento no es persistente: los datos locales podrían borrarse')
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
