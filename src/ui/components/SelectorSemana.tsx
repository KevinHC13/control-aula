import { fechaMas } from '@/domain/fechas'
import type { Fecha } from '@/domain/values'
import { IconoAnterior, IconoSiguiente } from '@/ui/components/iconos'
import { comoRango } from '@/ui/lib/fechas'
import { cn } from '@/ui/lib/utils'

/**
 * De qué semana se está hablando, y cómo se cambia.
 *
 * **Es un control, y tiene que parecerlo.** La primera versión eran dos iconos
 * tenues, sin borde ni superficie, empujados a los extremos de la pantalla: en el
 * escritorio quedaban a un palmo del texto que modifican, y nada decía que fueran
 * tocables ni sobre qué actuaban. Ahora los tres elementos van dentro de un mismo
 * recuadro —flecha, periodo, flecha—, que es lo que los ata: se lee como una sola
 * pieza que cambia lo que dice en medio.
 *
 * Ancho acotado y no de lado a lado: estirado en una pantalla grande vuelve a
 * separar las flechas del periodo, que era el problema. Acotado se abarca con una
 * mano, que es como se usa en el iPad.
 *
 * Las flechas caminan de una en una y `›` se apaga en la semana de hoy —una semana
 * que no ha pasado no tiene asistencia que contar—, las mismas reglas que la tira
 * de días de la asistencia.
 *
 * Sin el año: se camina de lunes en lunes dentro del mismo ciclo, y repetirlo en
 * cada paso parte la etiqueta en dos renglones sin decir nada nuevo. El PDF sí lo
 * lleva, porque esa hoja se separa de su iPad.
 *
 * El rango se enseña de **lunes a viernes** aunque la semana se lea hasta el
 * domingo: es la semana de clases, y decir «al 13 de septiembre» donde ella lee «al
 * viernes 11» sería contar los días que nadie fue a la escuela. Lo que se capture
 * en sábado sigue saliendo en el detalle de abajo.
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
    <nav
      aria-label="Semana"
      className="flex min-h-12 w-full max-w-md items-stretch overflow-hidden rounded-md border border-linea bg-papel"
    >
      <Flecha etiqueta="Semana anterior" alTocar={() => alElegir(fechaMas(lunes, -7))}>
        <IconoAnterior className="size-6" />
      </Flecha>

      {/* El dato del control va en medio y en el color del texto principal: es lo
          que las dos flechas cambian. */}
      <p
        className="flex min-w-0 flex-1 items-center justify-center border-x border-linea px-2 text-center text-base text-tinta"
        aria-live="polite"
      >
        {/* Nunca AAAA-MM-DD: las fechas se escriben como se dicen (docs/UX.md). */}
        {comoRango(lunes, fechaMas(lunes, 4), { anio: false })}
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
        // 48 px de lado: por encima del mínimo de 44, y con el recuadro alrededor
        // el área tocable se ve, que es la mitad del trabajo.
        'flex w-12 shrink-0 items-center justify-center text-tinta',
        'foco-dentro',
        'hover:bg-cuadro active:bg-cuadro',
        'disabled:opacity-40 disabled:hover:bg-transparent disabled:active:bg-transparent',
      )}
    >
      {children}
    </button>
  )
}
