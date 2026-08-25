import { useEffect, useState } from 'react'

import { armarReporte, type ReporteDeTrimestre } from '@/application/calificaciones'
import { repos } from '@/data'
import type { CapturasDelTrimestre } from '@/data/ports/evaluacion'
import type { Alumno, CierreTrimestre } from '@/domain/entities'
import type { Id } from '@/domain/values'

interface Emision {
  trimestreId: Id
  reporte: ReporteDeTrimestre | null
}

/**
 * Las calificaciones del trimestre, reactivas: capturar en otra pestaña corrige
 * estos números sin botón de recalcular, y cerrar el trimestre las cambia de
 * origen sin volver a entrar.
 *
 * Tres suscripciones y no una consulta combinada, por lo mismo que en las
 * capturas: el grupo cambia una vez al año, lo capturado cambia con cada toque y
 * los cierres solo al cerrar. Quién manda —el cálculo o el snapshot— lo decide
 * `armarReporte`, que es la única que sabe elegir.
 *
 * En los dos casos el grupo llega **con los dados de baja**: quién entra al
 * reporte lo decide `armarReporte` según el trimestre esté cerrado o abierto
 * (D-026), y repetir esa decisión aquí sería tenerla mal en uno de los dos
 * sitios.
 *
 * `cicloId` sirve para consultar un ciclo **cerrado** (D-025). Con él, el grupo
 * se lee una sola vez y de ese ciclo, en vez de suscribirse al de hoy: los
 * cierres del año pasado apuntan a alumnos que ya no están en la lista diaria, y
 * armar el reporte sobre el grupo actual lo dejaría vacío. Un ciclo cerrado no
 * cambia, así que no hay nada a lo que suscribirse.
 */
export function useReporteDeTrimestre(
  trimestreId: Id | null,
  cicloId: Id | null = null,
): {
  reporte: ReporteDeTrimestre | null
  cargando: boolean
} {
  const [emision, setEmision] = useState<Emision | null>(null)

  useEffect(() => {
    if (trimestreId === null) return

    let vivo = true
    let alumnos: Alumno[] | null = null
    let capturas: CapturasDelTrimestre | null | undefined
    let cierres: CierreTrimestre[] | null = null

    const emitir = () => {
      if (!vivo || alumnos === null || capturas === undefined || cierres === null) return
      setEmision({
        trimestreId,
        reporte: capturas === null ? null : armarReporte(capturas, cierres, alumnos),
      })
    }

    const subAlumnos =
      cicloId === null
        ? repos.alumnos.observarConBajas().subscribe((valor) => {
            alumnos = valor
            emitir()
          })
        : { unsubscribe: () => {} }

    if (cicloId !== null) {
      void repos.alumnos.deCicloConBajas(cicloId).then((valor) => {
        alumnos = valor
        emitir()
      })
    }
    const subCapturas = repos.evaluacion
      .observarCapturasDelTrimestre(trimestreId)
      .subscribe((valor) => {
        capturas = valor
        emitir()
      })
    const subCierres = repos.evaluacion
      .observarCierresDeTrimestre(trimestreId)
      .subscribe((valor) => {
        cierres = valor
        emitir()
      })

    return () => {
      vivo = false
      subAlumnos.unsubscribe()
      subCapturas.unsubscribe()
      subCierres.unsubscribe()
    }
  }, [trimestreId, cicloId])

  if (trimestreId === null) return { reporte: null, cargando: false }

  // Al cambiar de trimestre, la emisión anterior es de otro: mostrarla pintaría
  // las calificaciones del trimestre que se acaba de dejar.
  const alDia = emision?.trimestreId === trimestreId

  return {
    reporte: alDia ? emision.reporte : null,
    cargando: !alDia,
  }
}
