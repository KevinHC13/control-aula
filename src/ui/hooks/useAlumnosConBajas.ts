import { useEffect, useState } from 'react'

import { repos } from '@/data'
import type { Alumno } from '@/domain/entities'

/**
 * El grupo del ciclo abierto **con los dados de baja**, reactivo.
 *
 * Solo lo usa la pantalla de administrar alumnos: las del camino diario leen
 * `observarLista()`, que no ve las bajas, y eso no debe cambiar. Aquí hacen
 * falta para poder deshacer una baja hecha por error.
 *
 * `cargando` se distingue de «no hay alumnos» a propósito, como en
 * `useCicloEnCurso`: los dos son una lista vacía, pero uno pide esperar y el
 * otro pide invitar a cargar la lista.
 */
export function useAlumnosConBajas(): { alumnos: Alumno[]; cargando: boolean } {
  const [alumnos, setAlumnos] = useState<Alumno[] | null>(null)

  useEffect(() => {
    const sub = repos.alumnos.observarConBajas().subscribe((valor) => {
      setAlumnos(valor)
    })
    return () => {
      sub.unsubscribe()
    }
  }, [])

  return { alumnos: alumnos ?? [], cargando: alumnos === null }
}
