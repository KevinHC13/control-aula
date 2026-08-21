import { useState } from 'react'

import { IconoEngrane } from '@/ui/components/iconos'
import { Button } from '@/ui/components/ui/button'
import { Ajustes } from '@/ui/screens/Ajustes'
import { CargarLista } from '@/ui/screens/CargarLista'
import { CicloEscolar } from '@/ui/screens/CicloEscolar'
import { CriteriosYPesos } from '@/ui/screens/CriteriosYPesos'
import { Equipos } from '@/ui/screens/Equipos'
import { ResumenDelGrupo } from '@/ui/screens/ResumenDelGrupo'
import { Respaldo } from '@/ui/screens/Respaldo'
import { Rubricas } from '@/ui/screens/Rubricas'

/**
 * Subvista con estado local y no en el store, mismo criterio que el calendario
 * de `Asistencia.tsx`: ajustes vive y muere dentro de la pestaña Grupo, no cruza
 * pantallas, y el store guarda solo lo que sí (docs/ARCHITECTURE.md).
 */
type Vista =
  | 'resumen'
  | 'ajustes'
  | 'cargar'
  | 'ciclo'
  | 'criterios'
  | 'rubricas'
  | 'respaldo'
  | 'equipos'

export function Grupo() {
  const [vista, setVista] = useState<Vista>('resumen')

  if (vista === 'ajustes') {
    return (
      <Ajustes
        alVolver={() => setVista('resumen')}
        alCargarLista={() => setVista('cargar')}
        alConfigurarCiclo={() => setVista('ciclo')}
        alConfigurarCriterios={() => setVista('criterios')}
        alConfigurarRubricas={() => setVista('rubricas')}
        alRespaldar={() => setVista('respaldo')}
      />
    )
  }

  if (vista === 'cargar') {
    return <CargarLista alVolver={() => setVista('ajustes')} />
  }

  if (vista === 'ciclo') {
    return <CicloEscolar alVolver={() => setVista('ajustes')} />
  }

  if (vista === 'criterios') {
    return <CriteriosYPesos alVolver={() => setVista('ajustes')} />
  }

  if (vista === 'rubricas') {
    return <Rubricas alVolver={() => setVista('ajustes')} />
  }

  if (vista === 'respaldo') {
    return <Respaldo alVolver={() => setVista('ajustes')} />
  }

  // Los equipos vuelven al resumen y no a Ajustes: no son configuración, son una
  // herramienta que se usa en clase.
  if (vista === 'equipos') {
    return <Equipos alVolver={() => setVista('resumen')} />
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

      {/* Los equipos entran aquí porque son una herramienta sobre la composición
          del salón, no sobre el día. Van arriba del resumen porque se usan en
          clase; el resumen se lee cuando hay tiempo. */}
      <Button variant="outline" className="self-start" onClick={() => setVista('equipos')}>
        Formar equipos
      </Button>

      <ResumenDelGrupo />
    </section>
  )
}
