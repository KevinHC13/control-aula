import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from '@/ui/App'
import { sembrarGrupo } from '@/application/grupo'
import { abrirBase } from '@/data'

// La base se abre al arrancar para que un fallo de IndexedDB se vea de entrada y
// no a mitad de una captura. La semilla corre enseguida, pero solo si la base
// está vacía: si ya hay grupo —sembrado antes o importado desde Ajustes— no se
// toca. El aviso al usuario llega con Sonner, más adelante.
void abrirBase()
  .then(sembrarGrupo)
  .catch((error: unknown) => {
    console.error('No se pudo preparar la base local', error)
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
