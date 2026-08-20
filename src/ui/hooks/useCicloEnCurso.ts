import { useEffect, useState } from 'react'

import { repos } from '@/data'
import type { CicloEnCurso } from '@/data/ports/evaluacion'

/**
 * El ciclo escolar en curso, reactivo. Emite de nuevo en cuanto ella ajusta una
 * fecha en Ajustes, así que la etiqueta del trimestre en la pantalla de
 * asistencia se corrige sola sin recargar.
 *
 * `cargando` se distingue de "no hay ciclo configurado" a propósito: los dos son
 * `null` en la base, pero uno pide esperar y el otro pide invitar a configurarlo.
 * Sin la distinción, la pantalla de asistencia parpadearía "Sin ciclo escolar"
 * cada vez que se monta.
 */
export function useCicloEnCurso(): { ciclo: CicloEnCurso | null; cargando: boolean } {
  const [estado, setEstado] = useState<{ ciclo: CicloEnCurso | null } | null>(null)

  useEffect(() => {
    const sub = repos.evaluacion.observarCicloEnCurso().subscribe((ciclo) => {
      setEstado({ ciclo })
    })
    return () => {
      sub.unsubscribe()
    }
  }, [])

  return { ciclo: estado?.ciclo ?? null, cargando: estado === null }
}
