import { useEffect, useState } from 'react'

import { ciclosAnteriores, trimestresConsultables } from '@/application/historico'
import type { CicloEnCurso } from '@/data/ports/evaluacion'
import type { Trimestre } from '@/domain/entities'
import { Cabecera } from '@/ui/components/Cabecera'
import { Cargando } from '@/ui/components/Cargando'
import { comoRango } from '@/ui/lib/fechas'
import { ReporteDelTrimestre } from '@/ui/screens/ReporteDelTrimestre'

/**
 * Las calificaciones de un ciclo que ya terminó.
 *
 * Existe por un caso concreto y poco frecuente: una aclaración de boleta del año
 * pasado. Por eso vive en Ajustes y **no toca ninguna de las cuatro pestañas**;
 * el camino diario no puede pagar un selector de ciclo que se usa dos veces al
 * año (D-025).
 *
 * Solo lectura y solo el snapshot: los números salen de `CierreTrimestre`, tal
 * como se reportaron. No hay nada que capturar aquí, y no hay forma de que
 * mirarlos los cambie.
 */
export function CiclosAnteriores({ alVolver }: { alVolver: () => void }) {
  const [ciclos, setCiclos] = useState<CicloEnCurso[] | null>(null)
  const [elegido, setElegido] = useState<CicloEnCurso | null>(null)
  const [trimestre, setTrimestre] = useState<Trimestre | null>(null)

  // Una carga y no una suscripción: un ciclo cerrado no cambia mientras se mira.
  useEffect(() => {
    let vivo = true
    void ciclosAnteriores().then((valor) => {
      if (vivo) setCiclos(valor)
    })
    return () => {
      vivo = false
    }
  }, [])

  if (elegido && trimestre) {
    return (
      <ReporteDelTrimestre
        trimestre={trimestre}
        cicloId={elegido.ciclo.id}
        alVolver={() => setTrimestre(null)}
      />
    )
  }

  return (
    <section aria-labelledby="titulo-anteriores" className="flex flex-col gap-4">
      <Cabecera titulo={elegido ? elegido.ciclo.nombre : 'Ciclos anteriores'}
        id="titulo-anteriores"
        alVolver={() => (elegido ? setElegido(null) : alVolver())}
        etiquetaVolver={elegido ? 'Volver a los ciclos' : 'Volver a Ajustes'} />

      {ciclos === null && <Cargando />}

      {ciclos !== null && ciclos.length === 0 && (
        <p className="text-base text-tinta-2">
          Todavía no hay ciclos terminados. Cuando se cierre uno, sus calificaciones se
          consultan aquí.
        </p>
      )}

      {ciclos !== null && ciclos.length > 0 && elegido === null && (
        <>
          <p className="text-base text-tinta-2">
            Las calificaciones tal como se reportaron. No se recalculan y no se pueden
            cambiar.
          </p>
          <ul className="divide-y divide-linea rounded-md border border-linea bg-papel">
            {ciclos.map((ciclo) => (
              <li key={ciclo.ciclo.id}>
                <button
                  type="button"
                  onClick={() => setElegido(ciclo)}
                  className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left"
                >
                  <span className="cifra text-base font-medium text-tinta">
                    {ciclo.ciclo.nombre}
                  </span>
                  <span className="text-base text-tinta-2">
                    {trimestresConsultables(ciclo).length === 1
                      ? '1 trimestre'
                      : `${trimestresConsultables(ciclo).length} trimestres`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {elegido !== null && <Trimestres ciclo={elegido} alElegir={setTrimestre} />}
    </section>
  )
}

/** Los trimestres cerrados de un ciclo, para elegir cuál consultar. */
function Trimestres({
  ciclo,
  alElegir,
}: {
  ciclo: CicloEnCurso
  alElegir: (trimestre: Trimestre) => void
}) {
  const consultables = trimestresConsultables(ciclo)

  if (consultables.length === 0) {
    return (
      <p className="text-base text-tinta-2">
        Este ciclo no tiene trimestres cerrados, así que no guardó calificaciones
        definitivas.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-linea rounded-md border border-linea bg-papel">
      {consultables.map((trimestre) => (
        <li key={trimestre.id}>
          <button
            type="button"
            onClick={() => alElegir(trimestre)}
            className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left"
          >
            <span className="text-base font-medium text-tinta">
              Trimestre {trimestre.numero}
            </span>
            <span className="cifra text-base text-tinta-2">
              {comoRango(trimestre.inicio, trimestre.fin)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
