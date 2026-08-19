import { useState } from 'react'

import { IconoEngrane } from '@/ui/components/iconos'
import { Button } from '@/ui/components/ui/button'
import { Ajustes } from '@/ui/screens/Ajustes'
import { CargarLista } from '@/ui/screens/CargarLista'

/**
 * Subvista con estado local y no en el store, mismo criterio que el calendario
 * de `Asistencia.tsx`: ajustes vive y muere dentro de la pestaña Grupo, no cruza
 * pantallas, y el store guarda solo lo que sí (docs/ARCHITECTURE.md).
 */
type Vista = 'resumen' | 'ajustes' | 'cargar'

export function Grupo() {
  const [vista, setVista] = useState<Vista>('resumen')

  if (vista === 'ajustes') {
    return (
      <Ajustes alVolver={() => setVista('resumen')} alCargarLista={() => setVista('cargar')} />
    )
  }

  if (vista === 'cargar') {
    return <CargarLista alVolver={() => setVista('ajustes')} />
  }

  return (
    <section aria-labelledby="titulo-grupo" className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 id="titulo-grupo" className="text-2xl font-bold text-tinta">
          Grupo
        </h1>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setVista('ajustes')}
          aria-label="Ajustes"
        >
          <IconoEngrane className="size-6" />
        </Button>
      </header>
    </section>
  )
}
