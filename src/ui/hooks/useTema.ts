import { useEffect, useState } from 'react'

import { escalaDe, fondoDe, marcaDe, tocaOscuro } from '@/ui/lib/tema'
import { useApariencia } from '@/ui/store/apariencia'

/**
 * Lleva la apariencia elegida al documento.
 *
 * Escribe `--color-marca` sobre `documentElement`, que es lo que hace que la
 * pantalla entera se repinte al instante: Tailwind compila `bg-marca` como
 * `var(--color-marca)`, así que reescribir la variable en caliente alcanza —no hay
 * que recompilar nada ni recargar—.
 *
 * El modo y el tamaño van como atributos (`data-tema`, `data-texto`) porque los
 * consume el CSS, no el JavaScript: la paleta oscura y la cuadrícula viven en
 * `index.css`, donde se pueden leer todas juntas.
 *
 * Se monta **una sola vez**, en `App.tsx`.
 */
export function useTema() {
  const apariencia = useApariencia()

  // Lo que dice el iPad, para el modo «según el iPad». En estado y no leído al
  // vuelo: cambiar el aspecto del sistema con la aplicación abierta tiene que
  // repintarla, y para eso hace falta que React se entere.
  const [prefiereOscuro, setPrefiereOscuro] = useState(
    () => globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  )

  useEffect(() => {
    const consulta = globalThis.matchMedia?.('(prefers-color-scheme: dark)')
    if (consulta === undefined) return

    const alCambiar = (e: MediaQueryListEvent) => setPrefiereOscuro(e.matches)
    consulta.addEventListener('change', alCambiar)
    return () => consulta.removeEventListener('change', alCambiar)
  }, [])

  const oscuro = tocaOscuro(apariencia, prefiereOscuro)
  // `marcaDe` es lo que hace seguro el color libre: si el elegido no contrasta con
  // el papel del modo en que se está, lo acerca al negro o al blanco lo justo,
  // conservando su tono.
  const marca = marcaDe(apariencia, oscuro)

  useEffect(() => {
    const raiz = document.documentElement

    raiz.style.setProperty('--color-marca', marca)
    // La escala del texto se aplica moviendo la raíz, y por eso todo lo táctil
    // está en `rem`: los objetivos de 44 px crecen con ella y nunca encogen.
    raiz.style.fontSize = escalaDe(apariencia)

    raiz.dataset.tema = oscuro ? 'oscuro' : 'claro'
    raiz.dataset.texto = apariencia.tamano
    raiz.dataset.papel = apariencia.papel
    raiz.dataset.lineas = apariencia.lineas

    // Sin esto, la barra de estado del iPad se queda con el azul del manifiesto y
    // pelea con el color elegido justo en el borde de la pantalla.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', oscuro ? fondoDe(apariencia, true) : marca)
  }, [marca, oscuro, apariencia])

  useEffect(() => {
    // Le dice al navegador de qué color pintar lo que no dibuja la aplicación: el
    // rebote del desplazamiento, los campos nativos, el selector de fecha.
    document.documentElement.style.colorScheme = oscuro ? 'dark' : 'light'
  }, [oscuro])

  useEffect(() => {
    const nombre = apariencia.nombreDelGrupo.trim()
    document.title = nombre === '' ? 'Palomita' : `Palomita · ${nombre}`
  }, [apariencia.nombreDelGrupo])
}
