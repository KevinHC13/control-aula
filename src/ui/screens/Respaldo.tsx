import { useRef, useState } from 'react'

import {
  type ArchivoDeRespaldo,
  armarRespaldo,
  borrarTodo,
  contarRegistros,
  esquemaLocal,
  leerRespaldo,
  nombreDeArchivo,
  restaurarRespaldo,
  totalBorrado,
} from '@/application/respaldo'
import type { ConteoPorTabla } from '@/data/ports/respaldo'
import { IconoAtras } from '@/ui/components/iconos'
import { Button } from '@/ui/components/ui/button'
import { plural } from '@/ui/lib/plural'

/**
 * Guardar el año en un archivo, y volverlo a meter.
 *
 * No es una pantalla del camino diario: se usa una vez al mes en el mejor de los
 * casos, y el día que se necesita de verdad es el día que el iPad ya no está. Por
 * eso todo lo que hace es explícito y con confirmación —lo contrario de las
 * pantallas de captura, donde cada toque escribe—.
 */
export function Respaldo({ alVolver }: { alVolver: () => void }) {
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // El archivo elegido, ya leído y juzgado, esperando confirmación. Se guarda
  // aquí y no se restaura de inmediato: elegir un archivo no puede ser lo mismo
  // que aceptar que sobrescriba lo que hay.
  const [porRestaurar, setPorRestaurar] = useState<ArchivoDeRespaldo | null>(null)
  const [restaurando, setRestaurando] = useState(false)
  const [conteo, setConteo] = useState<ConteoPorTabla | null>(null)
  const entrada = useRef<HTMLInputElement>(null)

  // TEMPORAL — se retira cuando cerrar el ciclo deje la app limpia por sí solo.
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [borrado, setBorrado] = useState<number | null>(null)

  const exportar = async () => {
    setGuardando(true)
    setError(null)
    setAviso(null)
    try {
      const archivo = await armarRespaldo()
      const nombre = nombreDeArchivo()
      const json = JSON.stringify(archivo)

      // Dos caminos, y el primero es el del iPad: con el archivo en la hoja de
      // compartir, «Guardar en Archivos» es una opción de esa hoja. La descarga
      // por ancla es el camino del navegador de escritorio, donde no hay hoja.
      const comoArchivo = new File([json], nombre, { type: 'application/json' })
      if (navigator.canShare?.({ files: [comoArchivo] })) {
        await navigator.share({ files: [comoArchivo], title: nombre })
      } else {
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
        const ancla = document.createElement('a')
        ancla.href = url
        ancla.download = nombre
        ancla.click()
        URL.revokeObjectURL(url)
      }

      const cuantos = contarRegistros(archivo)
      setAviso(`${nombre} · ${cuantos} ${plural(cuantos, 'registro', 'registros')}`)
    } catch (e) {
      // Cancelar la hoja de compartir lanza AbortError, y cancelar no es un
      // error que valga la pena mostrarle.
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError('No se pudo generar el respaldo')
      }
    } finally {
      setGuardando(false)
    }
  }

  const elegir = async (archivo: File) => {
    setError(null)
    setAviso(null)
    setConteo(null)
    try {
      setPorRestaurar(leerRespaldo(await archivo.text(), esquemaLocal()))
    } catch (e) {
      setPorRestaurar(null)
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo')
    }
  }

  const restaurar = async () => {
    if (!porRestaurar) return
    setRestaurando(true)
    setError(null)
    try {
      setConteo(await restaurarRespaldo(porRestaurar))
      setPorRestaurar(null)
      // Se limpia la entrada para que elegir el mismo archivo otra vez vuelva a
      // disparar el `change`: sin esto, el segundo intento no hace nada.
      if (entrada.current) entrada.current.value = ''
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo restaurar el respaldo')
    } finally {
      setRestaurando(false)
    }
  }

  // TEMPORAL — se retira cuando cerrar el ciclo deje la app limpia por sí solo.
  const borrar = async () => {
    setBorrando(true)
    setError(null)
    setAviso(null)
    try {
      setBorrado(totalBorrado(await borrarTodo()))
      setConfirmandoBorrado(false)
    } catch {
      setError('No se pudo borrar la información')
    } finally {
      setBorrando(false)
    }
  }

  return (
    <section aria-labelledby="titulo-respaldo" className="flex flex-col gap-6">
      <header className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={alVolver} aria-label="Volver a Ajustes">
          <IconoAtras className="size-6" />
        </Button>
        <h1 id="titulo-respaldo" className="text-2xl font-bold text-tinta">
          Respaldo
        </h1>
      </header>

      <section aria-labelledby="titulo-guardar" className="flex flex-col gap-2">
        <h2 id="titulo-guardar" className="text-base font-medium text-tinta">
          Guardar una copia
        </h2>
        <p className="text-base text-tinta-2">
          Se genera un archivo con toda la información registrada: la lista del grupo, la
          asistencia, las actividades, las calificaciones y la bitácora. Conviene guardarlo
          fuera del iPad —en Archivos o enviándolo por correo— al terminar cada trimestre.
        </p>
        <Button onClick={() => void exportar()} disabled={guardando} className="self-start">
          {guardando ? 'Generando…' : 'Guardar el respaldo'}
        </Button>
        {aviso && (
          <p className="text-base text-verde" aria-live="polite">
            Respaldo generado: <span className="cifra">{aviso}</span>
          </p>
        )}
      </section>

      <section aria-labelledby="titulo-restaurar" className="flex flex-col gap-2">
        <h2 id="titulo-restaurar" className="text-base font-medium text-tinta">
          Restaurar desde un archivo
        </h2>
        <p className="text-base text-tinta-2">
          Al seleccionar un archivo se indica cuánta información contiene, y nada se guarda
          hasta confirmarlo. Restaurar{' '}
          <strong className="font-medium text-tinta">agrega</strong>: lo que ya está en el
          iPad no se borra, y la información que venga repetida se actualiza con la del
          archivo.
        </p>

        {/* Un input de archivo de verdad, no un botón que lo simula: en iPadOS es
            el que abre Archivos, con iCloud y con la carpeta del dispositivo. */}
        <label
          htmlFor="archivo-respaldo"
          className="text-base font-medium text-azul underline decoration-2 underline-offset-4"
        >
          Seleccionar un archivo de respaldo
        </label>
        <input
          ref={entrada}
          id="archivo-respaldo"
          type="file"
          accept="application/json,.json"
          className="min-h-11 text-base text-tinta"
          onChange={(e) => {
            const archivo = e.target.files?.[0]
            if (archivo) void elegir(archivo)
          }}
        />

        {porRestaurar && (
          <div className="flex flex-col gap-2 rounded-md border border-linea p-3">
            <p className="text-base text-tinta">
              El archivo trae <span className="cifra">{contarRegistros(porRestaurar)}</span>{' '}
              {plural(contarRegistros(porRestaurar), 'registro', 'registros')}
              {porRestaurar.generado_en !== '' && (
                <>
                  , generados el{' '}
                  <span className="cifra">{porRestaurar.generado_en.slice(0, 10)}</span>
                </>
              )}
              .
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void restaurar()} disabled={restaurando}>
                {restaurando ? 'Restaurando…' : 'Restaurar todo'}
              </Button>
              <Button variant="ghost" onClick={() => setPorRestaurar(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {conteo && <ResumenRestaurado conteo={conteo} />}
      </section>

      {/* TEMPORAL — se retira cuando cerrar el ciclo deje la app limpia por sí
          solo. Existe para sacar de una vez el grupo de ejemplo con el que la app
          arrancaba (D-024): en el iPad no hay consola con la que borrar
          IndexedDB a mano. */}
      <section aria-labelledby="titulo-borrar" className="flex flex-col gap-2">
        <h2 id="titulo-borrar" className="text-base font-medium text-tinta">
          Borrar toda la información
        </h2>
        <p className="text-base text-tinta-2">
          Deja la aplicación como recién instalada: se borran la lista del grupo, la
          asistencia, las actividades, las calificaciones y la bitácora.{' '}
          <strong className="font-medium text-tinta">No se puede deshacer</strong>, y lo
          único que lo recupera es un respaldo guardado antes.
        </p>

        {borrado === null &&
          (confirmandoBorrado ? (
            <div
              role="alertdialog"
              aria-label="Confirmar el borrado de toda la información"
              className="flex flex-col gap-3 rounded-md border-l-[7px] border-rojo bg-rojo/5 px-4 py-3"
            >
              <p className="text-base text-tinta">
                Se va a borrar todo lo registrado en este iPad. Si todavía no hay un
                respaldo guardado, conviene generarlo antes: después ya no habrá de dónde.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  disabled={borrando}
                  onClick={() => void borrar()}
                >
                  {borrando ? 'Borrando…' : 'Borrar toda la información'}
                </Button>
                <Button variant="outline" onClick={() => setConfirmandoBorrado(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="self-start"
              onClick={() => setConfirmandoBorrado(true)}
            >
              Borrar toda la información
            </Button>
          ))}

        {borrado !== null && (
          <div className="flex flex-col gap-3 rounded-md border border-linea p-3">
            <p className="text-base text-tinta" aria-live="polite">
              Se borraron <span className="cifra">{borrado}</span>{' '}
              {plural(borrado, 'registro', 'registros')}.
            </p>
            {/* Recargar y no solo redibujar: varias pantallas leen sus datos una
                sola vez al montarse, y quedarían enseñando lo que ya no existe. */}
            <Button onClick={() => location.reload()} className="self-start">
              Recargar la aplicación
            </Button>
          </div>
        )}
      </section>

      {error && (
        <p className="text-base text-rojo" aria-live="polite">
          {error}
        </p>
      )}
    </section>
  )
}

/**
 * Qué quedó, tabla por tabla. Decir «restaurado» sin números no se puede creer, y
 * este es el momento en que ella necesita creerlo.
 */
function ResumenRestaurado({ conteo }: { conteo: ConteoPorTabla }) {
  const conFilas = Object.entries(conteo).filter(([, cuantas]) => cuantas > 0)
  const total = conFilas.reduce((suma, [, cuantas]) => suma + cuantas, 0)

  return (
    <div className="flex flex-col gap-1" aria-live="polite">
      <p className="text-base text-verde">
        Restaurados <span className="cifra">{total}</span>{' '}
        {plural(total, 'registro', 'registros')}.
      </p>
      <ul className="text-[13px] text-tinta-2">
        {conFilas.map(([tabla, cuantas]) => (
          <li key={tabla}>
            {tabla}: <span className="cifra">{cuantas}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
