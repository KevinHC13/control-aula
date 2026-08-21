import { useEffect, useState } from 'react'

import { type FilaParticipacion, filasDeParticipacion } from '@/application/participacion'
import { repos } from '@/data'
import type { Alumno, Participacion, Trimestre } from '@/domain/entities'
import type { Fecha } from '@/domain/values'

interface Emision {
  fecha: Fecha
  filas: FilaParticipacion[]
}

/**
 * El grupo con sus participaciones del día y del trimestre, reactivo. Es lo que
 * hace que el número suba en el toque y que el conteo del trimestre se mueva con
 * él, sin recargar.
 *
 * Tres suscripciones y no una consulta combinada, por lo mismo que en
 * `useAsistenciaDelDia`: el grupo cambia una vez al año, el día cambia con cada
 * toque y el trimestre cambia cuando cambia el día. Cada una es una consulta por
 * índice.
 *
 * Sin trimestre —un día de vacaciones no cae en ninguno— el conteo del trimestre
 * es cero para todos y el del día sigue funcionando: marcar sigue siendo un dato,
 * solo que no va a calificar a nadie.
 */
export function useParticipacionDelDia(
  fecha: Fecha,
  trimestre: Trimestre | null,
): { filas: FilaParticipacion[]; cargando: boolean } {
  const [emision, setEmision] = useState<Emision | null>(null)

  const inicio = trimestre?.inicio ?? null
  const fin = trimestre?.fin ?? null

  useEffect(() => {
    let vivo = true
    let alumnos: Alumno[] | null = null
    let delDia: Participacion[] | null = null
    let delTrimestre: Participacion[] | null = inicio === null || fin === null ? [] : null

    const emitir = () => {
      if (!vivo || alumnos === null || delDia === null || delTrimestre === null) return
      setEmision({ fecha, filas: filasDeParticipacion(alumnos, delDia, delTrimestre) })
    }

    const subAlumnos = repos.alumnos.observarLista().subscribe((valor) => {
      alumnos = valor
      emitir()
    })
    const subDia = repos.participaciones.observarDia(fecha).subscribe((valor) => {
      delDia = valor
      emitir()
    })
    const subTrimestre =
      inicio === null || fin === null
        ? null
        : repos.participaciones.observarRango(inicio, fin).subscribe((valor) => {
            delTrimestre = valor
            emitir()
          })

    return () => {
      vivo = false
      subAlumnos.unsubscribe()
      subDia.unsubscribe()
      subTrimestre?.unsubscribe()
    }
  }, [fecha, inicio, fin])

  const alDia = emision?.fecha === fecha

  return { filas: alDia ? emision.filas : [], cargando: !alDia }
}
