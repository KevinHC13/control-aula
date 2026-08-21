import { useEffect, useState } from 'react'

import { type FilaBitacora, filasDeBitacora } from '@/application/bitacora'
import { repos } from '@/data'
import type { Alumno, Reporte, Trimestre } from '@/domain/entities'
import type { Id } from '@/domain/values'

interface Emision {
  trimestreId: Id
  filas: FilaBitacora[]
}

/**
 * El grupo con sus reportes del trimestre, reactivo. Guardar un reporte sube el
 * conteo del alumno sin recargar, que es lo que permite ver que ya va en dos
 * antes de escribir el tercero.
 *
 * Dos suscripciones y no una consulta combinada, igual que en
 * `useAsistenciaDelDia`: el grupo cambia una vez al año y los reportes cambian
 * al escribir.
 */
export function useBitacoraDelTrimestre(trimestre: Trimestre | null): {
  filas: FilaBitacora[]
  cargando: boolean
} {
  const [emision, setEmision] = useState<Emision | null>(null)

  const trimestreId = trimestre?.id ?? null
  const inicio = trimestre?.inicio ?? null
  const fin = trimestre?.fin ?? null

  useEffect(() => {
    if (trimestreId === null || inicio === null || fin === null) return

    let vivo = true
    let alumnos: Alumno[] | null = null
    let reportes: Reporte[] | null = null

    const emitir = () => {
      if (!vivo || alumnos === null || reportes === null) return
      setEmision({ trimestreId, filas: filasDeBitacora(alumnos, reportes) })
    }

    const subAlumnos = repos.alumnos.observarLista().subscribe((valor) => {
      alumnos = valor
      emitir()
    })
    // Por rango de fechas: la atribución al trimestre se deriva al leer, así que
    // ajustar las fechas del trimestre recorta la lista sin migrar nada.
    const subReportes = repos.bitacora.observarRango(inicio, fin).subscribe((valor) => {
      reportes = valor
      emitir()
    })

    return () => {
      vivo = false
      subAlumnos.unsubscribe()
      subReportes.unsubscribe()
    }
  }, [trimestreId, inicio, fin])

  if (trimestreId === null) return { filas: [], cargando: false }

  const alDia = emision?.trimestreId === trimestreId
  return { filas: alDia ? emision.filas : [], cargando: !alDia }
}
