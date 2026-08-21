import { useEffect, useState } from 'react'

import { repos } from '@/data'
import type { Alumno, EvaluacionRubrica } from '@/domain/entities'
import type { Id } from '@/domain/values'

interface Emision {
  actividadId: Id
  alumnos: Alumno[]
  evaluaciones: EvaluacionRubrica[]
}

/**
 * El grupo y lo calificado con rúbrica en una actividad, reactivos. Mismo patrón
 * que `useEntregasDeActividad`: dos suscripciones y no una consulta combinada,
 * porque el grupo cambia una vez al año y los niveles cambian con cada toque.
 *
 * Devuelve las dos listas en crudo y no las filas ya cruzadas: cruzarlas necesita
 * los renglones de la rúbrica, que no salen de aquí sino del selector de la
 * actividad. Que la pantalla las combine con `filasDeCalificacion` evita pasarle a
 * este hook un arreglo que cambia de identidad en cada render.
 */
export function useEvaluacionesDeActividad(actividadId: Id): {
  alumnos: Alumno[]
  evaluaciones: EvaluacionRubrica[]
  cargando: boolean
} {
  const [emision, setEmision] = useState<Emision | null>(null)

  useEffect(() => {
    let vivo = true
    let alumnos: Alumno[] | null = null
    let evaluaciones: EvaluacionRubrica[] | null = null

    const emitir = () => {
      if (!vivo || alumnos === null || evaluaciones === null) return
      setEmision({ actividadId, alumnos, evaluaciones })
    }

    const subAlumnos = repos.alumnos.observarLista().subscribe((valor) => {
      alumnos = valor
      emitir()
    })
    const subEvaluaciones = repos.evaluacion
      .observarEvaluacionesDeActividad(actividadId)
      .subscribe((valor) => {
        evaluaciones = valor
        emitir()
      })

    return () => {
      vivo = false
      subAlumnos.unsubscribe()
      subEvaluaciones.unsubscribe()
    }
  }, [actividadId])

  const alDia = emision?.actividadId === actividadId

  return {
    alumnos: alDia ? emision.alumnos : [],
    evaluaciones: alDia ? emision.evaluaciones : [],
    cargando: !alDia,
  }
}
