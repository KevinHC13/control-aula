import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { abrirBase } from '@/data'

// Se abre al arrancar para que un fallo de IndexedDB se vea de entrada y no a
// mitad de una captura. El aviso al usuario llega con Sonner, más adelante.
void abrirBase().catch((error: unknown) => {
  console.error('No se pudo abrir la base local', error)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
