import { useMemo, useState } from 'react'

import {
  abrirCicloEscolar,
  abrirTrimestreSiguiente,
  cerrarCicloEscolar,
  guardarFechas,
  loQueFaltaParaCerrarCiclo,
  nombreDeCicloEn,
  type Periodo,
  periodoVacio,
  periodosDe,
  revisarNuevoTrimestre,
  revisarPeriodos,
  siguienteNumero,
} from '@/application/evaluacion'
import type { CicloEnCurso } from '@/data/ports/evaluacion'
import { fechaLocal } from '@/domain/fechas'
import { Aviso } from '@/ui/components/Aviso'
import { Cabecera } from '@/ui/components/Cabecera'
import { Cargando } from '@/ui/components/Cargando'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { useCicloEnCurso } from '@/ui/hooks/useCicloEnCurso'
import { cn } from '@/ui/lib/utils'

/**
 * El ciclo escolar y las fechas de sus trimestres.
 *
 * Vive en Ajustes y no en una pestaña: se toca al empezar el ciclo y cuando la
 * escuela mueve un calendario, o sea unas cuantas veces al año. La regla nunca fue
 * *ninguna pantalla*, era *ninguna pantalla en el camino diario* (docs/UX.md §4).
 *
 * **El ciclo se abre con el primer trimestre nada más.** En agosto nadie sabe las
 * fechas de los otros dos, y pedirlas para poder empezar a pasar lista sería
 * hacerla inventar dos rangos. Los siguientes se abren cuando la escuela publica
 * su calendario, y como la atribución se calcula de la fecha al leer —no se
 * guarda—, abrir el trimestre después atribuye solo lo ya capturado.
 */
export function CicloEscolar({ alVolver }: { alVolver: () => void }) {
  const { ciclo, cargando } = useCicloEnCurso()

  if (cargando) {
    return (
      <Marco alVolver={alVolver}>
        <div className="pt-6">
  <Cargando />
</div>
      </Marco>
    )
  }

  return (
    <Marco alVolver={alVolver}>
      {ciclo ? (
        // La `key` lleva cuántos trimestres hay, no solo el id del ciclo: al abrir
        // uno nuevo el formulario pasa a describir otra cosa, y sin remontar la
        // fila del trimestre recién abierto no aparecería hasta volver a entrar.
        <Configurado
          key={`${ciclo.ciclo.id}:${ciclo.trimestres.length}`}
          ciclo={ciclo}
        />
      ) : (
        <Apertura />
      )}
    </Marco>
  )
}

function Marco({ alVolver, children }: { alVolver: () => void; children: React.ReactNode }) {
  return (
    <section aria-labelledby="titulo-ciclo" className="mx-auto flex max-w-2xl flex-col">
      <Cabecera titulo="Ciclo escolar" id="titulo-ciclo" alVolver={alVolver} etiquetaVolver="Volver a Ajustes" />
      {children}
    </section>
  )
}

/** Abrir el ciclo: nombre y las fechas del primer trimestre. */
function Apertura() {
  const hoy = useMemo(() => fechaLocal(new Date()), [])
  const [nombre, setNombre] = useState(() => nombreDeCicloEn(hoy))
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoVacio(1))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const revisado = revisarPeriodos([periodo])[0] ?? periodo
  const enBlanco = periodo.inicio === '' && periodo.fin === ''
  const listo = revisado.problema === undefined && nombre.trim() !== ''

  async function abrir() {
    setGuardando(true)
    setError('')
    try {
      await abrirCicloEscolar(nombre, periodo)
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo abrir el ciclo')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-4">
      <p className="text-base text-tinta-2">
        Con las fechas del primer trimestre basta para empezar. Los otros dos se abren cuando
        la escuela publique su calendario, y lo ya registrado se asigna solo al trimestre
        que le corresponda.
      </p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nombre-ciclo" className="text-base font-medium text-tinta">
          Ciclo
        </label>
        <Input
          id="nombre-ciclo"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="max-w-40"
        />
      </div>

      <ul className="flex flex-col">
        <FilaPeriodo
          periodo={revisado}
          cerrado={false}
          mostrarProblema={!enBlanco}
          alEditar={(campo, valor) => setPeriodo({ ...periodo, [campo]: valor })}
        />
      </ul>

      {error && <Aviso tono="error">{error}</Aviso>}

      <div>
        <Button size="lg" onClick={() => void abrir()} disabled={!listo || guardando}>
          {guardando ? 'Abriendo…' : 'Abrir ciclo escolar'}
        </Button>
      </div>
    </div>
  )
}

/** Un ciclo ya abierto: corregir fechas y abrir los trimestres que falten. */
function Configurado({ ciclo }: { ciclo: CicloEnCurso }) {
  const [periodos, setPeriodos] = useState<Periodo[]>(() =>
    revisarPeriodos(periodosDe(ciclo.trimestres)),
  )
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [guardado, setGuardado] = useState(false)

  const porAbrir = siguienteNumero(ciclo)

  function editar(numero: number, campo: 'inicio' | 'fin', valor: string) {
    setGuardado(false)
    // Se revisan todos y no solo el que cambió: el traslape depende de la pareja,
    // así que corregir el fin del trimestre 1 tiene que apagar la marca del 2 al
    // mismo tiempo.
    setPeriodos((previos) =>
      revisarPeriodos(previos.map((p) => (p.numero === numero ? { ...p, [campo]: valor } : p))),
    )
  }

  async function guardar() {
    setGuardando(true)
    setError('')
    try {
      await guardarFechas(ciclo, periodos)
      setGuardado(true)
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  const pendientes = periodos.filter((p) => p.problema !== undefined).length

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-base font-medium text-tinta">Ciclo</span>
        {/* El nombre no se edita: cambiarlo en un ciclo con calificaciones dentro
            renombraría una historia que ya se reportó. */}
        <p className="cifra text-base text-tinta">{ciclo.ciclo.nombre}</p>
      </div>

      <ul className="flex flex-col">
        {periodos.map((periodo) => {
          const trimestre = ciclo.trimestres.find((t) => t.numero === periodo.numero)
          return (
            <FilaPeriodo
              key={periodo.numero}
              periodo={periodo}
              cerrado={trimestre?.estado === 'cerrado'}
              mostrarProblema
              alEditar={(campo, valor) => editar(periodo.numero, campo, valor)}
            />
          )
        })}
      </ul>

      {error && <Aviso tono="error">{error}</Aviso>}

      <div className="flex items-center gap-3">
        <Button
          size="lg"
          onClick={() => void guardar()}
          disabled={pendientes > 0 || guardando}
        >
          {guardando ? 'Guardando…' : 'Guardar fechas'}
        </Button>
        {/* aria-live: guardar no mueve el foco, así que el resultado tiene que
            anunciarse solo. */}
        <p className="text-base text-tinta-2" aria-live="polite">
          {guardado ? 'Guardado' : pendientes > 0 ? 'Revise lo marcado' : ''}
        </p>
      </div>

      {porAbrir !== null && <Siguiente ciclo={ciclo} numero={porAbrir} />}

      {ciclo.trimestres.some((t) => t.estado === 'cerrado') && (
        <p className="text-apoyo text-tinta-2">
          Un trimestre cerrado no permite cambiar sus fechas: sus calificaciones ya se
          reportaron.
        </p>
      )}

      <Terminar ciclo={ciclo} />
    </div>
  )
}

/**
 * Terminar el ciclo y dejar la app lista para el grupo que llega.
 *
 * Es la pantalla donde más importa decir qué **no** pasa: cerrar no borra nada, y
 * quien lo aprieta tiene que saberlo antes, no después. Por eso el aviso habla de
 * lo que se conserva tanto como de lo que desaparece de la vista.
 */
function Terminar({ ciclo }: { ciclo: CicloEnCurso }) {
  const [confirmando, setConfirmando] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const [error, setError] = useState('')

  const falta = loQueFaltaParaCerrarCiclo(ciclo)

  async function cerrar() {
    setCerrando(true)
    setError('')
    try {
      await cerrarCicloEscolar(ciclo)
      // Sin navegar a ninguna parte: `useCicloEnCurso` deja de ver este ciclo y
      // la pantalla vuelve sola a ofrecer abrir el siguiente.
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo cerrar el ciclo')
      setConfirmando(false)
    } finally {
      setCerrando(false)
    }
  }

  return (
    <section aria-labelledby="titulo-terminar" className="flex flex-col gap-2 border-t border-linea pt-4">
      <h2 id="titulo-terminar" className="text-base font-medium text-tinta">
        Terminar el ciclo escolar
      </h2>
      <p className="text-base text-tinta-2">
        Al terminarlo, la aplicación queda lista para el grupo que llega: la lista, la
        asistencia y las actividades de este ciclo dejan de aparecer en las pantallas de
        todos los días.{' '}
        <strong className="font-medium text-tinta">Nada se borra</strong>: las
        calificaciones de este ciclo se siguen consultando en Grupo → Ajustes → Ciclos
        anteriores.
      </p>

      {falta !== undefined ? (
        <p className="text-base text-tinta-2">
          {falta}. Un trimestre sin cerrar no guarda sus calificaciones definitivas, y
          después ya no se podrían volver a calcular.
        </p>
      ) : confirmando ? (
        <div
          role="alertdialog"
          aria-label="Confirmar el cierre del ciclo escolar"
          className="flex flex-col gap-3 rounded-md border-l-[7px] border-rojo bg-rojo/5 px-4 py-3"
        >
          <p className="text-base text-tinta">
            Se va a cerrar «{ciclo.ciclo.nombre}». Después habrá que cargar la lista del
            grupo nuevo, y este ciclo ya no se podrá reabrir desde aquí.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" disabled={cerrando} onClick={() => void cerrar()}>
              {cerrando ? 'Cerrando…' : 'Sí, terminar el ciclo escolar'}
            </Button>
            <Button variant="outline" onClick={() => setConfirmando(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="self-start" onClick={() => setConfirmando(true)}>
          Terminar el ciclo escolar
        </Button>
      )}

      {error && <Aviso tono="error">{error}</Aviso>}
    </section>
  )
}

/** Abrir el trimestre que sigue. Aparece solo cuando falta alguno. */
function Siguiente({ ciclo, numero }: { ciclo: CicloEnCurso; numero: 1 | 2 | 3 }) {
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoVacio(numero))
  const [abriendo, setAbriendo] = useState(false)
  const [error, setError] = useState('')

  const enBlanco = periodo.inicio === '' && periodo.fin === ''
  const problema = enBlanco ? undefined : revisarNuevoTrimestre(ciclo, periodo)
  const listo = !enBlanco && problema === undefined

  async function abrir() {
    setAbriendo(true)
    setError('')
    try {
      await abrirTrimestreSiguiente(ciclo, periodo)
      setPeriodo(periodoVacio(numero))
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo abrir el trimestre')
    } finally {
      setAbriendo(false)
    }
  }

  return (
    <section
      aria-labelledby="abrir-trimestre"
      className="flex flex-col gap-3 border-t border-linea pt-4"
    >
      <h2 id="abrir-trimestre" className="text-base font-medium text-tinta">
        Abrir el trimestre {numero}
      </h2>
      <p className="text-base text-tinta-2">
        Se abre cuando la escuela publique sus fechas. Los días ya registrados que caigan
        dentro de ese periodo se cuentan en él automáticamente.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="date"
          aria-label={`Inicio del trimestre ${numero}`}
          value={periodo.inicio}
          onChange={(e) => setPeriodo({ ...periodo, inicio: e.target.value })}
          className="cifra w-40"
        />
        <span aria-hidden className="text-base text-tinta-2">
          al
        </span>
        <Input
          type="date"
          aria-label={`Fin del trimestre ${numero}`}
          value={periodo.fin}
          onChange={(e) => setPeriodo({ ...periodo, fin: e.target.value })}
          className="cifra w-40"
        />
        <Button onClick={() => void abrir()} disabled={!listo || abriendo}>
          {abriendo ? 'Abriendo…' : `Abrir el trimestre ${numero}`}
        </Button>
      </div>

      {problema && <p className="text-apoyo text-rojo">{problema}</p>}
      {error && <Aviso tono="error">{error}</Aviso>}
    </section>
  )
}

function FilaPeriodo({
  periodo,
  cerrado,
  mostrarProblema,
  alEditar,
}: {
  periodo: Periodo
  cerrado: boolean
  mostrarProblema: boolean
  alEditar: (campo: 'inicio' | 'fin', valor: string) => void
}) {
  const malo = mostrarProblema && periodo.problema !== undefined

  return (
    <li className={cn('border-b border-linea first:border-t', malo && 'bg-rojo/5')}>
      <div className="flex min-h-14 flex-wrap items-center gap-2 py-2">
        {/* Misma barra de 7 px que la fila de asistencia: la marca se ve sin
            leer el mensaje. */}
        <span
          aria-hidden
          className={cn('h-14 w-[7px] shrink-0', malo ? 'bg-rojo' : 'bg-transparent')}
        />

        <span className="w-28 shrink-0 text-base font-medium text-tinta">
          Trimestre {periodo.numero}
          {cerrado && <span className="block text-apoyo text-tinta-2">cerrado</span>}
        </span>

        {/* type="date" y no un campo de texto: abre el selector de iPadOS y no
            el teclado, que es la misma razón por la que las calificaciones no
            usan un campo numérico (docs/UX.md §2). Además garantiza el formato
            AAAA-MM-DD, así que la validación solo tiene que juzgar el rango. */}
        <Input
          type="date"
          aria-label={`Inicio del trimestre ${periodo.numero}`}
          value={periodo.inicio}
          disabled={cerrado}
          onChange={(e) => alEditar('inicio', e.target.value)}
          className="cifra w-40"
        />
        <span aria-hidden className="text-base text-tinta-2">
          al
        </span>
        <Input
          type="date"
          aria-label={`Fin del trimestre ${periodo.numero}`}
          value={periodo.fin}
          disabled={cerrado}
          onChange={(e) => alEditar('fin', e.target.value)}
          className="cifra w-40"
        />
      </div>

      {malo && <p className="pb-2 pl-[3.25rem] text-apoyo text-rojo">{periodo.problema}</p>}
    </li>
  )
}
