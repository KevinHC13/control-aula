import { useState } from 'react'

import {
  activarRubrica,
  borrarRubrica,
  desactivarRubrica,
  guardarRubrica,
  renglonVacio,
  type RubricaEnEdicion,
  rubricaEnEdicion,
  rubricaLista,
  rubricaVacia,
  revisarRubrica,
} from '@/application/evaluacion'
import type { RubricaConCriterios } from '@/data/ports/evaluacion'
import { NIVELES } from '@/domain/values'
import { IconoAtras, IconoBasura } from '@/ui/components/iconos'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { useRubricas } from '@/ui/hooks/useRubricas'
import { cn } from '@/ui/lib/utils'

/**
 * Las rúbricas con las que se califica un entregable.
 *
 * Los niveles son fijos —Excelente, Bien, Regular, Mal— y valen lo mismo en toda
 * rúbrica; lo que cambia son los **descriptores**, que es lo único que hace
 * repetible una calificación. Sin ellos, en diciembre no hay manera de recordar
 * qué quiso decir «Bien» en septiembre, y la rúbrica no sirve para lo que existe.
 *
 * Todos los renglones pesan lo mismo: no hay ponderación interna
 * (docs/DATA-MODEL.md).
 */
export function Rubricas({ alVolver }: { alVolver: () => void }) {
  const { rubricas, cargando } = useRubricas()
  const [editando, setEditando] = useState<RubricaEnEdicion | null>(null)

  if (editando) {
    return (
      <Marco alVolver={() => setEditando(null)} titulo="Rúbrica">
        <Editor
          inicial={editando}
          alTerminar={() => setEditando(null)}
          key={editando.id ?? 'nueva'}
        />
      </Marco>
    )
  }

  return (
    <Marco alVolver={alVolver} titulo="Rúbricas">
      <div className="flex flex-col gap-4 pt-4">
        {cargando ? (
          <p className="text-base text-tinta-2" aria-live="polite">
            Cargando…
          </p>
        ) : rubricas.length === 0 ? (
          <p className="text-base text-tinta-2">
            Todavía no hay rúbricas. Una rúbrica es la lista de aspectos que se observan al
            revisar un trabajo, con la descripción de lo que significa cada nivel. Se usa al
            calificar una actividad, y la misma puede reutilizarse en varias. La primera se
            crea con el botón de abajo.
          </p>
        ) : (
          <ul className="border-t border-linea">
            {rubricas.map((r) => (
              <FilaRubrica key={r.rubrica.id} guardada={r} alEditar={setEditando} />
            ))}
          </ul>
        )}

        <Button
          className="self-start"
          onClick={() => setEditando(rubricaVacia())}
          disabled={cargando}
        >
          Nueva rúbrica
        </Button>
      </div>
    </Marco>
  )
}

function Marco({
  alVolver,
  titulo,
  children,
}: {
  alVolver: () => void
  titulo: string
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby="titulo-rubricas" className="mx-auto flex max-w-2xl flex-col">
      <header className="flex items-center gap-1">
        <Button size="icon" variant="ghost" onClick={alVolver} aria-label="Volver">
          <IconoAtras className="size-6" />
        </Button>
        <h1 id="titulo-rubricas" className="text-2xl font-bold text-tinta">
          {titulo}
        </h1>
      </header>
      {children}
    </section>
  )
}

function FilaRubrica({
  guardada,
  alEditar,
}: {
  guardada: RubricaConCriterios
  alEditar: (r: RubricaEnEdicion) => void
}) {
  const { rubrica, criterios, enUso } = guardada
  const [error, setError] = useState('')

  async function borrar() {
    setError('')
    try {
      await borrarRubrica(guardada)
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo borrar')
    }
  }

  return (
    <li className="border-b border-linea">
      <div className="flex min-h-14 items-center gap-2">
        <span
          aria-hidden
          className={cn('h-14 w-[7px] shrink-0', rubrica.activa ? 'bg-azul' : 'bg-linea')}
        />

        <button
          type="button"
          onClick={() => alEditar(rubricaEnEdicion(guardada))}
          className="flex min-w-0 flex-1 flex-col items-start py-2 text-left"
        >
          <span className="truncate text-base font-medium text-tinta">{rubrica.nombre}</span>
          <span className="text-[13px] text-tinta-2">
            {criterios.length === 1 ? '1 renglón' : `${criterios.length} renglones`}
            {/* Escrito y no en un `title`: en el iPad no hay hover, así que ahí ese
                texto sencillamente no existe y el botón de borrar queda apagado sin
                explicación (docs/UX.md). */}
            {enUso && ' · en uso, ya no se puede borrar'}
            {!rubrica.activa && ' · desactivada'}
          </span>
        </button>

        {rubrica.activa ? (
          <Button size="sm" variant="outline" onClick={() => void desactivarRubrica(rubrica.id)}>
            Desactivar
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => void activarRubrica(rubrica.id)}>
            Activar
          </Button>
        )}

        {/* Una rúbrica en uso no se borra: dejaría a su criterio apuntando a nada
            y su captura pasaría a binaria de un día para otro. Se desactiva. */}
        <button
          type="button"
          onClick={() => void borrar()}
          disabled={enUso}
          aria-label={`Borrar la rúbrica ${rubrica.nombre}`}
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-md text-tinta-2',
            'outline-none hover:bg-cuadro hover:text-rojo focus-visible:ring-[3px] focus-visible:ring-ring/50',
            'disabled:pointer-events-none disabled:opacity-40',
          )}
        >
          <IconoBasura className="size-5" />
        </button>
      </div>

      {error && (
        <p role="alert" className="pb-2 pl-[3.25rem] text-[13px] text-rojo">
          {error}
        </p>
      )}
    </li>
  )
}

function Editor({
  inicial,
  alTerminar,
}: {
  inicial: RubricaEnEdicion
  alTerminar: () => void
}) {
  const [rubrica, setRubrica] = useState(inicial)
  const [error, setError] = useState('')
  const [tocado, setTocado] = useState(false)

  function cambiar(siguiente: RubricaEnEdicion) {
    setTocado(true)
    setRubrica(revisarRubrica(siguiente))
  }

  const editarRenglon = (i: number, campo: 'nombre' | number, valor: string) =>
    cambiar({
      ...rubrica,
      renglones: rubrica.renglones.map((r, j) => {
        if (j !== i) return r
        if (campo === 'nombre') return { ...r, nombre: valor }
        const descriptores = [...r.descriptores] as [string, string, string, string]
        descriptores[campo] = valor
        return { ...r, descriptores }
      }),
    })

  async function guardar() {
    setError('')
    try {
      await guardarRubrica(rubrica)
      alTerminar()
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo guardar')
    }
  }

  const listo = rubricaLista(rubrica)
  const pendientes = rubrica.renglones.filter((r) => r.problema !== undefined).length

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="nombre-rubrica" className="text-base font-medium text-tinta">
          Nombre de la rúbrica
        </label>
        <Input
          id="nombre-rubrica"
          value={rubrica.nombre}
          placeholder="Trabajo escrito, Exposición…"
          onChange={(e) => cambiar({ ...rubrica, nombre: e.target.value })}
        />
      </div>

      <p className="text-[13px] text-tinta-2">
        Los cuatro niveles son iguales en todas las rúbricas y valen{' '}
        <span className="cifra">10, 8.3, 6.7 y 0</span>. Lo que cambia es qué significa cada
        uno aquí, y eso es lo que se escribe abajo.
      </p>

      <ul className="flex flex-col gap-3">
        {rubrica.renglones.map((renglon, i) => (
          <li
            key={renglon.id ?? i}
            className={cn(
              'flex flex-col gap-2 rounded-md border p-3',
              tocado && renglon.problema ? 'border-rojo bg-rojo/5' : 'border-linea',
            )}
          >
            <div className="flex items-center gap-2">
              <Input
                aria-label={`Nombre del renglón ${i + 1}`}
                value={renglon.nombre}
                placeholder="Ortografía, Claridad de la idea…"
                onChange={(e) => editarRenglon(i, 'nombre', e.target.value)}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() =>
                  cambiar({
                    ...rubrica,
                    renglones: rubrica.renglones.filter((_, j) => j !== i),
                  })
                }
                disabled={rubrica.renglones.length === 1}
                aria-label={`Quitar el renglón ${i + 1}`}
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-md text-tinta-2',
                  'outline-none hover:bg-cuadro hover:text-rojo focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  'disabled:pointer-events-none disabled:opacity-40',
                )}
              >
                <IconoBasura className="size-5" />
              </button>
            </div>

            {NIVELES.map((nivel, n) => (
              <div key={nivel} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-[13px] text-tinta-2">{nivel}</span>
                <Input
                  aria-label={`${nivel} del renglón ${i + 1}`}
                  value={renglon.descriptores[n] ?? ''}
                  onChange={(e) => editarRenglon(i, n, e.target.value)}
                  className="flex-1"
                />
              </div>
            ))}

            {tocado && renglon.problema && (
              <p className="text-[13px] text-rojo">{renglon.problema}</p>
            )}
          </li>
        ))}
      </ul>

      <Button
        variant="outline"
        className="self-start"
        onClick={() =>
          cambiar({ ...rubrica, renglones: [...rubrica.renglones, renglonVacio()] })
        }
      >
        Agregar renglón
      </Button>

      {error && (
        <p
          role="alert"
          className="rounded-md border-l-[7px] border-rojo bg-rojo/5 px-4 py-3 text-base text-tinta"
        >
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 border-t border-linea pt-3">
        <Button size="lg" onClick={() => void guardar()} disabled={!listo}>
          Guardar rúbrica
        </Button>
        <p className="text-base text-tinta-2" aria-live="polite">
          {listo
            ? ''
            : pendientes > 0
              ? 'Revise lo marcado'
              : 'Falta el nombre de la rúbrica'}
        </p>
      </div>
    </div>
  )
}
