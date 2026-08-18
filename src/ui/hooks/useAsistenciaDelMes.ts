import { useEffect, useState } from 'react'

import { type DiaDelMes, resumenDelMes } from '@/application/asistencia'
import { repos } from '@/data'
import type { Mes } from '@/domain/values'

interface Emision {
  mes: Mes
  dias: DiaDelMes[]
}

/**
 * El mes, reactivo. Sostiene el mosaico del calendario: marcar una falta se ve
 * reflejada en su día sin volver a abrir nada.
 *
 * Una sola suscripción, y no dos como en `useAsistenciaDelDia`: el mosaico cuenta
 * registros, no necesita al grupo. `cargando` se **deriva** de si lo último que
 * llegó corresponde al mes que se está pidiendo, para que cambiar de mes no
 * parpadee una rejilla vacía falsa.
 */
export function useAsistenciaDelMes(mes: Mes): { dias: DiaDelMes[]; cargando: boolean } {
  const [emision, setEmision] = useState<Emision | null>(null)

  useEffect(() => {
    let vivo = true

    const sub = repos.asistencia.observarMes(mes).subscribe((registros) => {
      if (!vivo) return
      setEmision({ mes, dias: resumenDelMes(mes, registros) })
    })

    return () => {
      vivo = false
      sub.unsubscribe()
    }
  }, [mes])

  const alMes = emision?.mes === mes

  return {
    dias: alMes ? emision.dias : [],
    cargando: !alMes,
  }
}
