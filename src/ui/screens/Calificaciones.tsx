import { useMemo, useState } from 'react'

import {
  CAMPOS_CON_NOMBRE,
  estaCalificada,
  rubricaSugerida,
  trimestreDe,
} from '@/application/evaluacion'
import type { ActividadConEstado, ActividadesDelCriterio } from '@/data/ports/evaluacion'
import type { Trimestre } from '@/domain/entities'
import { fechaLocal } from '@/domain/fechas'
import { Button } from '@/ui/components/ui/button'
import { useActividadesDelTrimestre } from '@/ui/hooks/useActividadesDelTrimestre'
import { useCicloEnCurso } from '@/ui/hooks/useCicloEnCurso'
import { useRubricas } from '@/ui/hooks/useRubricas'
import { cn } from '@/ui/lib/utils'
import { CapturaEntregas } from '@/ui/screens/CapturaEntregas'
import { CapturaRubrica } from '@/ui/screens/CapturaRubrica'
import { FormaActividad } from '@/ui/screens/FormaActividad'

/**
 * Las actividades del trimestre, agrupadas por criterio.
 *
 * Es la primera pantalla de evaluación que vive **fuera** de Ajustes: crear una
 * actividad pasa varias veces por semana, no tres veces al año. De aquí saldrá la
 * captura —C22 y C23— así que lo que importa es que la lista diga de un vistazo
 * qué falta calificar.
 *
 * El trimestre arranca en el de hoy, igual que en *Criterios y pesos*: la
 * atribución de la asistencia es automática, pero configurar el trimestre que viene
 * mientras corre el actual sí necesita elegirse.
 */
export function Calificaciones() {
  const { ciclo, cargando } = useCicloEnCurso()
  const hoy = useMemo(() => fechaLocal(new Date()), [])

  const [elegido, setElegido] = useState<number | null>(null)
  const numeroActivo = elegido ?? trimestreDe(hoy, ciclo)?.numero ?? 1
  const trimestre = ciclo?.trimestres.find((t) => t.numero === numeroActivo) ?? null

  const { grupos } = useActividadesDelTrimestre(trimestre?.id ?? null)

  // La subvista vive y muere aquí dentro, como el calendario en Asistencia: no
  // cruza pantallas, así que no va al store.
  const [subvista, setSubvista] = useState<{
    modo: 'forma' | 'captura' | 'rubrica'
    grupoId: string
    actividadId?: string
  } | null>(null)

  const grupoAbierto = grupos.find((g) => g.ponderado.id === subvista?.grupoId)
  // Se busca por id y no se guarda la actividad: así la subvista siempre ve la
  // versión recién emitida por la suscripción, no una copia congelada al abrirla.
  const actividadAbierta = grupoAbierto?.actividades.find(
    (a) => a.actividad.id === subvista?.actividadId,
  )

  if (subvista && grupoAbierto && trimestre) {
    if (subvista.modo === 'captura' && actividadAbierta) {
      return (
        <CapturaEntregas
          trimestre={trimestre}
          actividad={actividadAbierta}
          alVolver={() => setSubvista(null)}
          alEditar={() => setSubvista({ ...subvista, modo: 'forma' })}
        />
      )
    }

    if (subvista.modo === 'rubrica' && actividadAbierta) {
      return (
        <CapturaRubrica
          trimestre={trimestre}
          actividad={actividadAbierta}
          alVolver={() => setSubvista(null)}
          alEditar={() => setSubvista({ ...subvista, modo: 'forma' })}
        />
      )
    }

    if (subvista.modo === 'forma') {
      return (
        <FormaActividad
          key={subvista.actividadId ?? 'nueva'}
          trimestre={trimestre}
          grupo={grupoAbierto}
          actual={actividadAbierta}
          rubricaPorOmision={rubricaSugerida(grupoAbierto)}
          hoy={hoy}
          alVolver={() => setSubvista(null)}
        />
      )
    }
  }

  return (
    <section aria-labelledby="titulo-calificaciones" className="flex flex-col gap-4">
      <h1 id="titulo-calificaciones" className="text-2xl font-bold text-tinta">
        Calificaciones
      </h1>

      {cargando ? (
        <p className="text-base text-tinta-2" aria-live="polite">
          Cargando…
        </p>
      ) : !ciclo ? (
        <p className="text-base text-tinta-2">
          Primero hay que abrir el ciclo escolar, en Grupo → Ajustes. Las actividades cuelgan
          de un trimestre.
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

          {grupos.length === 0 ? (
            <p className="text-base text-tinta-2">
              Este trimestre no tiene criterios que se llenen con actividades. Se configuran en
              Grupo → Ajustes → Criterios y pesos.
            </p>
          ) : (
            grupos.map((grupo) => (
              <GrupoDeCriterio
                key={grupo.ponderado.id}
                grupo={grupo}
                trimestre={trimestre}
                alNueva={() => setSubvista({ modo: 'forma', grupoId: grupo.ponderado.id })}
                alAbrir={(actividad) =>
                  setSubvista({
                    // La fila lleva a capturar, que es lo que se hace todos los
                    // días; editarla es un toque más desde ahí. Con qué se
                    // captura lo decide la rúbrica de la actividad.
                    modo: actividad.actividad.rubrica_id === null ? 'captura' : 'rubrica',
                    grupoId: grupo.ponderado.id,
                    actividadId: actividad.actividad.id,
                  })
                }
              />
            ))
          )}
        </>
      )}
    </section>
  )
}

function GrupoDeCriterio({
  grupo,
  trimestre,
  alNueva,
  alAbrir,
}: {
  grupo: ActividadesDelCriterio
  trimestre: Trimestre | null
  alNueva: () => void
  alAbrir: (actividad: ActividadConEstado) => void
}) {
  const abierto = trimestre?.estado === 'abierto'
  const sinCalificar = grupo.actividades.filter((a) => !estaCalificada(a)).length

  return (
    <section aria-labelledby={`criterio-${grupo.ponderado.id}`} className="flex flex-col">
      <header className="flex items-baseline justify-between gap-2 border-b border-linea pb-1">
        <h2
          id={`criterio-${grupo.ponderado.id}`}
          className="text-base font-medium text-tinta"
        >
          {grupo.criterio.nombre}{' '}
          <span className="cifra font-normal text-tinta-2">{grupo.ponderado.peso}%</span>
        </h2>
        <p className="text-[13px] text-tinta-2" aria-live="polite">
          {grupo.actividades.length === 0
            ? 'sin actividades'
            : sinCalificar === 0
              ? 'todas calificadas'
              : `${sinCalificar} sin calificar`}
        </p>
      </header>

      <ul>
        {grupo.actividades.map((item) => (
          <FilaActividad
            key={item.actividad.id}
            item={item}
            alAbrir={() => alAbrir(item)}
          />
        ))}
      </ul>

      {abierto && (
        <Button variant="outline" className="mt-2 self-start" onClick={alNueva}>
          Nueva actividad en {grupo.criterio.nombre}
        </Button>
      )}
    </section>
  )
}

function FilaActividad({
  item,
  alAbrir,
}: {
  item: ActividadConEstado
  alAbrir: () => void
}) {
  const { actividad } = item
  const { rubricas } = useRubricas()
  const calificada = estaCalificada(item)
  const campo = CAMPOS_CON_NOMBRE.find((c) => c.campo === actividad.campo)?.nombre
  // Con qué se califica, por nombre. Sin rúbrica no es un hueco: es captura
  // binaria, y decirlo evita abrir la actividad para averiguarlo.
  const conQue =
    actividad.rubrica_id === null
      ? 'entregada / no entregada'
      : rubricas.find((r) => r.rubrica.id === actividad.rubrica_id)?.rubrica.nombre

  return (
    <li className="border-b border-linea">
      <button
        type="button"
        onClick={alAbrir}
        className="flex min-h-14 w-full items-center gap-2 text-left"
      >
        {/* Azul si ya se calificó, hueca si no. La misma distinción que el
            calendario de asistencia hace entre un día capturado y uno sin pasar:
            pintar igual «no la he calificado» y «la califiqué» sería mentir. */}
        <span
          aria-hidden
          className={cn(
            'h-14 w-[7px] shrink-0',
            calificada ? 'bg-azul' : 'border-x border-linea bg-transparent',
          )}
        />

        <span className="flex min-w-0 flex-1 flex-col py-2">
          <span className="truncate text-base font-medium text-tinta">{actividad.nombre}</span>
          <span className="text-[13px] text-tinta-2">
            <span className="cifra">{actividad.fecha}</span>
            {campo && ` · ${campo}`}
            {conQue && ` · ${conQue}`}
          </span>
        </span>

        <span
          className={cn(
            'shrink-0 pr-1 text-[13px]',
            calificada ? 'text-tinta-2' : 'text-rojo',
          )}
        >
          {calificada ? `${item.registros}` : 'sin calificar'}
        </span>
      </button>
    </li>
  )
}
