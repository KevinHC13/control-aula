import type { FilaResumen } from '@/application/resumen'
import { comoCalificacion } from '@/domain/calculo'
import { cn } from '@/ui/lib/utils'

/**
 * Un alumno en el resumen del grupo: sus dos cifras y la marca.
 *
 * La barra roja es la misma señal que en la lista de asistencia y en la bitácora:
 * una columna que se escanea sin leer un nombre. Aquí marca *hay que mirar a este*,
 * y el criterio va escrito en la pantalla —no es un color sin explicación—.
 */
export function FilaResumenAlumno({ fila }: { fila: FilaResumen }) {
  const { alumno, dias, ausencias, retardos, porcentaje, promedio, riesgo } = fila

  return (
    <li className="flex min-h-14 items-center gap-3 border-b border-linea pr-3">
      <span
        aria-hidden
        className={cn(
          'h-14 w-[7px] shrink-0',
          riesgo ? 'bg-rojo' : 'border-x border-linea bg-transparent',
        )}
      />
      <span className="cifra w-7 shrink-0 text-base text-tinta-2">{alumno.numero_lista}</span>

      <span className="flex min-w-0 flex-1 flex-col py-2">
        <span className="truncate text-base text-tinta">{alumno.nombre}</span>
        <span className="text-[13px] text-tinta-2">
          {dias === 0 ? (
            'sin días capturados'
          ) : (
            <>
              <span className="cifra">{dias}</span> días
              {ausencias > 0 && (
                <>
                  {' · '}
                  <span className="text-rojo">
                    <span className="cifra">{ausencias}</span> faltas
                  </span>
                </>
              )}
              {retardos > 0 && (
                <>
                  {' · '}
                  <span className="text-ambar">
                    <span className="cifra">{retardos}</span> retardos
                  </span>
                </>
              )}
            </>
          )}
        </span>
      </span>

      {/* Las dos cifras, en la misma columna en todas las filas: es lo que permite
          recorrerlas de arriba a abajo sin leer las etiquetas. */}
      <span className="cifra w-14 shrink-0 text-right text-base text-tinta">
        {porcentaje === null ? '—' : `${Math.round(porcentaje)}%`}
      </span>
      <span className="cifra w-12 shrink-0 text-right text-base text-tinta">
        {comoCalificacion(promedio)}
      </span>
    </li>
  )
}
