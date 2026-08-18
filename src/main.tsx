import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from '@/ui/App'
import { sembrarGrupo } from '@/application/grupo'
import { abrirBase } from '@/data'

// La base se abre al arrancar para que un fallo de IndexedDB se vea de entrada y
// no a mitad de una captura, y la semilla corre enseguida: es idempotente, así
// que no hay que llevar cuenta de si ya se cargó. El aviso al usuario llega con
// Sonner, más adelante.
void abrirBase()
  .then(sembrarGrupo)
  .catch((error: unknown) => {
    console.error('No se pudo preparar la base local', error)
  })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
