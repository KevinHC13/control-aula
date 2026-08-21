import { useState } from 'react'

import {
  alumnosParaEquipos,
  cuantosEquipos,
  formarEquipos,
  type ModoDeReparto,
} from '@/application/equipos'
import { IconoAtras } from '@/ui/components/iconos'
import { Button } from '@/ui/components/ui/button'
import { useAsistenciaDelDia } from '@/ui/hooks/useAsistenciaDelDia'
import { plural } from '@/ui/lib/plural'
import { cn } from '@/ui/lib/utils'
import { useInterfaz } from '@/ui/store/interfaz'

/** Los repartos que se piden de verdad. Un campo libre para esto es un estorbo. */
const OPCIONES = [2, 3, 4, 5, 6] as const

/**
 * Formar equipos.
 *
 * La segunda de las dos funciones que se usan **con los niños mirando la
 * pantalla**, así que los nombres van grandes y nada hace esperar: se arma al
 * toque y se rehace al toque.
 *
 * **No guarda nada.** Los equipos viven en el estado de esta pantalla y se van con
 * ella, como el calendario del mes o la pestaña activa: son estado de interfaz, no
 * un dato del salón (D-021). El día que pida «los equipos de ayer» se paga una
 * tabla, una fecha y una pantalla de historial; para armar equipos en el momento,
 * no.
 *
 * Vive en *Grupo* y no en *Asistencia* porque es una herramienta sobre la
 * composición del salón, no sobre el día —aunque se pueda armar con los presentes
 * del día, que es el caso normal—.
 */
export function Equipos({ alVolver }: { alVolver: () => void }) {
  const diaSeleccionado = useInterfaz((s) => s.diaSeleccionado)
  const { filas, cargando } = useAsistenciaDelDia(diaSeleccionado)

  const [modo, setModo] = useState<ModoDeReparto>('equipos')
  const [cantidad, setCantidad] = useState(4)
  const [soloPresentes, setSoloPresentes] = useState(true)
  // El reparto se deriva de la semilla, igual que el sorteado en la ruleta: así
  // «volver a sortear» es cambiar un número y no hay dos verdades que sincronizar.
  const [semilla, setSemilla] = useState<number | null>(null)

  const alumnos = alumnosParaEquipos(filas, soloPresentes)
  const equipos = semilla === null ? [] : formarEquipos(alumnos, modo, cantidad, semilla)
  // Cuántos salen de verdad, para poder decir que se pidieron más de los posibles
  // en vez de pintar tarjetas vacías.
  const posibles = cuantosEquipos(alumnos.length, modo, cantidad)
  const pedidos = modo === 'equipos' ? cantidad : posibles

  return (
    <section aria-labelledby="titulo-equipos" className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={alVolver} aria-label="Volver a Grupo">
          <IconoAtras className="size-6" />
        </Button>
        <h1 id="titulo-equipos" className="text-2xl font-bold text-tinta">
          Equipos
        </h1>
      </header>

      <div className="flex flex-col gap-3">
        <div role="group" aria-label="Cómo repartir" className="flex gap-2">
          {(
            [
              { valor: 'equipos', etiqueta: 'Número de equipos' },
              { valor: 'por_equipo', etiqueta: 'Niños por equipo' },
            ] as const
          ).map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              aria-pressed={modo === opcion.valor}
              onClick={() => setModo(opcion.valor)}
              className={cn(
                'h-11 flex-1 rounded-md border px-3 text-base outline-none',
                'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                modo === opcion.valor
                  ? 'border-azul bg-azul text-papel'
                  : 'border-linea text-tinta hover:bg-cuadro',
              )}
            >
              {opcion.etiqueta}
            </button>
          ))}
        </div>

        <div
          role="group"
          aria-label={modo === 'equipos' ? 'Cuántos equipos' : 'Cuántos niños por equipo'}
          className="flex flex-wrap gap-2"
        >
          {OPCIONES.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={cantidad === n}
              onClick={() => setCantidad(n)}
              className={cn(
                'cifra h-11 min-w-11 rounded-md border px-3 text-base outline-none',
                'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                cantidad === n
                  ? 'border-azul bg-azul/10 text-tinta'
                  : 'border-linea text-tinta-2 hover:bg-cuadro',
              )}
            >
              {n}
            </button>
          ))}
        </div>

        <button
          type="button"
          aria-pressed={soloPresentes}
          onClick={() => setSoloPresentes((solo) => !solo)}
          className={cn(
            'min-h-11 self-start rounded-md border px-3 text-base outline-none',
            'focus-visible:ring-[3px] focus-visible:ring-ring/50',
            soloPresentes
              ? 'border-verde bg-verde/10 text-tinta'
              : 'border-linea text-tinta-2 hover:bg-cuadro',
          )}
        >
          {soloPresentes ? 'Solo los presentes de hoy' : 'Todo el grupo'}
        </button>

        <p className="text-[13px] text-tinta-2">
          {cargando
            ? 'Cargando…'
            : soloPresentes
              ? `${alumnos.length} en el salón hoy — sin los ausentes ni las faltas justificadas`
              : `${alumnos.length} en el grupo, vinieran o no`}
        </p>

        <Button
          className="self-start"
          disabled={alumnos.length === 0}
          onClick={() => setSemilla(Math.random())}
        >
          {semilla === null ? 'Formar equipos' : 'Volver a sortear'}
        </Button>

        {alumnos.length === 0 && !cargando && (
          <p className="text-base text-tinta-2">
            No hay a quién repartir. {soloPresentes ? 'Hoy no hay nadie presente.' : ''}
          </p>
        )}

        {pedidos > posibles && (
          <p className="text-base text-tinta-2">
            Pediste <span className="cifra">{pedidos}</span> equipos y hay{' '}
            <span className="cifra">{alumnos.length}</span>{' '}
            {plural(alumnos.length, 'alumno', 'alumnos')}: salen{' '}
            <span className="cifra">{posibles}</span>, de uno. No se arman equipos
            vacíos.
          </p>
        )}
      </div>

      {equipos.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {equipos.map((equipo) => (
            <li
              key={equipo.numero}
              className="rounded-md border-l-[7px] border-azul bg-cuadro/40 px-3 py-2"
            >
              <p className="text-base font-medium text-tinta">
                Equipo <span className="cifra">{equipo.numero}</span>{' '}
                <span className="font-normal text-tinta-2">
                  · <span className="cifra">{equipo.integrantes.length}</span>
                </span>
              </p>
              {/* Los nombres son lo que se lee de lejos, así que van al tamaño del
                  cuerpo y no en letra chica. */}
              <ul className="mt-1">
                {equipo.integrantes.map((alumno) => (
                  <li key={alumno.id} className="text-base text-tinta">
                    {alumno.nombre}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
