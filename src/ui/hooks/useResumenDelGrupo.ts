import { useEffect, useState } from 'react'

import { type ResumenDelGrupo, resumenDelGrupo } from '@/application/resumen'
import { repos } from '@/data'
import type { Alumno, RegistroAsistencia, Trimestre } from '@/domain/entities'
import type { Id } from '@/domain/values'

import { useReporteDeTrimestre } from './useReporteDeTrimestre'

interface Emision {
  trimestreId: Id | null
  alumnos: Alumno[]
  registros: RegistroAsistencia[]
}

/**
 * El resumen del grupo, reactivo: pasar lista corrige el porcentaje y capturar una
 * actividad corrige el promedio, sin recargar.
 *
 * Se apoya en `useReporteDeTrimestre` para las calificaciones en vez de leerlas de
 * nuevo: ahí vive la decisión de si los números vienen del cálculo o del snapshot
 * del cierre, y duplicarla aquí sería exactamente lo que `armarReporte` existe para
 * impedir.
 *
 * La asistencia sí se lee aquí, por rango de fechas: es lo único que el reporte no
 * trae ya resuelto por alumno.
 */
export function useResumenDelGrupo(trimestre: Trimestre | null): {
  resumen: ResumenDelGrupo | null
  cargando: boolean
} {
  const { reporte, cargando: cargandoReporte } = useReporteDeTrimestre(trimestre?.id ?? null)
  const [emision, setEmision] = useState<Emision | null>(null)

  const trimestreId = trimestre?.id ?? null
  const inicio = trimestre?.inicio ?? null
  const fin = trimestre?.fin ?? null

  useEffect(() => {
    let vivo = true
    let alumnos: Alumno[] | null = null
    // Sin trimestre no hay rango que leer: el resumen sale con el grupo y cero días,
    // que es la verdad en vacaciones o antes de abrir el ciclo.
    let registros: RegistroAsistencia[] | null = inicio === null || fin === null ? [] : null

    const emitir = () => {
      if (!vivo || alumnos === null || registros === null) return
      setEmision({ trimestreId, alumnos, registros })
    }

    const subAlumnos = repos.alumnos.observarLista().subscribe((valor) => {
      alumnos = valor
      emitir()
    })
    const subRegistros =
      inicio === null || fin === null
        ? null
        : repos.asistencia.observarRango(inicio, fin).subscribe((valor) => {
            registros = valor
            emitir()
          })

    return () => {
      vivo = false
      subAlumnos.unsubscribe()
      subRegistros?.unsubscribe()
    }
  }, [trimestreId, inicio, fin])

  const alDia = emision?.trimestreId === trimestreId
  if (!alDia || !emision) return { resumen: null, cargando: true }

  return {
    resumen: resumenDelGrupo(emision.alumnos, emision.registros, reporte?.alumnos ?? []),
    // El grupo y la asistencia ya llegaron; las calificaciones pueden seguir en
    // camino. Se dice, en vez de pintar un promedio de `—` que después cambia.
    cargando: cargandoReporte,
  }
}
