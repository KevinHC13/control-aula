import type { FilaAsistencia } from '@/application/asistencia'
import type { EstadoAsistencia } from '@/domain/values'
import { cn } from '@/ui/lib/utils'

/**
 * La barra de color de 7 px es el elemento distintivo: convierte la lista en una
 * columna bicolor que se escanea de un vistazo — quién faltó se ve sin leer un
 * solo nombre (docs/UX.md).
 */
const BARRA: Record<EstadoAsistencia, string> = {
  presente: 'bg-azul',
  ausente: 'bg-rojo',
  retardo: 'bg-ambar',
  justificada: 'bg-verde',
}

const ETIQUETA: Record<EstadoAsistencia, string> = {
  presente: 'Presente',
  ausente: 'Ausente',
  retardo: 'Retardo',
  justificada: 'Justificada',
}

const TEXTO: Record<EstadoAsistencia, string> = {
  presente: 'text-tinta-2',
  ausente: 'text-rojo',
  retardo: 'text-ambar',
  justificada: 'text-verde',
}

/**
 * Toda la fila es el objetivo táctil: un toque cicla el estado. No hay menú ni
 * botones por estado — cuatro estados en un ciclo es más rápido que abrir algo
 * (docs/UX.md).
 */
export function FilaAlumno({
  fila,
  alTocar,
}: {
  fila: FilaAsistencia
  alTocar: () => void
}) {
  const { alumno, estado } = fila

  return (
    <button
      type="button"
      onClick={alTocar}
      // aria-label completo: el nombre solo no dice en qué estado quedó, y el
      // estado se comunica por color.
      aria-label={`${alumno.nombre}, ${ETIQUETA[estado]}`}
      className={cn(
        'flex min-h-14 w-full items-center gap-3 border-b border-linea bg-papel pr-3 text-left',
        'foco-dentro',
        'active:bg-cuadro',
      )}
    >
      <span aria-hidden className={cn('h-14 w-[7px] shrink-0', BARRA[estado])} />
      <span className="cifra w-7 shrink-0 text-base text-tinta-2">{alumno.numero_lista}</span>
      <span className="min-w-0 flex-1 truncate text-base text-tinta">{alumno.nombre}</span>
      <span className={cn('shrink-0 text-base', TEXTO[estado])}>
        {estado === 'presente' ? '' : ETIQUETA[estado]}
      </span>
    </button>
  )
}
