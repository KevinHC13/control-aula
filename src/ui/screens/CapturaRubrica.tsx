import { useMemo, useState } from 'react'

import {
  calificarRenglon,
  contarCalificados,
  type FilaCalificacion,
  filasDeCalificacion,
  siguienteSinCalificar,
} from '@/application/calificacion'
import { CAMPOS_CON_NOMBRE } from '@/application/evaluacion'
import type { ActividadConEstado } from '@/data/ports/evaluacion'
import type { Trimestre } from '@/domain/entities'
import { NIVELES } from '@/domain/values'
import type { Nivel } from '@/domain/values'
import { IconoAtras } from '@/ui/components/iconos'
import { Button } from '@/ui/components/ui/button'
import { useEvaluacionesDeActividad } from '@/ui/hooks/useEvaluacionesDeActividad'
import { useRubricas } from '@/ui/hooks/useRubricas'
import { cn } from '@/ui/lib/utils'

/**
 * Calificar una actividad con rúbrica, alumno por alumno.
 *
 * Dos vistas y una sola pantalla: la lista del grupo —que dice quién ya está
 * calificado y quién no— y el alumno abierto, con un renglón de rúbrica por
 * bloque. Se puede entrar a cualquiera fuera de orden, y **Siguiente** salta al
 * siguiente *sin calificar*, dando la vuelta si hace falta: ella no recorre el
 * grupo en un solo pase.
 *
 * Cada toque de nivel escribe. No hay botón de Guardar, igual que en la captura
 * binaria y en la asistencia.
 *
 * Abrir **no** materializa nada, al contrario de `CapturaEntregas`: aquí ningún
 * nivel es el probable, y 30 registros vacíos harían que la actividad se viera
 * calificada sin un solo toque.
 */
export function CapturaRubrica({
  trimestre,
  actividad,
  alVolver,
  alEditar,
}: {
  trimestre: Trimestre
  actividad: ActividadConEstado
  alVolver: () => void
  alEditar: () => void
}) {
  const { alumnos, evaluaciones, cargando } = useEvaluacionesDeActividad(actividad.actividad.id)
  const { rubricas, cargando: cargandoRubricas } = useRubricas()

  const rubrica = rubricas.find((r) => r.rubrica.id === actividad.actividad.rubrica_id)
  // Memorizado aparte para que el arreglo vacío no cambie de identidad en cada
  // render y vuelva a cruzar las 30 filas sin que nada haya cambiado.
  const renglones = useMemo(() => rubrica?.criterios ?? [], [rubrica])

  const filas = useMemo(
    () => filasDeCalificacion(alumnos, evaluaciones, renglones),
    [alumnos, evaluaciones, renglones],
  )
  const { calificados, total } = contarCalificados(filas)
  const abierto = trimestre.estado === 'abierto'

  // Qué alumno está abierto, por índice en la lista. `null` es la lista del
  // grupo. Vive aquí y no en el store: no cruza pantallas.
  const [indice, setIndice] = useState<number | null>(null)
  const fila = indice === null ? undefined : filas[indice]

  const campo = CAMPOS_CON_NOMBRE.find((c) => c.campo === actividad.actividad.campo)?.nombre

  const irAlQueFalta = (desde: number) => {
    const siguiente = siguienteSinCalificar(filas, desde)
    setIndice(siguiente)
  }

  return (
    <section aria-labelledby="titulo-rubrica" className="flex flex-col gap-4">
      <header className="flex items-start gap-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => (indice === null ? alVolver() : setIndice(null))}
          aria-label={indice === null ? 'Volver' : 'Volver a la lista'}
        >
          <IconoAtras className="size-6" />
        </Button>
        <div className="min-w-0 flex-1 pt-2">
          <h1 id="titulo-rubrica" className="truncate text-2xl font-bold text-tinta">
            {actividad.actividad.nombre}
          </h1>
          <p className="text-[13px] text-tinta-2">
            <span className="cifra">{actividad.actividad.fecha}</span>
            {campo && ` · ${campo}`}
            {rubrica && ` · ${rubrica.rubrica.nombre}`}
          </p>
        </div>
        {indice === null && (
          <Button variant="ghost" onClick={alEditar} className="mt-1 shrink-0">
            Editar
          </Button>
        )}
      </header>

      {/* El progreso, en la misma forma que el contador de presentes: una cifra,
          no un tablero. aria-live porque cambia al tocar un nivel, sin que nada
          reciba el foco. */}
      <p className="text-base text-tinta-2" aria-live="polite">
        <span className="cifra text-2xl font-semibold text-tinta">{calificados}</span> de{' '}
        <span className="cifra">{total}</span> calificados
      </p>

      {!abierto && (
        <p className="text-[13px] text-tinta-2">
          Este trimestre está cerrado: se puede consultar, no cambiar.
        </p>
      )}

      {!rubrica ? (
        <p className="text-base text-tinta-2">
          {cargandoRubricas
            ? 'Cargando…'
            : 'La rúbrica de esta actividad ya no existe. Hay que elegirle otra desde Editar.'}
        </p>
      ) : fila === undefined ? (
        <>
          {/* -mx-4 para que la barra de color toque el borde, como en la captura
              de entregas: la columna se lee de corrido. */}
          <ul className="-mx-4 border-t border-linea">
            {filas.map((f, i) => (
              <li key={f.alumno.id}>
                <FilaCalificacionAlumno
                  fila={f}
                  renglones={renglones.length}
                  alTocar={() => setIndice(i)}
                />
              </li>
            ))}
          </ul>

          {!cargando && filas.length === 0 && (
            <p className="text-base text-tinta-2">
              Todavía no hay alumnos. La lista se carga desde Grupo → Ajustes.
            </p>
          )}

          {abierto && filas.length > 0 && (
            <Button
              className="self-start"
              disabled={calificados === total}
              onClick={() => irAlQueFalta(-1)}
            >
              {calificados === total ? 'Todos calificados' : 'Calificar al que falta'}
            </Button>
          )}
        </>
      ) : (
        <>
          <div>
            <p className="text-xl font-semibold text-tinta">
              <span className="cifra font-normal text-tinta-2">
                {fila.alumno.numero_lista}
              </span>{' '}
              {fila.alumno.nombre}
            </p>
            <p className="text-[13px] text-tinta-2">
              {fila.completa
                ? 'Calificado'
                : `${fila.capturados} de ${renglones.length} renglones`}
            </p>
          </div>

          <ul className="flex flex-col gap-5">
            {renglones.map((renglon) => (
              <li key={renglon.id} className="flex flex-col gap-2">
                <p className="text-base font-medium text-tinta">{renglon.nombre}</p>
                {/* Los cuatro niveles con su descriptor a la vista: elegir sin
                    leerlo es lo que hace que en diciembre nadie recuerde qué
                    quiso decir «Bien» en septiembre. */}
                <div className="flex flex-col gap-2">
                  {NIVELES.map((nombre, n) => (
                    <BotonNivel
                      key={nombre}
                      nombre={nombre}
                      descriptor={renglon.descriptores[n] ?? ''}
                      elegido={fila.niveles[renglon.id] === (n as Nivel)}
                      deshabilitado={!abierto}
                      alTocar={() =>
                        void calificarRenglon(
                          trimestre,
                          actividad,
                          fila,
                          renglon.id,
                          n as Nivel,
                        )
                      }
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>

          {abierto && (
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => irAlQueFalta(indice ?? -1)}>
                Siguiente sin calificar
              </Button>
              <Button variant="outline" onClick={() => setIndice(null)}>
                Lista
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

/**
 * Una fila del grupo. Toda la fila es el objetivo táctil y lleva al alumno; la
 * barra dice de un vistazo si ya está calificado, como el calendario de asistencia
 * distingue un día capturado de uno sin pasar.
 */
function FilaCalificacionAlumno({
  fila,
  renglones,
  alTocar,
}: {
  fila: FilaCalificacion
  renglones: number
  alTocar: () => void
}) {
  const aMedias = !fila.completa && fila.capturados > 0

  return (
    <button
      type="button"
      onClick={alTocar}
      aria-label={`${fila.alumno.nombre}, ${
        fila.completa
          ? 'calificado'
          : aMedias
            ? `${fila.capturados} de ${renglones} renglones`
            : 'sin calificar'
      }`}
      className={cn(
        'flex min-h-14 w-full items-center gap-3 border-b border-linea bg-papel pr-3 text-left',
        'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset',
        'active:bg-cuadro',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'h-14 w-[7px] shrink-0',
          fila.completa ? 'bg-azul' : aMedias ? 'bg-rojo' : 'border-x border-linea',
        )}
      />
      <span className="cifra w-7 shrink-0 text-base text-tinta-2">
        {fila.alumno.numero_lista}
      </span>
      <span className="min-w-0 flex-1 truncate text-base text-tinta">{fila.alumno.nombre}</span>
      <span
        className={cn('shrink-0 text-base', fila.completa ? 'text-tinta-2' : 'text-rojo')}
      >
        {fila.completa ? '' : aMedias ? `${fila.capturados}/${renglones}` : 'sin calificar'}
      </span>
    </button>
  )
}

/** Un nivel con su descriptor. Objetivo táctil de renglón completo. */
function BotonNivel({
  nombre,
  descriptor,
  elegido,
  deshabilitado,
  alTocar,
}: {
  nombre: string
  descriptor: string
  elegido: boolean
  deshabilitado: boolean
  alTocar: () => void
}) {
  return (
    <button
      type="button"
      onClick={alTocar}
      disabled={deshabilitado}
      aria-pressed={elegido}
      className={cn(
        'flex min-h-11 w-full items-start gap-3 rounded-md border px-3 py-2 text-left',
        'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'active:bg-cuadro disabled:opacity-60',
        elegido
          ? 'border-azul bg-azul text-papel active:bg-azul'
          : 'border-linea bg-papel text-tinta',
      )}
    >
      <span className="w-20 shrink-0 text-base font-medium">{nombre}</span>
      <span className={cn('min-w-0 flex-1 text-base', elegido ? 'opacity-90' : 'text-tinta-2')}>
        {descriptor}
      </span>
    </button>
  )
}
