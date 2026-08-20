import { useEffect, useState } from 'react'

import { repos } from '@/data'
import type { ActividadesDelCriterio } from '@/data/ports/evaluacion'
import type { Id } from '@/domain/values'

interface Emision {
  trimestreId: Id
  grupos: ActividadesDelCriterio[]
}

/**
 * Las actividades del trimestre agrupadas por criterio, reactivas: crear una la
 * deja en la lista sin recargar, y calificarla —C22, C23— cambiará su marca sola.
 *
 * `cargando` se deriva de si lo último que llegó corresponde al trimestre pedido,
 * igual que en los demás hooks: sin eso, cambiar de trimestre parpadea un «todavía
 * no hay actividades» falso.
 */
export function useActividadesDelTrimestre(trimestreId: Id | null): {
  grupos: ActividadesDelCriterio[]
  cargando: boolean
} {
  const [emision, setEmision] = useState<Emision | null>(null)

  useEffect(() => {
    if (trimestreId === null) return

    const sub = repos.evaluacion
      .observarActividadesDeTrimestre(trimestreId)
      .subscribe((grupos) => {
        setEmision({ trimestreId, grupos })
      })

    return () => {
      sub.unsubscribe()
    }
  }, [trimestreId])

  if (trimestreId === null) return { grupos: [], cargando: false }

  const alDia = emision?.trimestreId === trimestreId
  return { grupos: alDia ? emision.grupos : [], cargando: !alDia }
}
