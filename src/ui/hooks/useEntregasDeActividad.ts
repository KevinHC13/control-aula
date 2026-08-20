import { useEffect, useState } from 'react'

import { type FilaEntrega, filasDeEntrega } from '@/application/entregas'
import { repos } from '@/data'
import type { Alumno, Entrega } from '@/domain/entities'
import type { Id } from '@/domain/values'

interface Emision {
  actividadId: Id
  filas: FilaEntrega[]
}

/**
 * La captura de una actividad, reactiva. Mismo patrón que `useAsistenciaDelDia`:
 * dos suscripciones y no una consulta combinada, porque el grupo cambia una vez al
 * año y las entregas cambian con cada toque. Releer los 30 alumnos en cada captura
 * es justo lo que el presupuesto de 15 segundos no puede pagar.
 */
export function useEntregasDeActividad(actividadId: Id): {
  filas: FilaEntrega[]
  cargando: boolean
} {
  const [emision, setEmision] = useState<Emision | null>(null)

  useEffect(() => {
    let vivo = true
    let alumnos: Alumno[] | null = null
    let entregas: Entrega[] | null = null

    const emitir = () => {
      if (!vivo || alumnos === null || entregas === null) return
      setEmision({ actividadId, filas: filasDeEntrega(alumnos, entregas) })
    }

    const subAlumnos = repos.alumnos.observarLista().subscribe((valor) => {
      alumnos = valor
      emitir()
    })
    const subEntregas = repos.evaluacion
      .observarEntregasDeActividad(actividadId)
      .subscribe((valor) => {
        entregas = valor
        emitir()
      })

    return () => {
      vivo = false
      subAlumnos.unsubscribe()
      subEntregas.unsubscribe()
    }
  }, [actividadId])

  const alDia = emision?.actividadId === actividadId

  return {
    filas: alDia ? emision.filas : [],
    cargando: !alDia,
  }
}
