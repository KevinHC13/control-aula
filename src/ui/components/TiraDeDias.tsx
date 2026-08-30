import { useCallback, useEffect, useRef } from 'react'

import { comoDate, fechaMas, ventanaDeDias } from '@/domain/fechas'
import type { Fecha } from '@/domain/values'
import { IconoAnterior, IconoCalendario, IconoSiguiente } from '@/ui/components/iconos'
import { comoDiaConNombre } from '@/ui/lib/fechas'
import { cn } from '@/ui/lib/utils'

/**
 * Días que carga la tira. Más de los que caben a propósito: son los que se
 * recorren deslizando, sin tocar un solo día que no interese. Tres meses cubren
 * de sobra lo que alguien corrige a mano; para más atrás está el calendario.
 */
const DIAS_EN_LA_TIRA = 90

const inicial = new Intl.DateTimeFormat('es-MX', { weekday: 'narrow' })

/**
 * La tira de días: calendario, separador, flecha, días que se deslizan, flecha.
 *
 * Los días viven en su propio contenedor con desplazamiento horizontal, así que
 * se recorren con el dedo. Las flechas quedan **fuera** de ese contenedor: no se
 * van con el desplazamiento, y avanzan o retroceden un día —que es lo que se
 * quiere al corregir— en lugar de mover la vista.
 *
 * La ventana nunca pasa de hoy: un día que no ha pasado no tiene asistencia que
 * capturar. Al cambiar el día seleccionado, la tira lo centra sola.
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
  const dias = ventanaDeDias(diaSeleccionado, hoy, DIAS_EN_LA_TIRA)
  const refLista = useRef<HTMLUListElement>(null)
  const yaCentro = useRef(false)

  const centrar = useCallback((behavior: ScrollBehavior) => {
    const seleccionado = refLista.current?.querySelector('[data-seleccionado="true"]')
    seleccionado?.scrollIntoView({
      inline: 'center',
      // `nearest` en el eje vertical: sin eso, centrar un día arrastraría la
      // página completa y la lista de alumnos brincaría.
      block: 'nearest',
      behavior,
    })
  }, [])

  useEffect(() => {
    // El primer centrado es instantáneo: una animación al abrir la pantalla se
    // vería como si la tira se acomodara sola. Los siguientes van suaves, que es
    // lo que hace legible el salto de las flechas.
    centrar(yaCentro.current ? 'smooth' : 'instant')
    yaCentro.current = true
  }, [centrar, diaSeleccionado])

  useEffect(() => {
    const lista = refLista.current
    if (!lista) return

    // Recentrar cuando cambia el ancho del contenedor. No es un lujo: al pintarse
    // la lista de alumnos aparece la barra de desplazamiento vertical, la tira se
    // angosta unos píxeles y el día de hoy quedaba cortado contra el borde. El
    // giro del iPad tiene el mismo efecto y Safari no dispara `resize` de forma
    // confiable.
    const observador = new ResizeObserver(() => centrar('instant'))
    observador.observe(lista)
    return () => observador.disconnect()
  }, [centrar])

  const enHoy = diaSeleccionado >= hoy

  return (
    <nav aria-label="Días" className="flex items-stretch gap-2">
      <button
        type="button"
        onClick={alAbrirCalendario}
        aria-label="Abrir calendario"
        aria-haspopup="dialog"
        className={cn(
          'flex min-h-14 w-12 shrink-0 items-center justify-center rounded-lg border border-linea',
          'bg-papel text-tinta-2',
          'foco',
        )}
      >
        <IconoCalendario className="size-6" />
      </button>

      {/* El calendario salta a cualquier día; las flechas y la tira se mueven de
          uno en uno. Son dos cosas distintas y el separador lo dice. */}
      <span aria-hidden className="my-1 w-px shrink-0 self-stretch bg-tinta-2/30" />

      <FlechaDia
        etiqueta="Día anterior"
        alTocar={() => alSeleccionar(fechaMas(diaSeleccionado, -1))}
      >
        <IconoAnterior className="size-6" />
      </FlechaDia>

      {/* `min-w-0` es lo que permite que el contenedor se encoja y desplace en
          vez de empujar las flechas fuera de la pantalla. La barra se esconde:
          en el iPad no existe, y en escritorio se comía tres píxeles de la fila. */}
      <ul
        ref={refLista}
        className={cn(
          'flex min-w-0 flex-1 gap-2 overflow-x-auto',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        {dias.map((fecha) => {
          const seleccionado = fecha === diaSeleccionado
          const fin = [0, 6].includes(comoDate(fecha).getDay())
          return (
            // `shrink-0`: sin él, flex encoge las cajas para que quepan todas y
            // el desplazamiento nunca se activa —los días salen cortados.
            <li key={fecha} className="shrink-0">
              <button
                type="button"
                onClick={() => alSeleccionar(fecha)}
                data-seleccionado={seleccionado}
                aria-current={seleccionado ? 'date' : undefined}
                aria-label={comoDiaConNombre(fecha)}
                className={cn(
                  'flex min-h-14 w-12 flex-col items-center justify-center rounded-lg border',
                  'foco',
                  seleccionado
                    ? 'border-marca bg-marca text-papel'
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

      <FlechaDia
        etiqueta="Día siguiente"
        // Hoy es el tope: no hay asistencia que capturar mañana.
        deshabilitada={enHoy}
        alTocar={() => alSeleccionar(fechaMas(diaSeleccionado, 1))}
      >
        <IconoSiguiente className="size-6" />
      </FlechaDia>
    </nav>
  )
}

function FlechaDia({
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
