import { comoDate, ventanaDeDias } from '@/domain/fechas'
import type { Fecha } from '@/domain/values'
import { IconoCalendario } from '@/ui/components/iconos'
import { useDiasQueCaben } from '@/ui/hooks/useDiasQueCaben'
import { cn } from '@/ui/lib/utils'

const inicial = new Intl.DateTimeFormat('es-MX', { weekday: 'narrow' })

/**
 * Los días que caben en el ancho disponible, con el seleccionado al centro y sin
 * pasar de hoy: un día que no ha pasado no tiene asistencia que capturar.
 *
 * La ventana se **deriva** del día seleccionado, así que tocar el día del extremo
 * izquierdo lo recentra y revela media ventana de días anteriores. Eso es el
 * recorrido: un toque por salto, sin flechas que compitan con los días ni un
 * gesto que pelee con el desplazamiento. Para saltos largos está el calendario
 * (docs/UX.md).
 */
export function TiraDeDias({
  diaSeleccionado,
  hoy,
  alSeleccionar,
  alAbrirCalendario,
}: {
  diaSeleccionado: Fecha
  hoy: Fecha
  alSeleccionar: (fecha: Fecha) => void
  alAbrirCalendario: () => void
}) {
  const [refDias, cuantos] = useDiasQueCaben<HTMLUListElement>()
  const dias = ventanaDeDias(diaSeleccionado, hoy, cuantos)

  return (
    <nav aria-label="Días" className="flex gap-2">
      <button
        type="button"
        onClick={alAbrirCalendario}
        aria-label="Abrir calendario"
        aria-haspopup="dialog"
        className={cn(
          'flex min-h-14 w-12 shrink-0 items-center justify-center rounded-lg border border-linea',
          'bg-papel text-tinta-2',
          'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        )}
      >
        <IconoCalendario className="size-6" />
      </button>

      {/* `flex-1 min-w-0` es lo que hace que el `ul` mida el espacio que sobra:
          el hook mide este elemento, no la pantalla. `overflow-x-auto` es la red
          por si la medición se queda corta un cuadro al girar el iPad. */}
      <ul ref={refDias} className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
        {dias.map((fecha) => {
          const seleccionado = fecha === diaSeleccionado
          const fin = [0, 6].includes(comoDate(fecha).getDay())
          return (
            <li key={fecha}>
              <button
                type="button"
                onClick={() => alSeleccionar(fecha)}
                aria-current={seleccionado ? 'date' : undefined}
                aria-label={fecha}
                className={cn(
                  'flex min-h-14 w-12 flex-col items-center justify-center rounded-lg border',
                  'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  seleccionado
                    ? 'border-azul bg-azul text-papel'
                    : cn('border-linea bg-papel', fin ? 'text-tinta-2/60' : 'text-tinta-2'),
                )}
              >
                <span aria-hidden className="text-base leading-none uppercase">
                  {inicial.format(comoDate(fecha))}
                </span>
                <span aria-hidden className="cifra mt-1 text-base leading-none font-semibold">
                  {fecha.slice(-2)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
