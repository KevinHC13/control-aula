import type { FilaImportada } from '@/application/importacion'
import { IconoCerrar } from '@/ui/components/iconos'
import { cn } from '@/ui/lib/utils'

/**
 * Una fila de la revisión previa a guardar la lista importada.
 *
 * Se lee como lista y se edita como formulario. Esa es toda la idea: de 30
 * alumnos, la maestra corrige dos o tres, así que lo que domina es *leer*. Los
 * campos van sin marco ni fondo hasta que se enfocan —siguen siendo `input`, con
 * su altura táctil y sus 16 px— y la fila entera mantiene el idioma de la lista
 * de asistencia: alto de 56 px, línea inferior, barra de color a la izquierda.
 *
 * El estilo de campo se define aquí una sola vez y no se parchea por sitio de
 * uso (docs/DECISIONES.md D-010).
 */
const CAMPO = cn(
  'h-11 min-w-0 rounded-md border border-transparent bg-transparent px-2 text-base text-tinta',
  'outline-none transition-colors',
  'hover:border-linea focus:border-ring focus:bg-papel focus:ring-[3px] focus:ring-ring/50',
  'placeholder:text-tinta-2',
)

export function FilaRevision({
  fila,
  indice,
  alEditar,
  alQuitar,
}: {
  fila: FilaImportada
  indice: number
  alEditar: (campo: keyof FilaImportada, valor: string) => void
  alQuitar: () => void
}) {
  const malo = fila.problema !== undefined

  return (
    <li className={cn('border-b border-linea', malo && 'bg-rojo/5')}>
      <div className="flex min-h-14 items-center gap-1">
        {/* Misma barra de 7 px que la fila de asistencia: marca la fila con
            problema sin depender de leer el mensaje. */}
        <span aria-hidden className={cn('h-14 w-[7px] shrink-0', malo ? 'bg-rojo' : 'bg-transparent')} />

        <input
          type="text"
          inputMode="numeric"
          aria-label={`Número de lista de ${fila.nombre || `la fila ${indice + 1}`}`}
          value={fila.numero_lista === 0 ? '' : fila.numero_lista}
          onChange={(e) => alEditar('numero_lista', e.target.value)}
          className={cn(CAMPO, 'cifra w-11 shrink-0 text-center text-tinta-2')}
        />

        <input
          type="text"
          aria-label={`Nombre del alumno ${indice + 1}`}
          value={fila.nombre}
          placeholder="Escribe el nombre"
          onChange={(e) => alEditar('nombre', e.target.value)}
          className={cn(CAMPO, 'flex-1')}
        />

        <input
          type="text"
          inputMode="numeric"
          aria-label={`Fecha de nacimiento de ${fila.nombre || `la fila ${indice + 1}`}`}
          value={fila.fecha_nacimiento}
          placeholder="—"
          onChange={(e) => alEditar('fecha_nacimiento', e.target.value)}
          className={cn(CAMPO, 'cifra w-32 shrink-0 text-tinta-2')}
        />

        <button
          type="button"
          onClick={alQuitar}
          aria-label={`Quitar a ${fila.nombre || `la fila ${indice + 1}`} de la lista`}
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-md text-tinta-2',
            'foco hover:bg-cuadro hover:text-rojo',
          )}
        >
          <IconoCerrar className="size-5" />
        </button>
      </div>

      {/* El CURP se enseña pero no se edita aquí: son dieciocho caracteres que
          nadie va a teclear en una lista de treinta, y la fila no tiene un
          cuarto campo que quepa en el iPad. Se corrige en Ajustes → Alumnos.
          Está a la vista porque de él sale la fecha de la izquierda. */}
      {fila.curp !== '' && (
        <p className={cn('cifra pb-1 pl-[3.25rem] text-apoyo', malo ? 'text-rojo' : 'text-tinta-2')}>
          {fila.curp}
        </p>
      )}

      {malo && (
        <p className="pb-2 pl-[3.25rem] text-apoyo text-rojo">{fila.problema}</p>
      )}
    </li>
  )
}
