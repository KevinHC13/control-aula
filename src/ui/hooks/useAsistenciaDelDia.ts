import { useEffect, useState } from 'react'

import { type FilaAsistencia, filasDelDia } from '@/application/asistencia'
import { repos } from '@/data'
import type { Alumno, RegistroAsistencia } from '@/domain/entities'
import type { Fecha } from '@/domain/values'

interface Emision {
  fecha: Fecha
  filas: FilaAsistencia[]
}

/**
 * El día, reactivo. Único lugar donde React se asoma al mundo de las
 * suscripciones: el componente escribe `useAsistenciaDelDia(dia)` y no sabe qué
 * hay debajo (docs/ARCHITECTURE.md).
 *
 * `cargando` se **deriva** de si lo último que llegó corresponde a la fecha que
 * se está pidiendo, en vez de guardarse en su propio estado. Así distingue
 * "todavía no llegó la primera emisión" de "el grupo está vacío" —sin esa
 * distinción la pantalla parpadea un vacío falso al cambiar de día— y no hace
 * falta un `setState` síncrono dentro del efecto.
 */
export function useAsistenciaDelDia(fecha: Fecha): {
  filas: FilaAsistencia[]
  cargando: boolean
} {
  const [emision, setEmision] = useState<Emision | null>(null)

  useEffect(() => {
    let vivo = true
    // Dos suscripciones y no una consulta combinada: el grupo cambia una vez al
    // año y el día cambia con cada toque. Que cada uno emita por su cuenta evita
    // releer los 30 alumnos en cada captura.
    let alumnos: Alumno[] | null = null
    let registros: RegistroAsistencia[] | null = null

    const emitir = () => {
      if (!vivo || alumnos === null || registros === null) return
      setEmision({ fecha, filas: filasDelDia(alumnos, registros) })
    }

    const subAlumnos = repos.alumnos.observarLista().subscribe((valor) => {
      alumnos = valor
      emitir()
    })
    const subRegistros = repos.asistencia.observarDia(fecha).subscribe((valor) => {
      registros = valor
      emitir()
    })

    return () => {
      vivo = false
      subAlumnos.unsubscribe()
      subRegistros.unsubscribe()
    }
  }, [fecha])

  const alDia = emision?.fecha === fecha

  return {
    filas: alDia ? emision.filas : [],
    cargando: !alDia,
  }
}
