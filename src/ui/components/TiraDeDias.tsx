import { comoDate, ultimosDias } from '@/domain/fechas'
import type { Fecha } from '@/domain/values'
import { cn } from '@/ui/lib/utils'

const DIAS_VISIBLES = 7

const inicial = new Intl.DateTimeFormat('es-MX', { weekday: 'narrow' })

/**
 * Los últimos siete días, con hoy al final. No hay calendario: la maestra captura
 * hoy, y a lo más corrige ayer o antier. Un selector de mes sería un toque más en
 * el camino diario para un caso que casi no ocurre (docs/UX.md).
 */
export function TiraDeDias({
  diaSeleccionado,
  hoy,
  alSeleccionar,
}: {
  diaSeleccionado: Fecha
  hoy: Fecha
  alSeleccionar: (fecha: Fecha) => void
}) {
  // Termina en hoy, salvo que se esté viendo un día anterior: así la tira
  // siempre contiene al día seleccionado.
  const ultimo = diaSeleccionado > hoy ? diaSeleccionado : hoy
  const dias = ultimosDias(ultimo, DIAS_VISIBLES)

  return (
    <nav aria-label="Días" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2">
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
