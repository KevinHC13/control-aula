import { useRef, useState } from 'react'

import { interpretarHoja } from '@/application/hoja'
import {
  type FilaImportada,
  fusionarHojas,
  importarLista,
  normalizarExtraccion,
  revalidar,
} from '@/application/importacion'
import { type AlumnoExtraido, extraerLista, extraerListaDeTexto } from '@/services/extraccion'
import { leerHoja } from '@/services/xlsx'
import { FilaRevision } from '@/ui/components/FilaRevision'
import { IconoAtras } from '@/ui/components/iconos'
import { Button } from '@/ui/components/ui/button'
import { cn } from '@/ui/lib/utils'

type Estado = 'inicio' | 'leyendo' | 'revisando' | 'listo' | 'error'

/** Lo que se puede elegir. El `.xlsx` va también por extensión: iPadOS no
    siempre le pone el tipo largo de Office a un archivo que viene de Archivos. */
const ACEPTADOS = [
  'application/pdf',
  'image/*',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xlsx',
].join(',')

/** Qué se está leyendo, para poder decir «hoja 2 de 3» y no solo «espere». */
interface Avance {
  hoja: number
  de: number
}

/**
 * Cargar la lista del grupo desde uno o varios archivos, o varias fotos.
 *
 * El paso de revisión no es una cortesía: la IA falla con acentos y apellidos
 * compuestos, y un nombre mal escrito aquí se queda mal escrito todo el ciclo
 * escolar —corregirlo después existe desde `C37`, pero hay que darse cuenta—
 * (docs/DECISIONES.md D-014).
 *
 * Pero revisar 30 nombres tiene que costar un vistazo, no 30 lecturas: la lista
 * se lee como lista —no como formulario— y solo lo marcado en rojo pide
 * atención. El encabezado y el botón de guardar quedan fijos porque con 30 filas
 * ninguno de los dos cabe en pantalla con el resto.
 *
 * Una lista de treinta y siete alumnos **no cabe en una foto**: viene en dos
 * páginas. Por eso cada lectura se **suma** a lo ya revisado en vez de
 * reemplazarlo, y por eso una hoja que falla no tira las que ya se leyeron.
 */
export function CargarLista({ alVolver }: { alVolver: () => void }) {
  const [estado, setEstado] = useState<Estado>('inicio')
  const [filas, setFilas] = useState<FilaImportada[]>([])
  const [hojas, setHojas] = useState(0)
  const [avance, setAvance] = useState<Avance>({ hoja: 1, de: 1 })
  const [error, setError] = useState('')
  // Se conservan para que "Reintentar" no obligue a volver a buscar el archivo.
  const [archivos, setArchivos] = useState<File[]>([])
  const cancelacion = useRef<AbortController | null>(null)

  /**
   * Lee una tanda de archivos, **en serie**: son llamadas a un modelo y tres a
   * la vez es lo que provoca un rechazo por exceso de peticiones.
   *
   * Lo leído se guarda hoja por hoja. Si la tercera falla, las dos primeras ya
   * están en la pantalla y se puede reintentar sin volver a empezar.
   */
  async function leer(elegidos: File[]) {
    if (elegidos.length === 0) return

    setArchivos(elegidos)
    setEstado('leyendo')
    setError('')
    const control = new AbortController()
    cancelacion.current = control

    let leidasAntes = filas.length

    for (const [i, archivo] of elegidos.entries()) {
      setAvance({ hoja: i + 1, de: elegidos.length })

      try {
        const crudo = await leerArchivo(archivo, control.signal)
        const leidas = normalizarExtraccion(crudo)
        setFilas((previas) => (previas.length === 0 ? leidas : fusionarHojas(previas, leidas)))
        setHojas((previas) => previas + 1)
        leidasAntes += leidas.length
      } catch (fallo) {
        // Cancelar o fallar no tira lo que ya se leyó: se vuelve a la revisión
        // si hay algo que revisar, y al inicio si no.
        if (control.signal.aborted) {
          setEstado(leidasAntes > 0 ? 'revisando' : 'inicio')
          return
        }
        setError(fallo instanceof Error ? fallo.message : 'No se pudo leer el archivo')
        setEstado('error')
        return
      }
    }

    setEstado('revisando')
  }

  // `revalidar` y no `normalizarExtraccion`: se recalculan los problemas —son 30
  // filas, es instantáneo, y así corregir un número repetido apaga la marca en
  // las dos a la vez— pero no se recorta ni se recapitaliza el texto, que le
  // pelearía al teclado mientras ella escribe.
  const editar = (i: number, campo: keyof FilaImportada, valor: string) =>
    setFilas((previas) =>
      revalidar(
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
    setFilas((previas) => revalidar(previas.filter((_, j) => j !== i)))

  async function guardar() {
    await importarLista(filas)
    setEstado('listo')
  }

  const pendientes = filas.filter((f) => f.problema !== undefined).length
  const hayAlgoLeido = filas.length > 0

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

      {(estado === 'inicio' || (estado === 'error' && !hayAlgoLeido)) && (
        <div className="flex flex-col gap-3 pt-6">
          {estado === 'error' && <Aviso>{error}</Aviso>}
          <p className="text-base text-tinta-2">
            Seleccione la lista oficial del grupo: un PDF, un archivo de Excel, o una
            fotografía de ella. Los nombres se leen automáticamente y después se pueden
            corregir. Si la lista trae CURP, la fecha de cumpleaños sale de ahí sola. Con
            un archivo de Excel no hace falta conexión; con un PDF o una foto, sí.
          </p>
          <p className="text-[13px] text-tinta-2">
            Si la lista viene en varias páginas, puede elegirlas todas de una vez, o
            agregarlas de una en una después.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <ElegirArchivo
              etiqueta={archivos.length > 0 ? 'Elegir otro archivo' : 'Elegir archivo'}
              accept={ACEPTADOS}
              multiple
              alElegir={leer}
            />
            <ElegirArchivo etiqueta="Tomar foto" accept="image/*" capture alElegir={leer} />
            {estado === 'error' && archivos.length > 0 && (
              <Button variant="outline" onClick={() => void leer(archivos)}>
                Reintentar con {archivos[0]?.name}
                {archivos.length > 1 ? ` y ${archivos.length - 1} más` : ''}
              </Button>
            )}
          </div>
        </div>
      )}

      {estado === 'leyendo' && (
        <div className="flex flex-col items-start gap-3 pt-6">
          {/* aria-live: el cambio de estado no mueve el foco a ningún lado. */}
          <p className="text-base text-tinta" aria-live="polite">
            {avance.de > 1
              ? `Leyendo la hoja ${avance.hoja} de ${avance.de}…`
              : 'Leyendo la lista…'}
          </p>
          <p className="text-[13px] text-tinta-2">
            Puede tardar unos segundos. No cierre la aplicación mientras termina.
          </p>
          <Button variant="outline" onClick={() => cancelacion.current?.abort()}>
            Cancelar
          </Button>
        </div>
      )}

      {(estado === 'revisando' || (estado === 'error' && hayAlgoLeido)) && (
        <>
          {/* Una hoja que falla no tira las que ya se leyeron: el aviso va
              encima de la lista y ella decide si reintenta o se queda con lo
              que hay. */}
          {estado === 'error' && (
            <div className="flex flex-col items-start gap-2 pt-4">
              <Aviso>{error}</Aviso>
              <Button variant="outline" onClick={() => void leer(archivos)}>
                Reintentar
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-1 pt-4 pb-3">
            <p className="cifra text-3xl font-semibold text-tinta">
              {filas.length}{' '}
              <span className="font-sans text-base text-tinta-2">
                alumnos{hojas > 1 ? ` · ${hojas} hojas` : ''}
              </span>
            </p>
            <p className="text-[13px] text-tinta-2" aria-live="polite">
              {pendientes === 0 ? (
                'Revise los datos antes de guardar. Seleccione cualquier dato para corregirlo.'
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

          {/* Agregar otra hoja va debajo de la lista y no arriba: lo primero que
              hay que hacer con lo leído es revisarlo. */}
          <div className="flex flex-col gap-2 pt-4">
            <p className="text-[13px] text-tinta-2">
              ¿La lista sigue en otra página? Agréguela y se suma a esta: quien ya esté no
              se duplica.
            </p>
            <div className="flex flex-wrap gap-2">
              <ElegirArchivo
                etiqueta="Agregar otra hoja"
                accept={ACEPTADOS}
                multiple
                variante="secundaria"
                alElegir={leer}
              />
              <ElegirArchivo
                etiqueta="Tomar otra foto"
                accept="image/*"
                capture
                variante="secundaria"
                alElegir={leer}
              />
            </div>
          </div>

          {/* Fijo abajo: con 30 filas, un botón al final del scroll no existe.
              `bottom-20` lo deja por encima de la barra de pestañas. */}
          <div className="sticky bottom-20 -mx-4 mt-4 border-t border-linea bg-papel px-4 py-3">
            <Button
              className="w-full"
              size="lg"
              onClick={() => void guardar()}
              disabled={pendientes > 0 || filas.length === 0}
            >
              {pendientes > 0
                ? 'Corrija lo marcado para poder guardar'
                : `Guardar ${filas.length} alumnos`}
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
            Ya aparecen en la pantalla de Asistencia. Si la lista cambia, puede volver a
            cargarse: los alumnos que ya existen se actualizan y no se duplican.
          </p>
          <Button onClick={alVolver}>Volver a Ajustes</Button>
        </div>
      )}
    </section>
  )
}

const ES_EXCEL = /\.xlsx$/i

/**
 * De archivo a alumnos, por el camino más barato que sirva.
 *
 * Un Excel se abre **en el dispositivo**: sus columnas ya vienen con su
 * encabezado escrito, así que no hay nada que descubrir y la lista aparece al
 * instante, sin red. Solo si esa hoja no se sabe leer —otra escuela, otro
 * formato— se manda su texto a la IA, que para eso es buena.
 *
 * Un PDF o una foto van directo a la IA, como siempre.
 */
async function leerArchivo(archivo: File, señal: AbortSignal): Promise<AlumnoExtraido[]> {
  if (!ES_EXCEL.test(archivo.name)) return extraerLista(archivo, señal)

  const celdas = await leerHoja(archivo)
  const alumnos = interpretarHoja(celdas)
  if (alumnos !== null) return alumnos

  const texto = celdas.map((fila) => (fila ?? []).join('\t')).join('\n')
  return extraerListaDeTexto(texto, señal)
}

/** El mismo aviso rojo en los dos sitios donde puede aparecer un error. */
function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-md border-l-[7px] border-rojo bg-rojo/5 px-4 py-3 text-base text-tinta"
    >
      {children}
    </p>
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
  multiple,
  variante = 'principal',
  alElegir,
}: {
  etiqueta: string
  accept: string
  capture?: boolean
  multiple?: boolean
  variante?: 'principal' | 'secundaria'
  alElegir: (archivos: File[]) => void
}) {
  const secundario = variante === 'secundaria' || capture === true

  return (
    <label
      className={cn(
        'inline-flex h-12 cursor-pointer items-center justify-center rounded-md px-6',
        'text-base font-medium transition-colors',
        secundario
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
        {...(multiple ? { multiple: true } : {})}
        {...(capture ? { capture: 'environment' as const } : {})}
        onChange={(e) => {
          const elegidos = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (elegidos.length > 0) alElegir(elegidos)
        }}
      />
    </label>
  )
}
