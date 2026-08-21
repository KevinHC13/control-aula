import { useMemo, useState } from 'react'

import { cerrarTrimestre, reabrirTrimestre } from '@/application/calificaciones'
import {
  agregarCriterio,
  ajustarPeso,
  copiarEsquemaDe,
  estadoDelReparto,
  quitarCriterio,
  TIPOS_OFRECIDOS,
  trimestreDe,
  trimestreParaCopiar,
} from '@/application/evaluacion'
import type { CriterioDelTrimestre } from '@/data/ports/evaluacion'
import type { TipoCriterio, Trimestre } from '@/domain/entities'
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
          Primero hay que abrir el ciclo escolar. Los criterios cuelgan de un trimestre, y
          todavía no hay trimestres.
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
                'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                t.numero === numeroActivo
                  ? 'border-azul bg-azul text-papel'
                  : 'border-linea text-tinta hover:bg-cuadro',
              )}
            >
              T{t.numero}
              {t.estado === 'cerrado' && (
                <span className="block text-[13px] opacity-80">cerrado</span>
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
              ? 'El reparto cuadra'
              : reparto.faltan > 0
                ? `Faltan ${reparto.faltan} para cerrar el trimestre`
                : `Sobran ${-reparto.faltan} para cerrar el trimestre`}
          </p>
        </div>

        {!reparto.cierra && (
          <p className="text-[13px] text-tinta-2">
            Los cambios se guardan solos aunque el reparto no cuadre. Los 100 se piden al
            cerrar el trimestre, no antes.
          </p>
        )}

        {abierto && trimestre && <Alta trimestre={trimestre} />}

        {abierto && trimestre && origen && esquema?.criterios.length === 0 && (
          <div className="flex flex-col items-start gap-2 border-t border-linea pt-3">
            <p className="text-base text-tinta-2">
              O copia el reparto del trimestre {origen.numero}: trae sus criterios y sus
              pesos, no sus actividades ni sus calificaciones.
            </p>
            <Button variant="outline" onClick={() => void copiarEsquemaDe(origen, trimestre)}>
              Copiar del trimestre {origen.numero}
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
        Todavía no hay criterios en este trimestre. El primero se agrega abajo.
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
        <span aria-hidden className="h-14 w-[7px] shrink-0 bg-azul" />

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-base font-medium text-tinta">{catalogo.nombre}</span>
          <span className="text-[13px] text-tinta-2">{etiqueta}</span>
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
            'outline-none hover:bg-cuadro hover:text-rojo focus-visible:ring-[3px] focus-visible:ring-ring/50',
            'disabled:pointer-events-none disabled:opacity-50',
          )}
        >
          <IconoBasura className="size-5" />
        </button>
      </div>

    </li>
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
        Agregar criterio
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
            onClick={() => setTipo(opcion.tipo)}
            className={cn(
              'flex h-11 flex-col items-start justify-center rounded-md border px-3 outline-none',
              'focus-visible:ring-[3px] focus-visible:ring-ring/50',
              tipo === opcion.tipo
                ? 'border-azul bg-azul/10 text-tinta'
                : 'border-linea text-tinta-2 hover:bg-cuadro',
            )}
          >
            <span className="text-base leading-tight">{opcion.etiqueta}</span>
            <span className="text-[13px] leading-tight opacity-80">{opcion.ayuda}</span>
          </button>
        ))}
      </fieldset>

      {error && (
        <p role="alert" className="text-[13px] text-rojo">
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
          Este trimestre está <strong>cerrado</strong>: sus criterios y pesos ya no cambian, y
          sus calificaciones vienen del corte, no de recalcular.
        </p>

        {confirmando === 'reabrir' ? (
          <div
            role="alertdialog"
            aria-label="Confirmar la reapertura"
            className="flex flex-col gap-3 rounded-md border-l-[7px] border-rojo bg-rojo/5 px-4 py-3"
          >
            <p className="text-base text-tinta">
              Al reabrirlo se borra el corte y las calificaciones vuelven a calcularse de lo
              capturado. Si ya entregaste boletas, pueden dejar de coincidir con el papel.
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
        Cerrar el trimestre congela sus pesos y guarda la calificación de cada alumno como
        quedó. Después de cerrarlo, capturar deja de ser posible.
      </p>

      {confirmando === 'cerrar' && (
        <div
          role="alertdialog"
          aria-label="Confirmar el cierre"
          className="flex flex-col gap-3 rounded-md border-l-[7px] border-rojo bg-rojo/5 px-4 py-3"
        >
          <p className="text-base text-tinta">
            {problema}. Se guardan sin calificación, y eso es lo que va a decir el corte.
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
        <p className="text-[13px] text-tinta-2">
          Para cerrarlo, los pesos tienen que sumar 100.
        </p>
      )}

      {problema && confirmando === null && <p className="text-base text-rojo">{problema}</p>}
    </div>
  )
}
