/**
 * Lo que se ve cuando todavía no hay nada.
 *
 * Un estado vacío es una invitación a actuar (docs/UX.md §5), y hasta ahora cada
 * uno era un párrafo gris suelto que describía una ruta —«se carga en Grupo →
 * Ajustes → Cargar lista de alumnos»— y dejaba a quien lo lee recorrerla a mano.
 *
 * Aquí la primera línea dice **qué falta**, la segunda **por qué** o dónde se
 * resuelve, y el botón lo resuelve cuando la pantalla puede llevar hasta ahí. Sin
 * ilustración ni caja: no es un error, es el principio.
 */
export function EstadoVacio({
  titulo,
  children,
  accion,
}: {
  titulo: string
  children?: React.ReactNode
  accion?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-start gap-3 py-2">
      <p className="text-base text-tinta">{titulo}</p>
      {children !== undefined && <p className="text-apoyo text-tinta-2">{children}</p>}
      {accion}
    </div>
  )
}
