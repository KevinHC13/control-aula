import { useEffect, useState } from 'react'

import { armarFaltasDeLaSemana, type ReporteDeFaltas } from '@/application/faltas'
import { repos } from '@/data'
import type { Alumno, RegistroAsistencia } from '@/domain/entities'
import { rangoDeLaSemana } from '@/domain/fechas'
import type { Fecha } from '@/domain/values'

interface Emision {
  lunes: Fecha
  alumnos: Alumno[]
  registros: RegistroAsistencia[]
}

/**
 * Las faltas de una semana, reactivas: pasar lista corrige el reporte sin
 * recargar, y corregir un ausente a retardo lo saca de la cuenta a la vista.
 *
 * El `lunes` de la emisión no es de adorno. Al cambiar de semana las dos
 * suscripciones se rehacen y la primera en llegar sería del rango nuevo con los
 * datos de la anterior todavía en el estado: un parpadeo con las cifras
 * equivocadas. Mientras la emisión no sea de la semana que se está mirando, se
 * dice que está cargando.
 */
export function useFaltasDeLaSemana(lunes: Fecha): {
  reporte: ReporteDeFaltas | null
  cargando: boolean
} {
  const [emision, setEmision] = useState<Emision | null>(null)

  useEffect(() => {
    let vivo = true
    let alumnos: Alumno[] | null = null
    let registros: RegistroAsistencia[] | null = null

    const emitir = () => {
      if (!vivo || alumnos === null || registros === null) return
      setEmision({ lunes, alumnos, registros })
    }

    const { desde, hasta } = rangoDeLaSemana(lunes)

    const subAlumnos = repos.alumnos.observarLista().subscribe((valor) => {
      alumnos = valor
      emitir()
    })
    const subRegistros = repos.asistencia.observarRango(desde, hasta).subscribe((valor) => {
      registros = valor
      emitir()
    })

    return () => {
      vivo = false
      subAlumnos.unsubscribe()
      subRegistros.unsubscribe()
    }
  }, [lunes])

  if (emision === null || emision.lunes !== lunes) return { reporte: null, cargando: true }

  return {
    reporte: armarFaltasDeLaSemana(emision.alumnos, emision.registros, lunes),
    cargando: false,
  }
}
