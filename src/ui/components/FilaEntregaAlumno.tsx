import type { FilaEntrega } from '@/application/entregas'
import { cn } from '@/ui/lib/utils'

/**
 * Toda la fila es el objetivo táctil, igual que en asistencia: un toque alterna
 * entregada / no entregada. Sin menú, sin botones por estado y sin confirmación —
 * son 30 filas y el presupuesto es de 15 segundos (docs/UX.md).
 *
 * La barra de 7 px hace el trabajo: azul si entregó, roja si no. La columna
 * bicolor se escanea de un vistazo, sin leer un solo nombre.
 */
export function FilaEntregaAlumno({
  fila,
  alTocar,
  deshabilitada,
}: {
  fila: FilaEntrega
  alTocar: () => void
  deshabilitada: boolean
}) {
  const { alumno, entregada } = fila

  return (
    <button
      type="button"
      onClick={alTocar}
      disabled={deshabilitada}
      // aria-label completo: el nombre solo no dice en qué estado quedó, y el
      // estado se comunica por color.
      aria-label={`${alumno.nombre}, ${entregada ? 'Entregada' : 'No entregada'}`}
      className={cn(
        'flex min-h-14 w-full items-center gap-3 border-b border-linea bg-papel pr-3 text-left',
        'foco-dentro',
        'active:bg-cuadro disabled:opacity-60',
      )}
    >
      <span
        aria-hidden
        className={cn('h-14 w-[7px] shrink-0', entregada ? 'bg-azul' : 'bg-rojo')}
      />
      <span className="cifra w-7 shrink-0 text-base text-tinta-2">{alumno.numero_lista}</span>
      <span className="min-w-0 flex-1 truncate text-base text-tinta">{alumno.nombre}</span>
      <span className={cn('shrink-0 text-base', entregada ? 'text-tinta-2' : 'text-rojo')}>
        {entregada ? '' : 'No entregó'}
      </span>
    </button>
  )
}
