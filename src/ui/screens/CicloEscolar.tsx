import { useMemo, useState } from 'react'

import {
  abrirCicloEscolar,
  guardarFechas,
  nombreDeCicloEn,
  type Periodo,
  periodosCompletos,
  periodosDe,
  periodosVacios,
  revisarPeriodos,
} from '@/application/evaluacion'
import type { CicloEnCurso } from '@/data/ports/evaluacion'
import { fechaLocal } from '@/domain/fechas'
import { IconoAtras } from '@/ui/components/iconos'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { useCicloEnCurso } from '@/ui/hooks/useCicloEnCurso'
import { cn } from '@/ui/lib/utils'

/**
 * El ciclo escolar y las fechas de sus tres trimestres.
 *
 * Vive en Ajustes y no en una pestaña: se toca al empezar el ciclo y cuando la
 * escuela mueve un calendario, o sea tres veces al año. La regla nunca fue
 * *ninguna pantalla*, era *ninguna pantalla en el camino diario* (docs/UX.md §4).
 *
 * Las fechas no son un dato administrativo: son lo que atribuye cada registro de
 * asistencia a un trimestre, sin que ella elija nada. De ahí que la pantalla
 * insista en que los tres periodos queden bien antes de guardar —un hueco entre
 * dos trimestres son días que no cuentan para ninguno—.
 */
export function CicloEscolar({ alVolver }: { alVolver: () => void }) {
  const { ciclo, cargando } = useCicloEnCurso()

  if (cargando) {
    return (
      <Marco alVolver={alVolver}>
        <p className="pt-6 text-base text-tinta-2" aria-live="polite">
          Cargando…
        </p>
      </Marco>
    )
  }

  return (
    <Marco alVolver={alVolver}>
      {/* La `key` remonta el formulario cuando aparece el ciclo recién creado:
          sus campos pasan a describir otra cosa y arrastrar el estado anterior
          mostraría lo que ella tecleó, no lo que se guardó. */}
      <Formulario key={ciclo?.ciclo.id ?? 'nuevo'} ciclo={ciclo} />
    </Marco>
  )
}

function Marco({ alVolver, children }: { alVolver: () => void; children: React.ReactNode }) {
  return (
    <section aria-labelledby="titulo-ciclo" className="mx-auto flex max-w-2xl flex-col">
      <header className="flex items-center gap-1">
        <Button size="icon" variant="ghost" onClick={alVolver} aria-label="Volver a Ajustes">
          <IconoAtras className="size-6" />
        </Button>
        <h1 id="titulo-ciclo" className="text-2xl font-bold text-tinta">
          Ciclo escolar
        </h1>
      </header>
      {children}
    </section>
  )
}

function Formulario({ ciclo }: { ciclo: CicloEnCurso | null }) {
  const hoy = useMemo(() => fechaLocal(new Date()), [])
  const [nombre, setNombre] = useState(() => ciclo?.ciclo.nombre ?? nombreDeCicloEn(hoy))
  const [periodos, setPeriodos] = useState<Periodo[]>(() =>
    ciclo ? revisarPeriodos(periodosDe(ciclo.trimestres)) : periodosVacios(),
  )
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [guardado, setGuardado] = useState(false)

  function editar(numero: number, campo: 'inicio' | 'fin', valor: string) {
    setGuardado(false)
    // Se revisan los tres y no solo el que cambió: el traslape depende de la
    // pareja, así que corregir el fin del trimestre 1 tiene que apagar la marca
    // del 2 al mismo tiempo.
    setPeriodos((previos) =>
      revisarPeriodos(previos.map((p) => (p.numero === numero ? { ...p, [campo]: valor } : p))),
    )
  }

  async function guardar() {
    setGuardando(true)
    setError('')
    try {
      if (ciclo) await guardarFechas(ciclo, periodos)
      else await abrirCicloEscolar(nombre, periodos)
      setGuardado(true)
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  const listo = periodosCompletos(revisarPeriodos(periodos))
  const pendientes = periodos.filter((p) => p.problema !== undefined).length
  // Un periodo en blanco todavía no es un error que reprocharle: la pantalla
  // recién abierta no debe recibirla con tres marcas rojas.
  const enBlanco = periodos.every((p) => p.inicio === '' && p.fin === '')

  return (
    <div className="flex flex-col gap-4 pt-4">
      {ciclo === null && (
        <p className="text-base text-tinta-2">
          Copia las fechas del calendario oficial. Con ellas, cada día que captures se cuenta
          en su trimestre solo, sin que tengas que elegirlo.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nombre-ciclo" className="text-base font-medium text-tinta">
          Ciclo
        </label>
        <Input
          id="nombre-ciclo"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          // El nombre no se edita después: cambiarlo en un ciclo con
          // calificaciones dentro renombraría una historia que ya se reportó.
          disabled={ciclo !== null}
          className="max-w-40"
        />
      </div>

      <ul className="flex flex-col">
        {periodos.map((periodo) => {
          const trimestre = ciclo?.trimestres.find((t) => t.numero === periodo.numero)
          return (
            <FilaPeriodo
              key={periodo.numero}
              periodo={periodo}
              cerrado={trimestre?.estado === 'cerrado'}
              mostrarProblema={!enBlanco}
              alEditar={(campo, valor) => editar(periodo.numero, campo, valor)}
            />
          )
        })}
      </ul>

      {error && (
        <p
          role="alert"
          className="rounded-md border-l-[7px] border-rojo bg-rojo/5 px-4 py-3 text-base text-tinta"
        >
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button
          size="lg"
          onClick={() => void guardar()}
          disabled={!listo || guardando || (ciclo !== null && pendientes > 0)}
        >
          {guardando ? 'Guardando…' : ciclo ? 'Guardar fechas' : 'Abrir ciclo escolar'}
        </Button>
        {/* aria-live: guardar no mueve el foco, así que el resultado tiene que
            anunciarse solo. */}
        <p className="text-base text-tinta-2" aria-live="polite">
          {guardado ? 'Guardado' : pendientes > 0 && !enBlanco ? 'Revisa lo marcado' : ''}
        </p>
      </div>

      {ciclo?.trimestres.some((t) => t.estado === 'cerrado') && (
        <p className="text-[13px] text-tinta-2">
          Un trimestre cerrado no admite cambios de fecha: sus calificaciones ya se
          reportaron.
        </p>
      )}
    </div>
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
          {cerrado && <span className="block text-[13px] text-tinta-2">cerrado</span>}
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

      {malo && <p className="pb-2 pl-[3.25rem] text-[13px] text-rojo">{periodo.problema}</p>}
    </li>
  )
}
