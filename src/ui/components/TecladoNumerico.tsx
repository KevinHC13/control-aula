import { cn } from '@/ui/lib/utils'

import { IconoBorrar } from './iconos'

/**
 * Teclado numérico **dentro de la app**, no el de iPadOS.
 *
 * No es preferencia: el teclado nativo tapa media pantalla, hace zoom al enfocar
 * un control de menos de 16 px y su tecla de borrar no está donde el pulgar la
 * espera cuando el iPad está apoyado en el escritorio. Con teclado propio, la
 * cifra que se está capturando queda a la vista y el objetivo táctil lo decidimos
 * nosotros (docs/UX.md).
 *
 * No escribe en ningún `input`: emite el dígito y quien lo usa decide qué hacer
 * con él. Por eso también sirve para configurar el examen y para capturarlo, que
 * escriben en lugares distintos.
 */
export function TecladoNumerico({
  alDigito,
  alBorrar,
  deshabilitado = false,
}: {
  alDigito: (digito: number) => void
  alBorrar: () => void
  deshabilitado?: boolean
}) {
  return (
    <div
      role="group"
      aria-label="Teclado numérico"
      className="grid grid-cols-3 gap-2"
    >
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digito) => (
        <Tecla
          key={digito}
          etiqueta={String(digito)}
          deshabilitado={deshabilitado}
          alTocar={() => alDigito(digito)}
        />
      ))}
      {/* El cero va abajo, como en cualquier teclado, y borrar a su derecha: la
          fila de abajo es la que el pulgar alcanza sin levantar la mano. */}
      <span aria-hidden />
      <Tecla etiqueta="0" deshabilitado={deshabilitado} alTocar={() => alDigito(0)} />
      <Tecla
        etiqueta="Borrar"
        deshabilitado={deshabilitado}
        alTocar={alBorrar}
        icono={<IconoBorrar className="size-6" />}
      />
    </div>
  )
}

function Tecla({
  etiqueta,
  icono,
  deshabilitado,
  alTocar,
}: {
  etiqueta: string
  icono?: React.ReactNode
  deshabilitado: boolean
  alTocar: () => void
}) {
  return (
    <button
      type="button"
      onClick={alTocar}
      disabled={deshabilitado}
      aria-label={etiqueta}
      className={cn(
        // 3.5rem de alto: por debajo de 44 px una tecla se falla, y fallar una
        // tecla en una captura de 30 alumnos se paga treinta veces.
        'flex h-14 items-center justify-center rounded-md border border-linea bg-papel',
        'cifra text-2xl text-tinta outline-none',
        'focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'active:bg-cuadro disabled:opacity-60',
      )}
    >
      {icono ?? etiqueta}
    </button>
  )
}
