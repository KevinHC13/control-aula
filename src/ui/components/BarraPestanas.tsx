import {
  IconoAnotacion,
  IconoCuaderno,
  IconoGrupo,
  IconoLista,
} from '@/ui/components/iconos'
import { cn } from '@/ui/lib/utils'
import { type Pestana, useInterfaz } from '@/ui/store/interfaz'

/**
 * Con icono **y** etiqueta. El icono hace que la sección se reconozca sin leer
 * —eran cuatro palabras del mismo peso, y encontrar la suya costaba leerlas— y la
 * etiqueta se queda porque un icono solo se adivina.
 */
const PESTANAS: {
  id: Pestana
  etiqueta: string
  Icono: (p: { className?: string }) => React.JSX.Element
}[] = [
  { id: 'asistencia', etiqueta: 'Asistencia', Icono: IconoLista },
  { id: 'calificaciones', etiqueta: 'Calificaciones', Icono: IconoCuaderno },
  { id: 'bitacora', etiqueta: 'Bitácora', Icono: IconoAnotacion },
  { id: 'grupo', etiqueta: 'Grupo', Icono: IconoGrupo },
]

/**
 * Barra inferior, dentro del alcance del pulgar. Componente propio y no `Tabs`
 * de shadcn: `Tabs` está pensado para pestañas de contenido, no para una barra
 * tipo app nativa con `safe-area-inset` (docs/DECISIONES.md D-010).
 *
 * `pb-[env(safe-area-inset-bottom)]` es lo que evita que los botones queden bajo
 * el indicador de home del iPad. Requiere `viewport-fit=cover` en el índice.
 */
export function BarraPestanas() {
  const pestanaActiva = useInterfaz((s) => s.pestanaActiva)
  const irA = useInterfaz((s) => s.irA)

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 border-t border-linea bg-papel pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-4">
        {PESTANAS.map(({ id, etiqueta, Icono }) => {
          const activa = id === pestanaActiva
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => irA(id)}
                aria-current={activa ? 'page' : undefined}
                // min-h-14 y no min-h-11: la barra es el objetivo más tocado de
                // la app y 44 px es el piso, no la meta.
                className={cn(
                  'flex min-h-14 w-full min-w-11 flex-col items-center justify-center gap-0.5 px-2 py-1.5',
                  'foco-dentro',
                  activa ? 'font-semibold text-marca' : 'text-tinta-2',
                )}
              >
                <Icono className="size-6" />
                <span className="text-apoyo leading-none">{etiqueta}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
