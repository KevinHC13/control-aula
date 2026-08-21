import { useEffect, useState } from 'react'

import { repos } from '@/data'
import type { Alumno, ResultadoExamen } from '@/domain/entities'
import type { Id } from '@/domain/values'

interface Emision {
  criterioTrimestreId: Id
  alumnos: Alumno[]
  resultados: ResultadoExamen[]
}

/**
 * El grupo y lo capturado del examen, reactivos. Mismo patrón que
 * `useEvaluacionesDeActividad`: dos suscripciones y no una consulta combinada,
 * porque el grupo cambia una vez al año y los aciertos cambian con cada dígito.
 *
 * Devuelve las dos listas en crudo; cruzarlas necesita los campos del examen, que
 * salen de su configuración de preguntas y no de esta suscripción.
 */
export function useResultadosDeExamen(criterioTrimestreId: Id): {
  alumnos: Alumno[]
  resultados: ResultadoExamen[]
  cargando: boolean
} {
  const [emision, setEmision] = useState<Emision | null>(null)

  useEffect(() => {
    let vivo = true
    let alumnos: Alumno[] | null = null
    let resultados: ResultadoExamen[] | null = null

    const emitir = () => {
      if (!vivo || alumnos === null || resultados === null) return
      setEmision({ criterioTrimestreId, alumnos, resultados })
    }

    const subAlumnos = repos.alumnos.observarLista().subscribe((valor) => {
      alumnos = valor
      emitir()
    })
    const subResultados = repos.evaluacion
      .observarResultadosDeExamen(criterioTrimestreId)
      .subscribe((valor) => {
        resultados = valor
        emitir()
      })

    return () => {
      vivo = false
      subAlumnos.unsubscribe()
      subResultados.unsubscribe()
    }
  }, [criterioTrimestreId])

  const alDia = emision?.criterioTrimestreId === criterioTrimestreId

  return {
    alumnos: alDia ? emision.alumnos : [],
    resultados: alDia ? emision.resultados : [],
    cargando: !alDia,
  }
}
