import { useEffect, useState } from 'react'

import { repos } from '@/data'
import type { ExamenDelTrimestre } from '@/data/ports/evaluacion'
import type { Id } from '@/domain/values'

interface Emision {
  trimestreId: Id
  examenes: ExamenDelTrimestre[]
}

/**
 * Los exámenes del trimestre, reactivos. Guardar las preguntas habilita la captura
 * sin recargar, y cambiar el peso del criterio se ve en la lista.
 *
 * Con `trimestreId` en `null` —todavía no hay ciclo— no se suscribe a nada y
 * devuelve la lista vacía: es un estado normal en el primer arranque.
 */
export function useExamenesDelTrimestre(trimestreId: Id | null): {
  examenes: ExamenDelTrimestre[]
  cargando: boolean
} {
  const [emision, setEmision] = useState<Emision | null>(null)

  useEffect(() => {
    if (trimestreId === null) return

    const sub = repos.evaluacion
      .observarExamenesDeTrimestre(trimestreId)
      .subscribe((examenes) => setEmision({ trimestreId, examenes }))

    return () => {
      sub.unsubscribe()
    }
  }, [trimestreId])

  // Sin trimestre no hay nada que cargar, y decir «cargando» invitaría a esperar
  // algo que no viene.
  if (trimestreId === null) return { examenes: [], cargando: false }

  // Al cambiar de trimestre, la emisión anterior es de otro: mostrarla haría
  // parpadear los exámenes del trimestre que se acaba de dejar.
  const alDia = emision?.trimestreId === trimestreId

  return {
    examenes: alDia ? emision.examenes : [],
    cargando: !alDia,
  }
}
