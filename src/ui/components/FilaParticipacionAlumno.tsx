import { useEffect, useRef } from 'react'

import type { FilaParticipacion } from '@/application/participacion'
import { cn } from '@/ui/lib/utils'

/** Cuánto hay que sostener el dedo para que el toque reste en vez de sumar. */
const SOSTENER_MS = 500

/**
 * La fila del modo participación: un toque suma una, **sostener el dedo resta
 * una**.
 *
 * El mismo gesto de la asistencia con otro significado, así que la fila se ve
 * distinta: la barra es verde —no azul— y a la derecha va el número del día, en
 * grande, que es la cifra que cambia con el toque.
 *
 * El deshacer no es un botón aparte porque no hay lugar para treinta botones de
 * deshacer, y sin deshacer un toque de más obliga a salir de la pantalla —o a
 * dejarlo—. Es la única pulsación larga de la app, y por eso la fila lo dice
 * arriba, en el aviso del modo.
 */
export function FilaParticipacionAlumno({
  fila,
  meta,
  alSumar,
  alRestar,
}: {
  fila: FilaParticipacion
  /** La meta del trimestre, si el criterio está configurado. */
  meta: number | null
  alSumar: () => void
  alRestar: () => void
}) {
  const { alumno, delDia, delTrimestre } = fila
  const temporizador = useRef<number | null>(null)
  const restado = useRef(false)

  // Si la fila se desmonta con el dedo abajo —cambiar de día, apagar el modo— el
  // temporizador no puede sobrevivir y restar sobre una lista que ya no está.
  useEffect(() => cancelar, [])

  function cancelar() {
    if (temporizador.current !== null) {
      window.clearTimeout(temporizador.current)
      temporizador.current = null
    }
  }

  function empezar() {
    restado.current = false
    temporizador.current = window.setTimeout(() => {
      temporizador.current = null
      restado.current = true
      alRestar()
    }, SOSTENER_MS)
  }

  return (
    <button
      type="button"
      onPointerDown={empezar}
      onPointerUp={cancelar}
      onPointerLeave={cancelar}
      onPointerCancel={cancelar}
      // El `click` llega después del `pointerup`: si la pulsación larga ya restó,
      // este toque no debe además sumar.
      onClick={() => {
        if (restado.current) {
          restado.current = false
          return
        }
        alSumar()
      }}
      // Sostener el dedo en iPadOS abre el menú de selección si no se le dice que
      // no, y eso taparía justo la fila que se está tocando.
      onContextMenu={(e) => e.preventDefault()}
      aria-label={
        `${alumno.nombre}, ${delDia} ${delDia === 1 ? 'participación' : 'participaciones'} hoy` +
        `, ${delTrimestre} en el trimestre`
      }
      className={cn(
        'flex min-h-14 w-full touch-manipulation items-center gap-3 border-b border-linea',
        'bg-papel pr-3 text-left select-none',
        'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset',
        'active:bg-cuadro',
      )}
    >
      {/* Verde y no azul: el color dice en qué modo está la pantalla, sin leer. */}
      <span
        aria-hidden
        className={cn(
          'h-14 w-[7px] shrink-0',
          delDia > 0 ? 'bg-verde' : 'border-x border-linea bg-transparent',
        )}
      />
      <span className="cifra w-7 shrink-0 text-base text-tinta-2">{alumno.numero_lista}</span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base text-tinta">{alumno.nombre}</span>
        <span className="text-[13px] text-tinta-2">
          {delTrimestre === 0 ? (
            'sin participaciones en el trimestre'
          ) : (
            <>
              <span className="cifra">{delTrimestre}</span>
              {meta !== null ? (
                <>
                  {' de '}
                  <span className="cifra">{meta}</span> en el trimestre
                </>
              ) : (
                ' en el trimestre'
              )}
            </>
          )}
        </span>
      </span>

      {/* La cifra del día, grande: es la que se mueve con el toque. */}
      <span
        className={cn(
          'cifra shrink-0 text-2xl font-semibold',
          delDia > 0 ? 'text-verde' : 'text-linea',
        )}
      >
        {delDia > 0 ? delDia : '·'}
      </span>
    </button>
  )
}
