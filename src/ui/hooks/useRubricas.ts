import { useEffect, useState } from 'react'

import { repos } from '@/data'
import type { RubricaConCriterios } from '@/data/ports/evaluacion'

/**
 * Las rúbricas, reactivas. Emite de nuevo al guardar una, así que el selector de
 * rúbrica de un criterio se entera de la nueva sin recargar ni volver a entrar.
 *
 * `cargando` distingue «todavía no llegó nada» de «no hay ninguna rúbrica»: los
 * dos son una lista vacía, pero uno pide esperar y el otro pide invitar a crear la
 * primera.
 */
export function useRubricas(): { rubricas: RubricaConCriterios[]; cargando: boolean } {
  const [emision, setEmision] = useState<RubricaConCriterios[] | null>(null)

  useEffect(() => {
    const sub = repos.evaluacion.observarRubricas().subscribe(setEmision)
    return () => {
      sub.unsubscribe()
    }
  }, [])

  return { rubricas: emision ?? [], cargando: emision === null }
}
