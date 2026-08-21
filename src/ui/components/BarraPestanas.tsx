import { cn } from '@/ui/lib/utils'
import { type Pestana, useInterfaz } from '@/ui/store/interfaz'

const PESTANAS: { id: Pestana; etiqueta: string }[] = [
  { id: 'asistencia', etiqueta: 'Asistencia' },
  { id: 'calificaciones', etiqueta: 'Calificaciones' },
  { id: 'bitacora', etiqueta: 'Bitácora' },
  { id: 'grupo', etiqueta: 'Grupo' },
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
        {PESTANAS.map(({ id, etiqueta }) => {
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
                  'flex min-h-14 w-full min-w-11 items-center justify-center px-2 text-base',
                  'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset',
                  activa ? 'font-semibold text-azul' : 'text-tinta-2',
                )}
              >
                {etiqueta}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
