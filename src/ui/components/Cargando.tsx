/**
 * «Cargando…», que estaba escrito literal en dieciséis sitios.
 *
 * Sin animación a propósito: lo que se espera es una lectura de IndexedDB, que
 * tarda milisegundos, y un giro que aparece y desaparece en un cuadro se lee como
 * un parpadeo. `aria-live` porque el cambio no mueve el foco a ningún lado.
 */
export function Cargando({ children = 'Cargando…' }: { children?: string }) {
  return (
    <p className="text-base text-tinta-2" aria-live="polite">
      {children}
    </p>
  )
}
