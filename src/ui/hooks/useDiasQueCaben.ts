import { type RefObject, useLayoutEffect, useRef, useState } from 'react'

import { cuantosDiasCaben, DIAS_DE_RESPALDO } from '@/ui/lib/tira'

/**
 * Cuántos días caben en el contenedor al que se le pone el `ref`. La tira los usa
 * para llenar el ancho: en un iPad horizontal caben muchos más que en un iPhone,
 * y fijarlos en siete desperdiciaba media pantalla.
 *
 * Mide con `useLayoutEffect`, antes del primer pintado, para que no haya un salto
 * visible al montar. El `ResizeObserver` cubre el giro del iPad, que no dispara
 * `resize` de forma confiable en Safari.
 */
export function useDiasQueCaben<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [cuantos, setCuantos] = useState(DIAS_DE_RESPALDO)

  useLayoutEffect(() => {
    const elemento = ref.current
    if (!elemento) return

    const medir = () => setCuantos(cuantosDiasCaben(elemento.clientWidth))
    medir()

    const observador = new ResizeObserver(medir)
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [])

  return [ref, cuantos]
}
