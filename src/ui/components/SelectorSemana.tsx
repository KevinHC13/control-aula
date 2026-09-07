import { fechaMas } from '@/domain/fechas'
import type { Fecha } from '@/domain/values'
import { IconoAnterior, IconoSiguiente } from '@/ui/components/iconos'
import { cn } from '@/ui/lib/utils'
import { comoRango } from '@/ui/lib/fechas'

/**
 * De qué semana se está hablando, y cómo se cambia.
 *
 * Las mismas reglas que las flechas de la tira de días: caminan de una en una,
 * miden 44 px y `›` se apaga en la semana de hoy —una semana que no ha pasado no
 * tiene asistencia que contar—.
 *
 * El rango se enseña de **lunes a viernes** aunque la semana se lea hasta el
 * domingo: es la semana de clases, y decir «al 13 de septiembre» donde ella lee
 * «al viernes 11» sería contar los días que nadie fue a la escuela. Lo que se
 * capture en sábado sigue saliendo en el detalle de abajo.
 */
export function SelectorSemana({
  lunes,
  hoy,
  alElegir,
}: {
  lunes: Fecha
  hoy: Fecha
  alElegir: (lunes: Fecha) => void
}) {
  // Comparar `Fecha` como cadena ordena bien: ISO-8601 con ceros a la izquierda
  // es lexicográficamente igual que cronológicamente.
  const enLaUltima = fechaMas(lunes, 6) >= hoy

  return (
    <nav aria-label="Semana" className="flex items-center gap-2">
      <Flecha etiqueta="Semana anterior" alTocar={() => alElegir(fechaMas(lunes, -7))}>
        <IconoAnterior className="size-6" />
      </Flecha>

      <p className="min-w-0 flex-1 text-center text-base text-tinta" aria-live="polite">
        {/* Nunca AAAA-MM-DD: las fechas se escriben como se dicen (docs/UX.md). */}
        {comoRango(lunes, fechaMas(lunes, 4))}
      </p>

      <Flecha
        etiqueta="Semana siguiente"
        deshabilitada={enLaUltima}
        alTocar={() => alElegir(fechaMas(lunes, 7))}
      >
        <IconoSiguiente className="size-6" />
      </Flecha>
    </nav>
  )
}

function Flecha({
  etiqueta,
  deshabilitada = false,
  alTocar,
  children,
}: {
  etiqueta: string
  deshabilitada?: boolean
  alTocar: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={alTocar}
      disabled={deshabilitada}
      aria-label={etiqueta}
      className={cn(
        'flex min-h-14 w-11 shrink-0 items-center justify-center rounded-lg text-tinta-2',
        'foco',
        'active:bg-cuadro disabled:opacity-40 disabled:active:bg-transparent',
      )}
    >
      {children}
    </button>
  )
}
