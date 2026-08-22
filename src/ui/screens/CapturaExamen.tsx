import { useMemo, useState } from 'react'

import { CAMPOS_CON_NOMBRE } from '@/application/evaluacion'
import {
  camposDelExamen,
  conDigito,
  contarConResultado,
  examenListo,
  type FilaExamen,
  filasDeExamen,
  guardarPreguntasExamen,
  registrarAciertos,
  siguienteSinResultado,
  sinUltimoDigito,
} from '@/application/examen'
import type { ExamenDelTrimestre } from '@/data/ports/evaluacion'
import type { Trimestre } from '@/domain/entities'
import type { CampoFormativo } from '@/domain/values'
import { IconoAtras } from '@/ui/components/iconos'
import { TecladoNumerico } from '@/ui/components/TecladoNumerico'
import { Button } from '@/ui/components/ui/button'
import { useResultadosDeExamen } from '@/ui/hooks/useResultadosDeExamen'
import { cn } from '@/ui/lib/utils'

/** Tope de tres dígitos al decir cuántas preguntas trae un campo. */
const MAX_PREGUNTAS = 999

/**
 * Capturar el examen: aciertos por campo formativo, alumno por alumno.
 *
 * Hay **un** examen por trimestre y cuelga del `CriterioTrimestre`, no de una
 * actividad (D-018). Por eso esta pantalla no sale de la lista de actividades sino
 * de su propia sección.
 *
 * Dos pasos: decir cuántas preguntas trae cada campo —una vez por trimestre, con
 * botón de Guardar porque es configuración— y capturar —cada dígito escribe, sin
 * botón—. Sin preguntas no hay denominador y no hay nada que capturar.
 *
 * Todo se teclea con el **teclado de la app**: el nativo de iPadOS tapa media
 * pantalla y hace zoom al enfocar.
 */
export function CapturaExamen({
  trimestre,
  examen,
  alVolver,
}: {
  trimestre: Trimestre
  examen: ExamenDelTrimestre
  alVolver: () => void
}) {
  const { alumnos, resultados, cargando } = useResultadosDeExamen(examen.ponderado.id)
  const campos = useMemo(() => camposDelExamen(examen), [examen])
  const filas = useMemo(
    () => filasDeExamen(alumnos, resultados, campos),
    [alumnos, resultados, campos],
  )
  const { capturados, total } = contarConResultado(filas)
  const abierto = trimestre.estado === 'abierto'
  const listo = examenListo(examen)

  // Las preguntas en edición. `null` es «no las estoy editando»; un examen sin
  // configurar entra directo al editor, porque no hay otra cosa que hacer aquí.
  const [borrador, setBorrador] = useState<Partial<Record<CampoFormativo, number>> | null>(
    listo ? null : {},
  )
  const [campoDelBorrador, setCampoDelBorrador] = useState<CampoFormativo>(
    CAMPOS_CON_NOMBRE[0].campo,
  )
  const [problema, setProblema] = useState<string | null>(null)

  // Qué alumno está abierto, por índice, y en qué campo se está tecleando.
  const [indice, setIndice] = useState<number | null>(null)
  const [campoActivo, setCampoActivo] = useState(0)
  const fila = indice === null ? undefined : filas[indice]
  const campo = campos[campoActivo]

  const abrirAlumno = (i: number | null) => {
    setIndice(i)
    setCampoActivo(0)
  }

  const guardar = async () => {
    if (borrador === null) return
    try {
      await guardarPreguntasExamen(trimestre, examen, borrador)
      setBorrador(null)
      setProblema(null)
    } catch (error) {
      setProblema(error instanceof Error ? error.message : 'No se pudo guardar')
    }
  }

  const tecleaEnElBorrador = (siguiente: number | null) => {
    if (borrador === null) return
    const copia = { ...borrador }
    if (siguiente === null) delete copia[campoDelBorrador]
    else copia[campoDelBorrador] = siguiente
    setBorrador(copia)
  }

  return (
    <section aria-labelledby="titulo-examen" className="flex flex-col gap-4">
      <header className="flex items-start gap-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => (indice === null ? alVolver() : abrirAlumno(null))}
          aria-label={indice === null ? 'Volver' : 'Volver a la lista'}
        >
          <IconoAtras className="size-6" />
        </Button>
        <div className="min-w-0 flex-1 pt-2">
          <h1 id="titulo-examen" className="truncate text-2xl font-bold text-tinta">
            {examen.criterio.nombre}
          </h1>
          <p className="text-[13px] text-tinta-2">
            T{trimestre.numero} · <span className="cifra">{examen.ponderado.peso}%</span>
            {listo && ` · ${campos.length} de 4 campos`}
          </p>
        </div>
        {listo && abierto && borrador === null && indice === null && (
          <Button
            variant="ghost"
            className="mt-1 shrink-0"
            onClick={() => {
              setBorrador(examen.config?.preguntas ?? {})
              setProblema(null)
            }}
          >
            Preguntas
          </Button>
        )}
      </header>

      {!abierto && (
        <p className="text-[13px] text-tinta-2">
          Este trimestre está cerrado: se puede consultar, no cambiar.
        </p>
      )}

      {borrador !== null ? (
        <>
          <div>
            <h2 className="text-base font-medium text-tinta">
              ¿Cuántas preguntas tiene el examen en cada campo?
            </h2>
            <p className="mt-1 text-[13px] text-tinta-2">
              Los campos que el examen no evalúa se dejan en blanco. La calificación de cada
              campo se obtiene de los aciertos sobre el total de preguntas. Este total puede
              corregirse después sin perder los aciertos ya registrados.
            </p>
          </div>

          <ul className="flex flex-col gap-2">
            {CAMPOS_CON_NOMBRE.map((c) => (
              <li key={c.campo}>
                <CajaDeCifra
                  etiqueta={c.nombre}
                  cifra={borrador[c.campo]}
                  activa={campoDelBorrador === c.campo}
                  deshabilitada={!abierto}
                  alTocar={() => setCampoDelBorrador(c.campo)}
                />
              </li>
            ))}
          </ul>

          <TecladoNumerico
            deshabilitado={!abierto}
            alDigito={(digito) =>
              tecleaEnElBorrador(
                conDigito(borrador[campoDelBorrador], digito, MAX_PREGUNTAS),
              )
            }
            alBorrar={() => tecleaEnElBorrador(sinUltimoDigito(borrador[campoDelBorrador]))}
          />

          {problema && <p className="text-base text-rojo">{problema}</p>}

          {/* Aquí sí hay Guardar: esto se hace una vez por trimestre y un total a
              medio teclear no debe quedar guardado. */}
          <div className="flex gap-2">
            <Button className="flex-1" disabled={!abierto} onClick={() => void guardar()}>
              Guardar
            </Button>
            {listo && (
              <Button
                variant="outline"
                onClick={() => {
                  setBorrador(null)
                  setProblema(null)
                }}
              >
                Cancelar
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="text-base text-tinta-2" aria-live="polite">
            <span className="cifra text-2xl font-semibold text-tinta">{capturados}</span> de{' '}
            <span className="cifra">{total}</span> con resultado
          </p>

          {fila === undefined ? (
            <>
              {/* -mx-4 para que la barra de color toque el borde, como en las otras
                  dos capturas: la columna se lee de corrido. */}
              <ul className="-mx-4 border-t border-linea">
                {filas.map((f, i) => (
                  <li key={f.alumno.id}>
                    <FilaExamenAlumno
                      fila={f}
                      campos={campos.length}
                      alTocar={() => abrirAlumno(i)}
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
                  disabled={capturados === total}
                  onClick={() => abrirAlumno(siguienteSinResultado(filas, -1))}
                >
                  {capturados === total ? 'Todos capturados' : 'Capturar al que falta'}
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
                    ? 'Con resultado'
                    : `${fila.capturados} de ${campos.length} campos`}
                </p>
              </div>

              <ul className="flex flex-col gap-2">
                {campos.map((c, i) => (
                  <li key={c.campo}>
                    <CajaDeCifra
                      etiqueta={c.nombre}
                      cifra={fila.aciertos[c.campo]}
                      de={c.preguntas}
                      activa={i === campoActivo}
                      deshabilitada={!abierto}
                      alTocar={() => setCampoActivo(i)}
                    />
                  </li>
                ))}
              </ul>

              {/* El dígito que sacaría la cifra del rango no entra: `conDigito`
                  devuelve null y el toque no escribe nada. Es más barato que un
                  error que hay que leer y descartar. */}
              <TecladoNumerico
                deshabilitado={!abierto || campo === undefined}
                alDigito={(digito) => {
                  if (campo === undefined) return
                  const siguiente = conDigito(
                    fila.aciertos[campo.campo],
                    digito,
                    campo.preguntas,
                  )
                  if (siguiente === null) return
                  void registrarAciertos(trimestre, examen, fila, campo, siguiente)
                }}
                alBorrar={() => {
                  if (campo === undefined) return
                  void registrarAciertos(
                    trimestre,
                    examen,
                    fila,
                    campo,
                    sinUltimoDigito(fila.aciertos[campo.campo]),
                  )
                }}
              />

              {abierto && (
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => abrirAlumno(siguienteSinResultado(filas, indice ?? -1))}
                  >
                    Siguiente sin resultado
                  </Button>
                  <Button variant="outline" onClick={() => abrirAlumno(null)}>
                    Lista
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}

/**
 * Una cifra que se teclea: el nombre del campo, el número y su denominador cuando
 * lo tiene. Toda la caja es el objetivo táctil y elegirla es lo que dirige el
 * teclado.
 *
 * La cifra se pinta grande porque es el único dato que se está capturando, y una
 * cifra mal leída en un examen no se detecta después.
 */
function CajaDeCifra({
  etiqueta,
  cifra,
  de,
  activa,
  deshabilitada,
  alTocar,
}: {
  etiqueta: string
  cifra: number | undefined
  de?: number
  activa: boolean
  deshabilitada: boolean
  alTocar: () => void
}) {
  return (
    <button
      type="button"
      onClick={alTocar}
      disabled={deshabilitada}
      aria-current={activa}
      // Se arma aparte porque «sin capturar de 15» no se entiende leído en voz
      // alta: sin cifra, el total va como aclaración, no como denominador.
      aria-label={
        cifra === undefined
          ? `${etiqueta}: sin capturar${de === undefined ? '' : `, de ${de} preguntas`}`
          : `${etiqueta}: ${cifra}${de === undefined ? '' : ` de ${de}`}`
      }
      className={cn(
        'flex min-h-14 w-full items-center gap-3 rounded-md border px-3 text-left',
        'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'disabled:opacity-60',
        activa ? 'border-azul bg-cuadro' : 'border-linea bg-papel',
      )}
    >
      <span className="min-w-0 flex-1 text-base text-tinta">{etiqueta}</span>
      <span className="cifra shrink-0 text-2xl font-semibold text-tinta">
        {cifra ?? <span className="text-tinta-2">—</span>}
      </span>
      {de !== undefined && (
        <span className="cifra shrink-0 text-base text-tinta-2">/ {de}</span>
      )}
    </button>
  )
}

/**
 * Una fila del grupo. La barra dice de un vistazo quién ya tiene su examen
 * capturado, con la misma distinción que las otras dos capturas.
 */
function FilaExamenAlumno({
  fila,
  campos,
  alTocar,
}: {
  fila: FilaExamen
  campos: number
  alTocar: () => void
}) {
  const aMedias = !fila.completa && fila.capturados > 0

  return (
    <button
      type="button"
      onClick={alTocar}
      aria-label={`${fila.alumno.nombre}, ${
        fila.completa
          ? 'con resultado'
          : aMedias
            ? `${fila.capturados} de ${campos} campos`
            : 'sin capturar'
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
      <span className={cn('shrink-0 text-base', fila.completa ? 'text-tinta-2' : 'text-rojo')}>
        {fila.completa ? '' : aMedias ? `${fila.capturados}/${campos}` : 'sin capturar'}
      </span>
    </button>
  )
}
