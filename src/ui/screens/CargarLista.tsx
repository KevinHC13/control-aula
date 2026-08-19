import { useRef, useState } from 'react'

import {
  type FilaImportada,
  importarLista,
  normalizarExtraccion,
} from '@/application/importacion'
import { extraerLista } from '@/services/extraccion'
import { FilaRevision } from '@/ui/components/FilaRevision'
import { IconoAtras } from '@/ui/components/iconos'
import { Button } from '@/ui/components/ui/button'
import { cn } from '@/ui/lib/utils'

type Estado = 'inicio' | 'leyendo' | 'revisando' | 'listo' | 'error'

/**
 * Cargar la lista del grupo desde un archivo o una foto.
 *
 * El paso de revisión no es una cortesía: la IA falla con acentos y apellidos
 * compuestos, y la app no tiene edición de alumnos donde corregir después. Un
 * nombre mal escrito aquí se queda mal escrito todo el ciclo escolar
 * (docs/DECISIONES.md D-014).
 *
 * Pero revisar 30 nombres tiene que costar un vistazo, no 30 lecturas: la lista
 * se lee como lista —no como formulario— y solo lo marcado en rojo pide
 * atención. El encabezado y el botón de guardar quedan fijos porque con 30 filas
 * ninguno de los dos cabe en pantalla con el resto.
 */
export function CargarLista({ alVolver }: { alVolver: () => void }) {
  const [estado, setEstado] = useState<Estado>('inicio')
  const [filas, setFilas] = useState<FilaImportada[]>([])
  const [error, setError] = useState('')
  // Se conserva para que "Reintentar" no obligue a volver a buscar el archivo.
  const [archivo, setArchivo] = useState<File | null>(null)
  const cancelacion = useRef<AbortController | null>(null)

  async function leer(elegido: File) {
    setArchivo(elegido)
    setEstado('leyendo')
    setError('')
    const control = new AbortController()
    cancelacion.current = control

    try {
      const crudo = await extraerLista(elegido, control.signal)
      setFilas(normalizarExtraccion(crudo))
      setEstado('revisando')
    } catch (fallo) {
      if (control.signal.aborted) {
        setEstado('inicio')
        return
      }
      setError(fallo instanceof Error ? fallo.message : 'No se pudo leer el archivo')
      setEstado('error')
    }
  }

  // Se revalida entero en cada tecla: son 30 filas, es instantáneo, y así al
  // corregir un número repetido se apaga la marca en las dos filas a la vez.
  const editar = (i: number, campo: keyof FilaImportada, valor: string) =>
    setFilas((previas) =>
      normalizarExtraccion(
        previas.map((fila, j) =>
          j === i
            ? {
                ...fila,
                [campo]: campo === 'numero_lista' ? Number.parseInt(valor, 10) || 0 : valor,
              }
            : fila,
        ),
      ),
    )

  const quitar = (i: number) =>
    setFilas((previas) => normalizarExtraccion(previas.filter((_, j) => j !== i)))

  async function guardar() {
    await importarLista(filas)
    setEstado('listo')
  }

  const pendientes = filas.filter((f) => f.problema !== undefined).length

  return (
    <section aria-labelledby="titulo-cargar" className="mx-auto flex max-w-2xl flex-col">
      <header
        className={cn(
          'sticky top-0 z-10 -mx-4 flex items-center gap-1 border-b border-linea bg-papel px-4 pb-2',
        )}
      >
        <Button size="icon" variant="ghost" onClick={alVolver} aria-label="Volver a Ajustes">
          <IconoAtras className="size-6" />
        </Button>
        <h1 id="titulo-cargar" className="text-2xl font-bold text-tinta">
          Cargar lista
        </h1>
      </header>

      {(estado === 'inicio' || estado === 'error') && (
        <div className="flex flex-col gap-3 pt-6">
          {estado === 'error' && (
            <p
              role="alert"
              className="rounded-md border-l-[7px] border-rojo bg-rojo/5 px-4 py-3 text-base text-tinta"
            >
              {error}
            </p>
          )}
          <p className="text-base text-tinta-2">
            Sube la lista oficial del grupo en PDF, o tómale una foto. Este paso necesita
            conexión; el resto de la app no.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <ElegirArchivo
              etiqueta={archivo ? 'Elegir otro archivo' : 'Elegir archivo'}
              accept="application/pdf,image/*"
              alElegir={leer}
            />
            <ElegirArchivo etiqueta="Tomar foto" accept="image/*" capture alElegir={leer} />
            {estado === 'error' && archivo && (
              <Button variant="outline" onClick={() => void leer(archivo)}>
                Reintentar con {archivo.name}
              </Button>
            )}
          </div>
        </div>
      )}

      {estado === 'leyendo' && (
        <div className="flex flex-col items-start gap-3 pt-6">
          {/* aria-live: el cambio de estado no mueve el foco a ningún lado. */}
          <p className="text-base text-tinta" aria-live="polite">
            Leyendo la lista…
          </p>
          <p className="text-[13px] text-tinta-2">
            Puede tardar unos segundos. No cierres la app.
          </p>
          <Button variant="outline" onClick={() => cancelacion.current?.abort()}>
            Cancelar
          </Button>
        </div>
      )}

      {estado === 'revisando' && (
        <>
          <div className="flex flex-col gap-1 pt-4 pb-3">
            <p className="cifra text-3xl font-semibold text-tinta">
              {filas.length} <span className="font-sans text-base text-tinta-2">alumnos</span>
            </p>
            <p className="text-[13px] text-tinta-2" aria-live="polite">
              {pendientes === 0 ? (
                'Revísalos antes de guardar. Toca un dato para corregirlo.'
              ) : (
                <span className="text-rojo">
                  {pendientes === 1
                    ? 'Hay 1 fila por corregir, marcada en rojo.'
                    : `Hay ${pendientes} filas por corregir, marcadas en rojo.`}
                </span>
              )}
            </p>
          </div>

          {/* Encabezado de columnas: sin él, la fecha suelta a la derecha no se
              sabe qué es. Va oculto a lectores porque cada campo ya se nombra. */}
          <div
            aria-hidden
            className="flex items-center gap-1 border-b border-linea pb-1 text-[13px] text-tinta-2"
          >
            <span className="w-[7px] shrink-0" />
            <span className="w-11 shrink-0 px-2 text-center">Nº</span>
            <span className="flex-1 px-2">Nombre</span>
            <span className="w-32 shrink-0 px-2">Nacimiento</span>
            <span className="size-11 shrink-0" />
          </div>

          <ol className="border-b border-linea">
            {filas.map((fila, i) => (
              <FilaRevision
                key={i}
                fila={fila}
                indice={i}
                alEditar={(campo, valor) => editar(i, campo, valor)}
                alQuitar={() => quitar(i)}
              />
            ))}
          </ol>

          {/* Fijo abajo: con 30 filas, un botón al final del scroll no existe.
              `bottom-20` lo deja por encima de la barra de pestañas. */}
          <div className="sticky bottom-20 -mx-4 mt-4 border-t border-linea bg-papel px-4 py-3">
            <Button
              className="w-full"
              size="lg"
              onClick={() => void guardar()}
              disabled={pendientes > 0 || filas.length === 0}
            >
              {pendientes > 0 ? 'Corrige lo marcado para guardar' : `Guardar ${filas.length} alumnos`}
            </Button>
          </div>
        </>
      )}

      {estado === 'listo' && (
        <div className="flex flex-col items-start gap-3 pt-6">
          <p className="cifra text-3xl font-semibold text-tinta">
            {filas.length} <span className="font-sans text-base text-tinta-2">alumnos guardados</span>
          </p>
          <p className="text-[13px] text-tinta-2">
            Ya aparecen en Asistencia. Puedes volver a cargar el archivo cuando cambie.
          </p>
          <Button onClick={alVolver}>Volver a Ajustes</Button>
        </div>
      )}
    </section>
  )
}

/**
 * Un `<input type="file">` no se puede estilar ni llega a 44 px, así que va
 * oculto detrás de un `<label>` que sí. Vaciar `value` al elegir permite volver a
 * elegir el mismo archivo tras un error: sin eso el `change` no se dispara.
 */
function ElegirArchivo({
  etiqueta,
  accept,
  capture,
  alElegir,
}: {
  etiqueta: string
  accept: string
  capture?: boolean
  alElegir: (archivo: File) => void
}) {
  return (
    <label
      className={cn(
        'inline-flex h-12 cursor-pointer items-center justify-center rounded-md px-6',
        'text-base font-medium transition-colors',
        capture
          ? 'border border-linea bg-papel text-tinta hover:bg-cuadro'
          : 'bg-primary text-primary-foreground hover:bg-primary/90',
        'focus-within:ring-[3px] focus-within:ring-ring/50',
      )}
    >
      {etiqueta}
      <input
        type="file"
        className="sr-only"
        accept={accept}
        {...(capture ? { capture: 'environment' as const } : {})}
        onChange={(e) => {
          const elegido = e.target.files?.[0]
          e.target.value = ''
          if (elegido) alElegir(elegido)
        }}
      />
    </label>
  )
}
