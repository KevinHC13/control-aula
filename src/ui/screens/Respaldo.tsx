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
import { Cabecera } from '@/ui/components/Cabecera'
import { entregarArchivo, seCancelo } from '@/ui/lib/archivo'
import { Button } from '@/ui/components/ui/button'
import { comoDiaConAnio } from '@/ui/lib/fechas'
import { plural } from '@/ui/lib/plural'
import { resumirPorTabla } from '@/ui/lib/tablas'
import { useApariencia } from '@/ui/store/apariencia'

/**
 * Guardar el año en un archivo, y volverlo a meter.
 *
 * No es una pantalla del camino diario: se usa una vez al mes en el mejor de los
 * casos, y el día que se necesita de verdad es el día que el iPad ya no está. Por
 * eso todo lo que hace es explícito y con confirmación —lo contrario de las
 * pantallas de captura, donde cada toque escribe—.
 */
export function Respaldo({ alVolver }: { alVolver: () => void }) {
  // Va al nombre del archivo: con varios respaldos en la misma carpeta, la fecha
  // sola no dice de qué grupo es cada uno.
  const nombreDelGrupo = useApariencia((s) => s.nombreDelGrupo)
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

  // TEMPORAL — a petición del usuario, hasta que la base del iPad esté limpia.
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [borrado, setBorrado] = useState<number | null>(null)

  const exportar = async () => {
    setGuardando(true)
    setError(null)
    setAviso(null)
    try {
      const archivo = await armarRespaldo()
      const nombre = nombreDeArchivo(undefined, nombreDelGrupo)

      await entregarArchivo(
        new Blob([JSON.stringify(archivo)], { type: 'application/json' }),
        nombre,
        'application/json',
      )

      const cuantos = contarRegistros(archivo)
      setAviso(`${nombre} · ${cuantos} ${plural(cuantos, 'registro', 'registros')}`)
    } catch (e) {
      if (!seCancelo(e)) {
        // Con el motivo: «no se pudo» a secas no deja nada que intentar.
        setError(
          e instanceof Error && e.message !== ''
            ? `No se pudo generar el respaldo: ${e.message}`
            : 'No se pudo generar el respaldo',
        )
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

  // TEMPORAL — a petición del usuario, hasta que la base del iPad esté limpia.
  const borrar = async () => {
    setBorrando(true)
    setError(null)
    setAviso(null)
    try {
      setBorrado(totalBorrado(await borrarTodo()))
      setConfirmandoBorrado(false)
    } catch (e) {
      setError(
        e instanceof Error && e.message !== ''
          ? `No se pudo borrar la información: ${e.message}`
          : 'No se pudo borrar la información',
      )
    } finally {
      setBorrando(false)
    }
  }

  return (
    <section aria-labelledby="titulo-respaldo" className="flex flex-col gap-6">
      <Cabecera titulo="Respaldo" id="titulo-respaldo" alVolver={alVolver} etiquetaVolver="Volver a Ajustes" />

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
          className="text-base font-medium text-marca underline decoration-2 underline-offset-4"
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
                  {comoDiaConAnio(porRestaurar.generado_en.slice(0, 10))}
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

      {/* TEMPORAL — a petición del usuario, hasta que la base del iPad esté
          limpia. Cerrar el ciclo ya deja la app lista para el grupo que llega
          (D-025), así que esto solo sirve para lo de una vez: sacar el grupo de
          ejemplo con el que la app arrancaba (D-024). En el iPad no hay consola
          con la que borrar IndexedDB a mano. */}
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
                  {borrando ? 'Borrando…' : 'Sí, borrar toda la información'}
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
 * Qué quedó, y de qué. Decir «restaurado» sin números no se puede creer, y este es
 * justo el momento en que hace falta creerlo.
 *
 * El detalle iba antes con el nombre técnico de cada tabla —«eval_rubrica: 120»—,
 * que además de ser jerga contaba cosas que no son cosas para quien lee.
 */
function ResumenRestaurado({ conteo }: { conteo: ConteoPorTabla }) {
  const resumen = resumirPorTabla(conteo)
  const total = resumen.reduce((suma, renglon) => suma + renglon.cuantas, 0)

  return (
    <div className="flex flex-col gap-1" aria-live="polite">
      <p className="text-base text-verde">
        Se recuperaron <span className="cifra">{total}</span>{' '}
        {plural(total, 'registro', 'registros')}.
      </p>
      <ul className="text-apoyo text-tinta-2">
        {resumen.map((renglon) => (
          <li key={renglon.etiqueta}>
            {renglon.etiqueta}: <span className="cifra">{renglon.cuantas}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
