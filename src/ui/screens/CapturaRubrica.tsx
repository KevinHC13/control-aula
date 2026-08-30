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
import { Cabecera } from '@/ui/components/Cabecera'
import { comoDiaCorto } from '@/ui/lib/fechas'
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
      <Cabecera
        titulo={actividad.actividad.nombre}
        id="titulo-rubrica"
        alVolver={() => (indice === null ? alVolver() : setIndice(null))}
        etiquetaVolver={indice === null ? 'Volver' : 'Volver a la lista'}
        detalle={
          <>
            {comoDiaCorto(actividad.actividad.fecha)}
            {campo && ` · ${campo}`}
            {rubrica && ` · ${rubrica.rubrica.nombre}`}
          </>
        }
        accion={
          indice === null ? (
            <Button variant="ghost" onClick={alEditar} className="mt-1">
              Editar
            </Button>
          ) : undefined
        }
      />

      {/* El progreso, en la misma forma que el contador de presentes: una cifra,
          no un tablero. aria-live porque cambia al tocar un nivel, sin que nada
          reciba el foco. */}
      <p className="text-base text-tinta-2" aria-live="polite">
        <span className="cifra text-2xl font-semibold text-tinta">{calificados}</span> de{' '}
        <span className="cifra">{total}</span> calificados
      </p>

      {abierto && total > 0 && (
        <p className="text-apoyo text-tinta-2">
          Seleccione un alumno y marque el nivel que le corresponde en cada aspecto de la
          rúbrica. Los cambios se guardan solos, y un alumno cuenta como calificado cuando
          tiene todos sus aspectos marcados.
        </p>
      )}

      {!abierto && (
        <p className="text-apoyo text-tinta-2">
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
            <p className="text-apoyo text-tinta-2">
              {fila.completa
                ? 'Calificado'
                : `${fila.capturados} de ${renglones.length} aspectos`}
            </p>
          </div>

          {/* La rúbrica en tabla, como está en el papel: un renglón por fila y
              un nivel por columna. Los descriptores quedan a la vista todos a la
              vez, que es lo que hace comparable «Bien» con «Regular» sin ir y
              venir por la pantalla.

              -mx-4 para ganar el ancho de los márgenes: en cuatro columnas cada
              píxel es texto que no se corta. */}
          <div className="-mx-4 overflow-x-auto">
            {/* table-fixed para que las cuatro columnas queden del mismo ancho:
                  un descriptor largo no debe angostar los otros tres, o la tabla
                  deja de leerse como matriz. */}
            <table className="w-full min-w-[36rem] table-fixed border-collapse">
              <caption className="sr-only">
                Rúbrica {rubrica.rubrica.nombre}: un renglón por fila, un nivel por
                columna
              </caption>
              <thead>
                <tr>
                  {/* La esquina va vacía: encabezar la columna de renglones con
                      una palabra le quitaría ancho a los descriptores. */}
                  <th scope="col" className="w-[7.5rem] px-2 pb-1" />
                  {NIVELES.map((nombre) => (
                    <th
                      key={nombre}
                      scope="col"
                      className="px-1 pb-1 text-center text-apoyo font-medium text-tinta-2"
                    >
                      {nombre}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {renglones.map((renglon) => (
                  <tr key={renglon.id} className="border-t border-linea">
                    <th
                      scope="row"
                      className="px-2 py-2 text-left align-top text-base font-medium text-tinta"
                    >
                      {renglon.nombre}
                    </th>
                    {/* Sin align-top y con h-full en el botón, las cuatro celdas
                        de una fila quedan de la misma altura: un descriptor de tres
                        líneas no deja a los otros tres flotando a media fila. */}
                    {NIVELES.map((nombre, n) => (
                      <td key={nombre} className="p-1">
                        <CeldaNivel
                          nivel={nombre}
                          renglon={renglon.nombre}
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
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
            ? `${fila.capturados} de ${renglones} aspectos`
            : 'sin calificar'
      }`}
      className={cn(
        'flex min-h-14 w-full items-center gap-3 border-b border-linea bg-papel pr-3 text-left',
        'foco-dentro',
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

/**
 * Una celda de la tabla: el descriptor de ese nivel para ese renglón, y todo el
 * recuadro es el objetivo táctil.
 *
 * El `aria-label` repite renglón y nivel porque la celda sola no los dice: con
 * lector de pantalla, «Casi completo» no ubica en qué fila ni en qué columna cayó
 * el toque.
 */
function CeldaNivel({
  nivel,
  renglon,
  descriptor,
  elegido,
  deshabilitado,
  alTocar,
}: {
  nivel: string
  renglon: string
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
      aria-label={`${renglon}, ${nivel}: ${descriptor}`}
      className={cn(
        'flex h-full min-h-14 w-full items-start break-words rounded-md border px-2 py-2 text-left text-base',
        'foco',
        'active:bg-cuadro disabled:opacity-60',
        elegido
          ? 'border-marca bg-marca text-papel active:bg-marca'
          : 'border-linea bg-papel text-tinta-2',
      )}
    >
      {descriptor}
    </button>
  )
}
