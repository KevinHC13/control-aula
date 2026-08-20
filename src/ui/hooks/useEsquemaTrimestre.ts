import { useEffect, useState } from 'react'

import { repos } from '@/data'
import type { EsquemaTrimestre } from '@/data/ports/evaluacion'
import type { Id } from '@/domain/values'

interface Emision {
  trimestreId: Id
  esquema: EsquemaTrimestre | null
}

/**
 * El reparto de pesos de un trimestre, reactivo. Es lo que hace que el total
 * corriente se recalcule al cambiar un peso, sin botón de refrescar.
 *
 * `cargando` se deriva de si lo último que llegó corresponde al trimestre que se
 * está pidiendo, igual que en `useAsistenciaDelDia`: sin esa distinción, cambiar
 * de trimestre parpadearía un «sin criterios» falso antes de pintar los que sí
 * hay.
 */
export function useEsquemaTrimestre(trimestreId: Id | null): {
  esquema: EsquemaTrimestre | null
  cargando: boolean
} {
  const [emision, setEmision] = useState<Emision | null>(null)

  useEffect(() => {
    if (trimestreId === null) return

    const sub = repos.evaluacion
      .observarEsquemaDeTrimestre(trimestreId)
      .subscribe((esquema) => {
        setEmision({ trimestreId, esquema })
      })

    return () => {
      sub.unsubscribe()
    }
  }, [trimestreId])

  if (trimestreId === null) return { esquema: null, cargando: false }

  const alDia = emision?.trimestreId === trimestreId
  return { esquema: alDia ? emision.esquema : null, cargando: !alDia }
}
