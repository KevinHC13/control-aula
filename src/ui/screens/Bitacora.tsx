import { useMemo, useState } from 'react'

import {
  type FilaBitacora,
  quitarReporte,
  registrarReporte,
  textoDeReporteValido,
} from '@/application/bitacora'
import { trimestreDe } from '@/application/evaluacion'
import type { Reporte, Trimestre } from '@/domain/entities'
import { fechaLocal } from '@/domain/fechas'
import { IconoAtras, IconoBasura } from '@/ui/components/iconos'
import { Button } from '@/ui/components/ui/button'
import { useBitacoraDelTrimestre } from '@/ui/hooks/useBitacoraDelTrimestre'
import { useCicloEnCurso } from '@/ui/hooks/useCicloEnCurso'
import { plural } from '@/ui/lib/plural'
import { cn } from '@/ui/lib/utils'

/**
 * La bitácora: lo que pasó, por alumno.
 *
 * Antes se llamaba *Notas* y era un espacio sin consecuencias. Ya no: **todo lo
 * que se anota aquí es un reporte, todos los reportes son negativos y de aquí
 * sale la calificación de conducta** (docs/DECISIONES.md D-020). Por eso la
 * pantalla lo dice en voz alta y muestra el conteo del trimestre por alumno:
 * esconder la consecuencia haría que ella la descubra en la boleta, y el conteo
 * es lo que permite ver que un alumno ya va en dos antes de escribir el tercero.
 *
 * La atribución al trimestre es **por fecha**, derivada al leer: la lista son los
 * reportes cuyo día cae en el rango del trimestre, sin ningún campo almacenado.
 */
export function Bitacora() {
  const { ciclo, cargando } = useCicloEnCurso()
  const hoy = useMemo(() => fechaLocal(new Date()), [])

  const [elegido, setElegido] = useState<number | null>(null)
  const numeroActivo = elegido ?? trimestreDe(hoy, ciclo)?.numero ?? 1
  const trimestre = ciclo?.trimestres.find((t) => t.numero === numeroActivo) ?? null

  const { filas, cargando: cargandoFilas } = useBitacoraDelTrimestre(trimestre)

  // El alumno abierto, por id. Vive aquí y no en el store: la subvista no cruza
  // pantallas.
  const [alumnoAbierto, setAlumnoAbierto] = useState<string | null>(null)
  const fila = filas.find((f) => f.alumno.id === alumnoAbierto)

  if (fila && trimestre) {
    return (
      <DetalleAlumno
        fila={fila}
        trimestre={trimestre}
        hoy={hoy}
        alVolver={() => setAlumnoAbierto(null)}
      />
    )
  }

  const conReportes = filas.filter((f) => f.reportes.length > 0).length

  return (
    <section aria-labelledby="titulo-bitacora" className="flex flex-col gap-4">
      <div>
        <h1 id="titulo-bitacora" className="text-2xl font-bold text-tinta">
          Bitácora
        </h1>
        {/* La consecuencia va arriba y no en letra chica al final: es lo que
            distingue esta pantalla de un anecdotario. */}
        <p className="mt-1 text-apoyo text-tinta-2">
          Cada anotación cuenta como un reporte de conducta y afecta esa calificación. Un
          solo reporte no la baja; dos la dejan en cinco y tres o más la dejan en cero.
        </p>
      </div>

      {cargando ? (
        <p className="text-base text-tinta-2" aria-live="polite">
          Cargando…
        </p>
      ) : !ciclo ? (
        <p className="text-base text-tinta-2">
          Primero hay que registrar el ciclo escolar, en Grupo → Ajustes → Ciclo escolar.
          Cada reporte se asigna al trimestre que corresponde a su fecha.
        </p>
      ) : (
        <>
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
                    ? 'border-azul bg-azul text-papel'
                    : 'border-linea text-tinta hover:bg-cuadro',
                )}
              >
                T{t.numero}
              </button>
            ))}
          </nav>

          <p className="text-apoyo text-tinta-2" aria-live="polite">
            {cargandoFilas
              ? 'Cargando…'
              : conReportes === 0
                ? 'Ningún reporte en este trimestre'
                : `${conReportes} ${plural(conReportes, 'alumno', 'alumnos')} con reportes`}
          </p>

          <ul>
            {filas.map((f) => (
              <FilaDeAlumno
                key={f.alumno.id}
                fila={f}
                alAbrir={() => setAlumnoAbierto(f.alumno.id)}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/**
 * Un alumno en la lista, con su conteo del trimestre.
 *
 * Sin reportes se ve limpio, no vacío: no tener reportes es el dato —conducta sin
 * reportes vale 10— así que la fila no pide nada.
 */
function FilaDeAlumno({ fila, alAbrir }: { fila: FilaBitacora; alAbrir: () => void }) {
  const cuantos = fila.reportes.length
  const ultimo = fila.reportes[0]

  return (
    <li className="border-b border-linea">
      <button
        type="button"
        onClick={alAbrir}
        className="flex min-h-14 w-full items-center gap-2 text-left"
      >
        {/* La barra se pinta solo cuando hay algo que señalar: roja desde el
            segundo reporte, que es donde la conducta cae a la mitad. */}
        <span
          aria-hidden
          className={cn(
            'h-14 w-[7px] shrink-0',
            cuantos === 0
              ? 'border-x border-linea bg-transparent'
              : cuantos === 1
                ? 'bg-ambar'
                : 'bg-rojo',
          )}
        />
        <span className="cifra w-7 shrink-0 text-right text-apoyo text-tinta-2">
          {fila.alumno.numero_lista}
        </span>

        <span className="flex min-w-0 flex-1 flex-col py-2">
          <span className="truncate text-base text-tinta">{fila.alumno.nombre}</span>
          {ultimo && (
            <span className="truncate text-apoyo text-tinta-2">
              <span className="cifra">{ultimo.fecha}</span> · {ultimo.texto}
            </span>
          )}
        </span>

        {/* Sin reportes no se pinta un cero: veintinueve ceros en columna se
            leen como una tabla que hay que revisar, y lo que hay que ver son los
            dos alumnos que sí traen algo. */}
        {cuantos > 0 && (
          <span
            className={cn(
              'cifra shrink-0 pr-1 text-base',
              cuantos === 1 ? 'text-ambar' : 'text-rojo',
            )}
          >
            {cuantos}
          </span>
        )}
      </button>
    </li>
  )
}

/**
 * Un alumno con su historial del trimestre y el campo para anotar.
 *
 * Aquí sí hay botón de Guardar, al contrario de las pantallas de captura: un
 * reporte es un texto que se escribe, no un toque que cicla, y guardar a media
 * frase dejaría media frase contando para conducta.
 */
function DetalleAlumno({
  fila,
  trimestre,
  hoy,
  alVolver,
}: {
  fila: FilaBitacora
  trimestre: Trimestre
  hoy: string
  alVolver: () => void
}) {
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Se anota con la fecha de hoy, y solo si hoy cae en el trimestre que se está
  // viendo: escribir un reporte "en T1" desde febrero lo fecharía en febrero y
  // desaparecería de la lista en cuanto se guardara.
  const enCurso = hoy >= trimestre.inicio && hoy <= trimestre.fin
  const puedeGuardar = enCurso && textoDeReporteValido(texto) && !guardando

  const guardar = async () => {
    if (!puedeGuardar) return
    setGuardando(true)
    try {
      await registrarReporte(fila.alumno.id, hoy, texto)
      setTexto('')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section aria-labelledby="titulo-detalle" className="flex flex-col gap-4">
      <header className="flex items-start gap-1">
        <Button size="icon" variant="ghost" onClick={alVolver} aria-label="Volver">
          <IconoAtras className="size-6" />
        </Button>
        <div className="min-w-0 flex-1 pt-2">
          <h1 id="titulo-detalle" className="truncate text-2xl font-bold text-tinta">
            {fila.alumno.nombre}
          </h1>
          <p className="text-apoyo text-tinta-2">
            <span className="cifra">{fila.reportes.length}</span>{' '}
            {fila.reportes.length === 1 ? 'reporte' : 'reportes'} en el trimestre{' '}
            <span className="cifra">{trimestre.numero}</span>
          </p>
        </div>
      </header>

      {enCurso ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="texto-reporte" className="text-base text-tinta">
            Qué pasó
          </label>
          {/* Campo propio y no el `Input` de shadcn: un reporte es una o dos
              frases y un campo de una línea obliga a leerlo por la ventanita.
              text-base son los 16 px que evitan el zoom de Safari. */}
          <textarea
            id="texto-reporte"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            placeholder="Se levantó de su lugar varias veces durante la clase"
            className={cn(
              'w-full rounded-md border border-linea bg-transparent px-3 py-2 text-base text-tinta',
              'outline-none placeholder:text-tinta-2/70',
              'focus-visible:border-azul focus-visible:ring-[3px] focus-visible:ring-ring/50',
            )}
          />
          <div className="flex items-center gap-3">
            <Button onClick={() => void guardar()} disabled={!puedeGuardar}>
              Registrar el reporte
            </Button>
            <span className="text-apoyo text-tinta-2">
              Se registrará con la fecha de hoy, <span className="cifra">{hoy}</span>
            </span>
          </div>
        </div>
      ) : (
        <p className="text-base text-tinta-2">
          Los reportes se registran siempre con la fecha del día, y hoy no
          corresponde a este trimestre. Aquí se pueden consultar los reportes ya
          registrados, pero para anotar uno nuevo hay que abrir el trimestre en curso.
        </p>
      )}

      {fila.reportes.length === 0 ? (
        <p className="text-base text-tinta-2">
          Sin reportes en este trimestre. Su calificación de conducta es diez.
        </p>
      ) : (
        <ul>
          {fila.reportes.map((reporte) => (
            <FilaDeReporte key={reporte.id} reporte={reporte} />
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Un reporte del historial, con su baja.
 *
 * Quitar pide un segundo toque en el mismo botón en vez de un diálogo: un
 * reporte de más baja una calificación, así que deshacerlo tiene que ser posible,
 * y un toque suelto no puede lograrlo.
 */
function FilaDeReporte({ reporte }: { reporte: Reporte }) {
  const [confirmando, setConfirmando] = useState(false)

  return (
    <li className="flex items-start gap-2 border-b border-linea py-3">
      <span className="cifra shrink-0 pt-0.5 text-apoyo text-tinta-2">{reporte.fecha}</span>
      <p className="min-w-0 flex-1 text-base text-tinta">{reporte.texto}</p>
      {confirmando ? (
        <Button
          variant="ghost"
          className="shrink-0 text-rojo"
          onClick={() => void quitarReporte(reporte.id)}
        >
          ¿Eliminar?
        </Button>
      ) : (
        <Button
          size="icon"
          variant="ghost"
          aria-label="Eliminar el reporte"
          className="shrink-0"
          onClick={() => setConfirmando(true)}
        >
          <IconoBasura className="size-5" />
        </Button>
      )}
    </li>
  )
}
