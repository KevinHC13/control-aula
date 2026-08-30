import { useMemo, useState } from 'react'

import { cerrarTrimestre, reabrirTrimestre } from '@/application/calificaciones'
import {
  agregarCriterio,
  ajustarPeso,
  copiarEsquemaDe,
  estadoDelReparto,
  fijarMetaParticipacion,
  fijarRetardosPorFalta,
  nombreSugerido,
  quitarCriterio,
  TIPOS_OFRECIDOS,
  trimestreDe,
  trimestreParaCopiar,
} from '@/application/evaluacion'
import type { CriterioDelTrimestre } from '@/data/ports/evaluacion'
import type { CriterioTrimestre, TipoCriterio, Trimestre } from '@/domain/entities'
import { esAutomatico, parametrosCompletos } from '@/domain/evaluacion'
import { fechaLocal } from '@/domain/fechas'
import { IconoAtras, IconoBasura } from '@/ui/components/iconos'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { useCicloEnCurso } from '@/ui/hooks/useCicloEnCurso'
import { useEsquemaTrimestre } from '@/ui/hooks/useEsquemaTrimestre'
import { cn } from '@/ui/lib/utils'

/**
 * Los criterios de cada trimestre y cuánto pesa cada uno.
 *
 * Vive en Ajustes por la misma razón que el ciclo escolar: se arma al empezar el
 * trimestre, no todos los días. Aquí sí hay un selector de trimestre —a
 * diferencia de la asistencia, que se atribuye por fecha— porque configurar el
 * trimestre que viene mientras se corre el actual es exactamente lo que ella
 * necesita poder hacer.
 *
 * El total corriente se ve siempre, pero **no bloquea guardar**: editar un
 * reparto pasa siempre por estados intermedios que no suman 100, y exigir que
 * cuadre para poder salir de la pantalla sería impedirle pensar a medias. Lo que
 * exige 100 es el **cierre**, y por eso el cierre vive aquí: es la única pantalla
 * donde esa cifra está a la vista, y cerrar desde otro lado obligaría a explicar
 * de nuevo por qué no se puede.
 */
export function CriteriosYPesos({ alVolver }: { alVolver: () => void }) {
  const { ciclo, cargando } = useCicloEnCurso()
  const hoy = useMemo(() => fechaLocal(new Date()), [])

  // Arranca en el trimestre de hoy: es el que ella está corriendo. Si hoy cae en
  // vacaciones, el primero, que es mejor que una pantalla vacía sin explicación.
  const [elegido, setElegido] = useState<number | null>(null)
  const numeroActivo = elegido ?? trimestreDe(hoy, ciclo)?.numero ?? 1
  const trimestre = ciclo?.trimestres.find((t) => t.numero === numeroActivo) ?? null

  const { esquema } = useEsquemaTrimestre(trimestre?.id ?? null)
  const reparto = estadoDelReparto(esquema)

  if (cargando) {
    return (
      <Marco alVolver={alVolver}>
        <p className="pt-6 text-base text-tinta-2" aria-live="polite">
          Cargando…
        </p>
      </Marco>
    )
  }

  if (!ciclo) {
    return (
      <Marco alVolver={alVolver}>
        <p className="pt-6 text-base text-tinta-2">
          Primero hay que registrar el ciclo escolar, en Grupo → Ajustes → Ciclo escolar.
          Los criterios se definen por trimestre, y todavía no hay ninguno.
        </p>
      </Marco>
    )
  }

  const origen = trimestre ? trimestreParaCopiar(trimestre, ciclo) : null
  const abierto = trimestre?.estado === 'abierto'

  return (
    <Marco alVolver={alVolver}>
      <div className="flex flex-col gap-4 pt-4">
        <nav aria-label="Trimestre" className="flex gap-2">
          {ciclo.trimestres.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={t.numero === numeroActivo}
              onClick={() => setElegido(t.numero)}
              className={cn(
                'h-11 flex-1 rounded-md border px-3 text-base outline-none',
                'foco',
                t.numero === numeroActivo
                  ? 'border-marca bg-marca text-papel'
                  : 'border-linea text-tinta hover:bg-cuadro',
              )}
            >
              T{t.numero}
              {t.estado === 'cerrado' && (
                <span className="block text-apoyo opacity-80">cerrado</span>
              )}
            </button>
          ))}
        </nav>

        {trimestre && <Reparto trimestre={trimestre} criterios={esquema?.criterios ?? []} />}

        {/* El total va arriba de la lista de altas: es la cifra que ella
            persigue mientras reparte. */}
        <div className="flex items-baseline gap-2 border-t border-linea pt-3">
          <p className="cifra text-3xl font-semibold text-tinta">
            {reparto.total}
            <span className="font-sans text-base text-tinta-2"> / 100</span>
          </p>
          <p className="text-base text-tinta-2" aria-live="polite">
            {reparto.cierra
              ? 'Los valores suman 100: el trimestre ya se puede cerrar'
              : reparto.faltan > 0
                ? `Faltan ${reparto.faltan} puntos por repartir`
                : `Sobran ${-reparto.faltan} puntos: hay que bajar algún criterio`}
          </p>
        </div>

        {!reparto.cierra && (
          <p className="text-apoyo text-tinta-2">
            Cada criterio recibe un porcentaje, y entre todos deben sumar 100. Los cambios
            se guardan automáticamente, así que puede dejarse a medias y continuar después:
            los 100 solo se exigen al cerrar el trimestre.
          </p>
        )}

        {abierto && trimestre && <Alta trimestre={trimestre} />}

        {abierto && trimestre && origen && esquema?.criterios.length === 0 && (
          <div className="flex flex-col items-start gap-2 border-t border-linea pt-3">
            <p className="text-base text-tinta-2">
              También puede copiarse la configuración del trimestre {origen.numero}: se
              traen sus criterios y sus porcentajes, pero no sus actividades ni sus
              calificaciones.
            </p>
            <Button variant="outline" onClick={() => void copiarEsquemaDe(origen, trimestre)}>
              Copiar la configuración del trimestre {origen.numero}
            </Button>
          </div>
        )}

        {trimestre && (
          <CierreDelTrimestre trimestre={trimestre} criterios={esquema?.criterios ?? []} />
        )}
      </div>
    </Marco>
  )
}

function Marco({ alVolver, children }: { alVolver: () => void; children: React.ReactNode }) {
  return (
    <section aria-labelledby="titulo-criterios" className="mx-auto flex max-w-2xl flex-col">
      <header className="flex items-center gap-1">
        <Button size="icon" variant="ghost" onClick={alVolver} aria-label="Volver a Ajustes">
          <IconoAtras className="size-6" />
        </Button>
        <h1 id="titulo-criterios" className="text-2xl font-bold text-tinta">
          Criterios y pesos
        </h1>
      </header>
      {children}
    </section>
  )
}

function Reparto({
  trimestre,
  criterios,
}: {
  trimestre: Trimestre
  criterios: CriterioDelTrimestre[]
}) {
  if (criterios.length === 0) {
    return (
      <p className="text-base text-tinta-2">
        Todavía no hay criterios en este trimestre. El primero se agrega en el formulario
        de abajo.
      </p>
    )
  }

  return (
    <ul className="border-t border-linea">
      {criterios.map((c) => (
        <FilaCriterio key={c.ponderado.id} criterio={c} trimestre={trimestre} />
      ))}
    </ul>
  )
}

function FilaCriterio({
  criterio,
  trimestre,
}: {
  criterio: CriterioDelTrimestre
  trimestre: Trimestre
}) {
  const { ponderado, criterio: catalogo } = criterio
  const abierto = trimestre.estado === 'abierto'
  const etiqueta =
    TIPOS_OFRECIDOS.find((t) => t.tipo === catalogo.tipo)?.etiqueta ?? catalogo.tipo

  // El campo se maneja como texto y no como número: `type="number"` en iPad abre
  // el teclado con desplazamiento y arriesga el zoom de Safari, y además deja
  // pasar estados intermedios ("") que un `number` convierte en NaN.
  const [texto, setTexto] = useState(String(ponderado.peso))
  const [editando, setEditando] = useState(false)

  function escribir(valor: string) {
    setEditando(true)
    setTexto(valor)
    const limpio = valor.replace(/[^\d]/g, '')
    if (limpio === '') return
    const peso = Number(limpio)
    if (peso > 100) return
    void ajustarPeso(trimestre, ponderado.id, peso)
  }

  return (
    <li className="border-b border-linea">
      <div className="flex min-h-14 items-center gap-2">
        <span aria-hidden className="h-14 w-[7px] shrink-0 bg-marca" />

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-base font-medium text-tinta">{catalogo.nombre}</span>
          <span className="text-apoyo text-tinta-2">{etiqueta}</span>
        </span>

        <Input
          type="text"
          inputMode="numeric"
          aria-label={`Peso de ${catalogo.nombre}`}
          // Mientras ella escribe manda el campo; al salir, manda la base. Sin
          // eso, borrar el campo para teclear otro número lo repondría solo.
          value={editando ? texto : String(ponderado.peso)}
          disabled={!abierto}
          onChange={(e) => escribir(e.target.value)}
          onBlur={() => setEditando(false)}
          className="cifra w-16 shrink-0 text-center"
        />
        <span aria-hidden className="text-base text-tinta-2">
          %
        </span>

        <button
          type="button"
          onClick={() => void quitarCriterio(trimestre, ponderado.id)}
          disabled={!abierto}
          aria-label={`Quitar ${catalogo.nombre} del trimestre ${trimestre.numero}`}
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-md text-tinta-2',
            'foco hover:bg-cuadro hover:text-rojo',
            'disabled:pointer-events-none disabled:opacity-50',
          )}
        >
          <IconoBasura className="size-5" />
        </button>
      </div>

      {esAutomatico(catalogo.tipo) && (
        <ParametrosAutomaticos
          tipo={catalogo.tipo}
          ponderado={ponderado}
          trimestre={trimestre}
        />
      )}
    </li>
  )
}

/**
 * Lo que hay que configurarle a un criterio automático, y de dónde sale.
 *
 * Va debajo de su fila y no en una pantalla aparte: son dos datos, y mandarla a
 * otro lado para poner un número sería cobrarle un viaje por cada criterio.
 *
 * Los tres dicen de dónde salen. Con toda la asistencia y toda la bitácora
 * contando para una calificación, esconder el origen haría que lo descubra en la
 * boleta (D-020).
 */
function ParametrosAutomaticos({
  tipo,
  ponderado,
  trimestre,
}: {
  tipo: TipoCriterio
  ponderado: CriterioTrimestre
  trimestre: Trimestre
}) {
  const abierto = trimestre.estado === 'abierto'

  if (tipo === 'auto_conducta') {
    // Conducta no pide nada: su escala es fija. Se dice para que no parezca que
    // falta configurarla.
    return (
      <p className="pb-3 pl-[15px] text-apoyo text-tinta-2">
        Esta calificación se obtiene de los reportes anotados en la Bitácora. Un solo
        reporte no la baja; dos la dejan en cinco y tres o más la dejan en cero. No hay nada
        que configurar aquí.
      </p>
    )
  }

  if (tipo === 'auto_puntualidad') {
    return (
      <div className="flex flex-col gap-1 pb-3 pl-[15px]">
        <p className="text-apoyo text-tinta-2">
          Esta calificación se obtiene de la asistencia del trimestre: cada falta la baja.
          ¿Cuántos retardos equivalen a una falta?
        </p>
        <div role="group" aria-label="Retardos por falta" className="flex flex-wrap gap-2">
          {([null, 1, 2, 3, 4] as const).map((opcion) => (
            <button
              key={opcion ?? 'ninguno'}
              type="button"
              disabled={!abierto}
              aria-pressed={ponderado.retardos_por_falta === opcion}
              onClick={() => void fijarRetardosPorFalta(trimestre, ponderado, opcion)}
              className={cn(
                'h-11 min-w-11 rounded-md border px-3 text-base outline-none',
                'foco',
                'disabled:pointer-events-none disabled:opacity-50',
                ponderado.retardos_por_falta === opcion
                  ? 'border-marca bg-marca/10 text-tinta'
                  : 'border-linea text-tinta-2 hover:bg-cuadro',
              )}
            >
              {opcion === null ? 'No cuentan' : <span className="cifra">{opcion}</span>}
            </button>
          ))}
        </div>
        <p className="text-apoyo text-tinta-2">
          Las faltas justificadas nunca bajan esta calificación. Este valor puede cambiarse
          en cualquier momento y nada se pierde: la puntualidad se vuelve a calcular sola a
          partir de la asistencia registrada.
        </p>
      </div>
    )
  }

  return (
    <MetaDeParticipacion ponderado={ponderado} trimestre={trimestre} />
  )
}

/**
 * La meta de participación: cuántas participaciones valen el 100 %.
 *
 * Nace en 5 (D-021) y el campo se maneja como texto por lo mismo que el peso: en
 * iPad, `type="number"` arriesga el zoom de Safari y convierte los estados
 * intermedios en NaN. Un valor inválido —vacío, cero— no se guarda; se deja
 * escribir y no se manda.
 */
function MetaDeParticipacion({
  ponderado,
  trimestre,
}: {
  ponderado: CriterioTrimestre
  trimestre: Trimestre
}) {
  const abierto = trimestre.estado === 'abierto'
  const [texto, setTexto] = useState(String(ponderado.meta_participacion ?? ''))
  const [editando, setEditando] = useState(false)

  function escribir(valor: string) {
    setEditando(true)
    setTexto(valor)
    const limpio = valor.replace(/[^\d]/g, '')
    if (limpio === '') return
    const meta = Number(limpio)
    // Cero no se guarda: sería dividir entre cero. Se queda en el campo mientras
    // ella teclea el 5 de «50», que es justo por qué esto no corrige el texto.
    if (meta < 1) return
    void fijarMetaParticipacion(trimestre, ponderado, meta)
  }

  const incompleto = !parametrosCompletos('auto_participacion', ponderado)

  return (
    <div className="flex flex-col gap-1 pb-3 pl-[15px]">
      <p className="text-apoyo text-tinta-2">
        Esta calificación se obtiene de las participaciones registradas en la pantalla de
        Asistencia.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`meta-${ponderado.id}`} className="text-base text-tinta">
          Participaciones necesarias para obtener diez
        </label>
        <Input
          id={`meta-${ponderado.id}`}
          type="text"
          inputMode="numeric"
          value={editando ? texto : String(ponderado.meta_participacion ?? '')}
          disabled={!abierto}
          onChange={(e) => escribir(e.target.value)}
          onBlur={() => setEditando(false)}
          className="cifra w-16 shrink-0 text-center"
        />
      </div>
      <p className={cn('text-apoyo', incompleto ? 'text-rojo' : 'text-tinta-2')}>
        {incompleto
          ? 'Falta indicar este número. Sin él, la participación no se puede calificar.'
          : 'Quien alcance esa cantidad obtiene diez; con menos, la calificación es proporcional.'}
      </p>
    </div>
  )
}

function Alta({ trimestre }: { trimestre: Trimestre }) {
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<TipoCriterio>('entregable')
  const [error, setError] = useState('')

  async function agregar() {
    setError('')
    try {
      await agregarCriterio(trimestre, nombre, tipo)
      setNombre('')
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo agregar')
    }
  }

  return (
    <form
      className="flex flex-col gap-2 border-t border-linea pt-3"
      onSubmit={(e) => {
        e.preventDefault()
        void agregar()
      }}
    >
      <label htmlFor="nombre-criterio" className="text-base font-medium text-tinta">
        Agregar un criterio
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="nombre-criterio"
          value={nombre}
          placeholder="Tareas, Examen, Portafolio…"
          onChange={(e) => setNombre(e.target.value)}
          className="min-w-48 flex-1"
        />
        <Button type="submit" disabled={nombre.trim() === ''}>
          Agregar
        </Button>
      </div>

      <fieldset className="flex flex-wrap gap-2 pt-1">
        <legend className="sr-only">Tipo de criterio</legend>
        {TIPOS_OFRECIDOS.map((opcion) => (
          <button
            key={opcion.tipo}
            type="button"
            aria-pressed={tipo === opcion.tipo}
            onClick={() => {
              setTipo(opcion.tipo)
              // Un automático llega con su nombre puesto: «Puntualidad» no es una
              // decisión que valga preguntarle, y sin nombre no se puede agregar.
              // Se respeta lo que ella haya escrito.
              const sugerido = nombreSugerido(opcion.tipo)
              if (sugerido !== '' && nombre.trim() === '') setNombre(sugerido)
            }}
            className={cn(
              'flex h-11 flex-col items-start justify-center rounded-md border px-3 outline-none',
              'foco',
              tipo === opcion.tipo
                ? 'border-marca bg-marca/10 text-tinta'
                : 'border-linea text-tinta-2 hover:bg-cuadro',
            )}
          >
            <span className="text-base leading-tight">{opcion.etiqueta}</span>
            <span className="text-apoyo leading-tight opacity-80">{opcion.ayuda}</span>
          </button>
        ))}
      </fieldset>

      {error && (
        <p role="alert" className="text-apoyo text-rojo">
          {error}
        </p>
      )}
    </form>
  )
}

/**
 * Cerrar el trimestre, y reabrirlo.
 *
 * Cerrar congela: los pesos quedan fijos, no se aceptan calificaciones nuevas y se
 * escribe un snapshot por alumno. Sin eso, corregir un porcentaje en enero
 * cambiaría una calificación ya reportada en la boleta de diciembre.
 *
 * Las dos acciones **confirman**, y por razones distintas. Cerrar con alumnos sin
 * calificación es legítimo —uno que llegó la última semana— pero no es lo que se
 * espera al apretar el botón, así que el caso de uso lo rechaza y aquí se pregunta.
 * Reabrir es lo que permite que una calificación ya reportada cambie, o sea
 * exactamente lo que cerrar existe para impedir.
 */
function CierreDelTrimestre({
  trimestre,
  criterios,
}: {
  trimestre: Trimestre
  criterios: CriterioDelTrimestre[]
}) {
  const [problema, setProblema] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState<'cerrar' | 'reabrir' | null>(null)
  const reparto = estadoDelReparto({ trimestre, criterios })

  async function cerrar(confirmado = false) {
    setProblema(null)
    try {
      await cerrarTrimestre(trimestre, criterios.map((c) => c.ponderado), confirmado)
      setConfirmando(null)
    } catch (fallo) {
      const mensaje = fallo instanceof Error ? fallo.message : 'No se pudo cerrar'
      // Los alumnos sin calificación son una advertencia, no un impedimento: se
      // vuelve a preguntar. Los pesos que no cuadran sí son un no.
      if (/sin calificación/.test(mensaje)) setConfirmando('cerrar')
      setProblema(mensaje)
    }
  }

  async function reabrir() {
    setProblema(null)
    try {
      await reabrirTrimestre(trimestre, true)
      setConfirmando(null)
    } catch (fallo) {
      setProblema(fallo instanceof Error ? fallo.message : 'No se pudo reabrir')
    }
  }

  if (trimestre.estado === 'cerrado') {
    return (
      <div className="flex flex-col gap-2 border-t border-linea pt-3">
        <p className="text-base text-tinta">
          Este trimestre está <strong>cerrado</strong>. Sus criterios y porcentajes ya no
          pueden cambiarse, y las calificaciones son las que quedaron guardadas al
          cerrarlo.
        </p>

        {confirmando === 'reabrir' ? (
          <div
            role="alertdialog"
            aria-label="Confirmar la reapertura"
            className="flex flex-col gap-3 rounded-md border-l-[7px] border-rojo bg-rojo/5 px-4 py-3"
          >
            <p className="text-base text-tinta">
              Al reabrirlo se descartan las calificaciones guardadas y vuelven a calcularse
              con lo que esté registrado. Si las boletas ya se entregaron, los resultados
              pueden dejar de coincidir con ellas.
            </p>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={() => void reabrir()}>
                Reabrir el trimestre
              </Button>
              <Button variant="outline" onClick={() => setConfirmando(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="self-start" onClick={() => setConfirmando('reabrir')}>
            Reabrir el trimestre
          </Button>
        )}

        {problema && <p className="text-base text-rojo">{problema}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 border-t border-linea pt-3">
      <p className="text-base text-tinta-2">
        Al cerrar el trimestre se guarda la calificación de cada alumno tal como está en
        este momento, y ya no podrán registrarse más evaluaciones ni modificarse los
        porcentajes.
      </p>

      {confirmando === 'cerrar' && (
        <div
          role="alertdialog"
          aria-label="Confirmar el cierre"
          className="flex flex-col gap-3 rounded-md border-l-[7px] border-rojo bg-rojo/5 px-4 py-3"
        >
          <p className="text-base text-tinta">
            {problema}. Se guardarán sin calificación, y así aparecerán en el resultado del
            trimestre.
          </p>
          <div className="flex gap-2">
            <Button variant="destructive" onClick={() => void cerrar(true)}>
              Cerrar de todos modos
            </Button>
            <Button variant="outline" onClick={() => setConfirmando(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <Button
        className="self-start"
        disabled={!reparto.cierra}
        onClick={() => void cerrar()}
      >
        Cerrar el trimestre
      </Button>

      {!reparto.cierra && (
        <p className="text-apoyo text-tinta-2">
          Para cerrar el trimestre, los porcentajes de los criterios deben sumar 100.
        </p>
      )}

      {problema && confirmando === null && <p className="text-base text-rojo">{problema}</p>}
    </div>
  )
}
