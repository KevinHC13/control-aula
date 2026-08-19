import { useRef, useState } from 'react'

import {
  type FilaImportada,
  importarLista,
  normalizarExtraccion,
} from '@/application/importacion'
import { extraerLista } from '@/services/extraccion'
import { IconoAtras, IconoBasura } from '@/ui/components/iconos'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'

type Estado = 'inicio' | 'leyendo' | 'revisando' | 'listo' | 'error'

/**
 * Cargar la lista del grupo desde un archivo o una foto.
 *
 * El paso de revisión no es una cortesía: la IA falla con acentos y apellidos
 * compuestos, y la app no tiene edición de alumnos donde corregir después. Un
 * nombre mal escrito aquí se queda mal escrito todo el ciclo escolar
 * (docs/DECISIONES.md D-014).
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

  // Se revalida entero en cada tecla: son 30 filas, es instantáneo, y así un
  // número repetido deja de estar marcado en las dos filas a la vez.
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

  const borrar = (i: number) =>
    setFilas((previas) => normalizarExtraccion(previas.filter((_, j) => j !== i)))

  async function guardar() {
    await importarLista(filas)
    setEstado('listo')
  }

  const pendientes = filas.filter((f) => f.problema !== undefined).length

  return (
    <section aria-labelledby="titulo-cargar" className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={alVolver} aria-label="Volver a Ajustes">
          <IconoAtras className="size-6" />
        </Button>
        <h1 id="titulo-cargar" className="text-2xl font-bold text-tinta">
          Cargar lista
        </h1>
      </header>

      {(estado === 'inicio' || estado === 'error') && (
        <div className="flex flex-col gap-3">
          {estado === 'error' && (
            <p role="alert" className="rounded-md bg-rojo/10 px-4 py-3 text-base text-rojo">
              {error}
            </p>
          )}
          <p className="text-base text-tinta-2">
            Sube la lista oficial del grupo en PDF, o tómale una foto. Este paso necesita
            conexión; lo demás de la app no.
          </p>
          <ElegirArchivo
            etiqueta="Elegir archivo"
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
      )}

      {estado === 'leyendo' && (
        <div className="flex flex-col gap-3">
          <p className="text-base text-tinta">Leyendo la lista…</p>
          <p className="text-base text-tinta-2">Puede tardar unos segundos. No cierres la app.</p>
          <Button variant="outline" onClick={() => cancelacion.current?.abort()}>
            Cancelar
          </Button>
        </div>
      )}

      {estado === 'revisando' && (
        <div className="flex flex-col gap-3">
          <p className="text-base text-tinta">
            Se leyeron {filas.length} alumnos. Revísalos antes de guardar.
          </p>
          {pendientes > 0 && (
            <p className="text-base text-rojo">
              Hay {pendientes} {pendientes === 1 ? 'fila' : 'filas'} por corregir.
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {filas.map((fila, i) => (
              <li
                key={i}
                className={`flex flex-col gap-1 rounded-md border p-2 ${
                  fila.problema ? 'border-rojo bg-rojo/5' : 'border-linea'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    className="w-16 text-center font-mono"
                    aria-label={`Número de lista de la fila ${i + 1}`}
                    value={fila.numero_lista === 0 ? '' : fila.numero_lista}
                    onChange={(e) => editar(i, 'numero_lista', e.target.value)}
                  />
                  <Input
                    className="flex-1"
                    aria-label={`Nombre de la fila ${i + 1}`}
                    value={fila.nombre}
                    onChange={(e) => editar(i, 'nombre', e.target.value)}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => borrar(i)}
                    aria-label={`Quitar la fila ${i + 1}`}
                  >
                    <IconoBasura className="size-5" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    className="w-40 font-mono"
                    placeholder="AAAA-MM-DD"
                    aria-label={`Fecha de nacimiento de la fila ${i + 1}`}
                    value={fila.fecha_nacimiento}
                    onChange={(e) => editar(i, 'fecha_nacimiento', e.target.value)}
                  />
                  {fila.problema && <span className="text-base text-rojo">{fila.problema}</span>}
                </div>
              </li>
            ))}
          </ul>

          <Button onClick={() => void guardar()} disabled={pendientes > 0 || filas.length === 0}>
            Guardar {filas.length} alumnos
          </Button>
        </div>
      )}

      {estado === 'listo' && (
        <div className="flex flex-col gap-3">
          <p className="text-base text-tinta">Se guardaron {filas.length} alumnos.</p>
          <Button onClick={alVolver}>Volver a Ajustes</Button>
        </div>
      )}
    </section>
  )
}

/**
 * Un `<input type="file">` no se puede estilar ni llega a 44 px, así que va
 * oculto detrás de un `<label>` que sí. Vaciar `value` al final permite volver a
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
    <label className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-primary px-4 text-base font-medium text-primary-foreground">
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
