import { useMemo, useState } from 'react'

import {
  CAMPOS_CON_NOMBRE,
  estaCalificada,
  rubricaSugerida,
  trimestreDe,
} from '@/application/evaluacion'
import { camposDelExamen, examenListo } from '@/application/examen'
import type {
  ActividadConEstado,
  ActividadesDelCriterio,
  ExamenDelTrimestre,
} from '@/data/ports/evaluacion'
import type { Trimestre } from '@/domain/entities'
import { fechaLocal } from '@/domain/fechas'
import { EstadoVacio } from '@/ui/components/EstadoVacio'
import { SelectorTrimestre } from '@/ui/components/SelectorTrimestre'
import { Cargando } from '@/ui/components/Cargando'
import { Button } from '@/ui/components/ui/button'
import { useActividadesDelTrimestre } from '@/ui/hooks/useActividadesDelTrimestre'
import { useCicloEnCurso } from '@/ui/hooks/useCicloEnCurso'
import { useExamenesDelTrimestre } from '@/ui/hooks/useExamenesDelTrimestre'
import { useRubricas } from '@/ui/hooks/useRubricas'
import { comoDiaCorto } from '@/ui/lib/fechas'
import { cn } from '@/ui/lib/utils'
import { CapturaEntregas } from '@/ui/screens/CapturaEntregas'
import { CapturaExamen } from '@/ui/screens/CapturaExamen'
import { CapturaRubrica } from '@/ui/screens/CapturaRubrica'
import { FormaActividad } from '@/ui/screens/FormaActividad'
import { ReporteDelTrimestre } from '@/ui/screens/ReporteDelTrimestre'

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
  // Los exámenes vienen aparte de las actividades porque no son actividades: se
  // capturan por aciertos sobre el CriterioTrimestre (D-018).
  const { examenes } = useExamenesDelTrimestre(trimestre?.id ?? null)

  // La subvista vive y muere aquí dentro, como el calendario en Asistencia: no
  // cruza pantallas, así que no va al store.
  const [subvista, setSubvista] = useState<{
    modo: 'forma' | 'captura' | 'rubrica'
    grupoId: string
    actividadId?: string
  } | null>(null)

  // El examen abierto, por `criterio_trimestre_id`. Aparte de `subvista` porque no
  // cuelga de un grupo de actividades: no tiene ninguna.
  const [examenAbierto, setExamenAbierto] = useState<string | null>(null)
  const examen = examenes.find((e) => e.ponderado.id === examenAbierto)

  // El reporte del trimestre: lo mismo que se captura aquí, ya sumado.
  const [viendoReporte, setViendoReporte] = useState(false)

  const grupoAbierto = grupos.find((g) => g.ponderado.id === subvista?.grupoId)
  // Se busca por id y no se guarda la actividad: así la subvista siempre ve la
  // versión recién emitida por la suscripción, no una copia congelada al abrirla.
  const actividadAbierta = grupoAbierto?.actividades.find(
    (a) => a.actividad.id === subvista?.actividadId,
  )

  if (viendoReporte && trimestre) {
    return (
      <ReporteDelTrimestre trimestre={trimestre} alVolver={() => setViendoReporte(false)} />
    )
  }

  if (examen && trimestre) {
    return (
      <CapturaExamen
        trimestre={trimestre}
        examen={examen}
        alVolver={() => setExamenAbierto(null)}
      />
    )
  }

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
        <Cargando />
      ) : !ciclo ? (
        <EstadoVacio titulo="Todavía no hay un ciclo escolar registrado.">
          Cada actividad pertenece a un trimestre, así que primero hay que registrar el
          ciclo, en Grupo → Ajustes → Ciclo escolar.
        </EstadoVacio>
      ) : (
        <>
          <SelectorTrimestre
            trimestres={ciclo.trimestres}
            activo={numeroActivo}
            alElegir={setElegido}
          />

          {grupos.length === 0 && examenes.length === 0 ? (
            <EstadoVacio titulo="Este trimestre todavía no tiene con qué calificar.">
              Los criterios —las tareas, el examen, la conducta— se agregan en Grupo →
              Ajustes → Criterios y pesos.
            </EstadoVacio>
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

          {examenes.map((item) => (
            <FilaDeExamen
              key={item.ponderado.id}
              examen={item}
              alAbrir={() => setExamenAbierto(item.ponderado.id)}
            />
          ))}

          {/* Al final y no arriba: la lista de lo que falta calificar es lo que
              se abre todos los días; los números se consultan al cortar. */}
          {trimestre && (
            <Button
              variant="outline"
              className="mt-2 self-start"
              onClick={() => setViendoReporte(true)}
            >
              Ver las calificaciones del trimestre
            </Button>
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
        <p className="text-apoyo text-tinta-2" aria-live="polite">
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
      ? 'entregado o no entregado'
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
          <span className="text-apoyo text-tinta-2">
            {comoDiaCorto(actividad.fecha)}
            {campo && ` · ${campo}`}
            {conQue && ` · ${conQue}`}
          </span>
        </span>

        <span
          className={cn(
            'shrink-0 pr-1 text-apoyo',
            calificada ? 'text-tinta-2' : 'text-rojo',
          )}
        >
          {calificada ? `${item.registros}` : 'sin calificar'}
        </span>
      </button>
    </li>
  )
}

/**
 * El examen del trimestre, en su propia sección.
 *
 * No entra en la lista de actividades porque no tiene ninguna: se captura por
 * aciertos sobre el `CriterioTrimestre` (D-018). Se ve aparte a propósito —hay uno
 * por trimestre y se captura un día, no todas las semanas— y dice si ya sabemos
 * cuántas preguntas trae, que es lo que decide si se puede capturar.
 */
function FilaDeExamen({
  examen,
  alAbrir,
}: {
  examen: ExamenDelTrimestre
  alAbrir: () => void
}) {
  const listo = examenListo(examen)
  const campos = camposDelExamen(examen)
  const preguntas = campos.reduce((acc, c) => acc + c.preguntas, 0)

  return (
    <section aria-labelledby={`examen-${examen.ponderado.id}`} className="flex flex-col">
      <header className="flex items-baseline justify-between gap-2 border-b border-linea pb-1">
        <h2 id={`examen-${examen.ponderado.id}`} className="text-base font-medium text-tinta">
          {examen.criterio.nombre}{' '}
          <span className="cifra font-normal text-tinta-2">{examen.ponderado.peso}%</span>
        </h2>
        <p className="text-apoyo text-tinta-2">
          {listo ? `${campos.length} campos` : 'sin preguntas'}
        </p>
      </header>

      <button
        type="button"
        onClick={alAbrir}
        className="flex min-h-14 w-full items-center gap-2 border-b border-linea text-left"
      >
        <span
          aria-hidden
          className={cn(
            'h-14 w-[7px] shrink-0',
            listo ? 'bg-azul' : 'border-x border-linea bg-transparent',
          )}
        />
        <span className="flex min-w-0 flex-1 flex-col py-2">
          <span className="truncate text-base font-medium text-tinta">
            {listo ? 'Registrar los aciertos' : 'Indicar cuántas preguntas tiene'}
          </span>
          <span className="text-apoyo text-tinta-2">
            {listo ? (
              <>
                <span className="cifra">{preguntas}</span> preguntas en total
              </>
            ) : (
              'Antes de registrar aciertos hay que indicar cuántas preguntas tiene el examen'
            )}
          </span>
        </span>
      </button>
    </section>
  )
}
