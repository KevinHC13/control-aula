import { IconoAtras } from '@/ui/components/iconos'
import { Button } from '@/ui/components/ui/button'
import { cn } from '@/ui/lib/utils'

/**
 * La cabecera de una pantalla: volver, título y —si hace falta— una línea debajo
 * y una acción a la derecha.
 *
 * Estaba copiada doce veces, y dos pantallas —`CicloEscolar` y `Rubricas`— tenían
 * además su propio `Marco` local, que es este mismo componente escrito dos veces
 * con otro nombre. Doce copias es una manera lenta de que en tres semanas haya una
 * cabecera con el botón de volver de 36 px y nadie se acuerde de por qué.
 *
 * `alVolver` es opcional: las cuatro pestañas son la raíz y no vuelven a ningún
 * lado, pero sí quieren el mismo título que el resto.
 */
export function Cabecera({
  titulo,
  detalle,
  alVolver,
  etiquetaVolver = 'Volver',
  accion,
  pegajosa = false,
  id = 'titulo-pantalla',
}: {
  titulo: string
  /** La línea de contexto bajo el título: el trimestre, la fecha, el criterio. */
  detalle?: React.ReactNode
  alVolver?: () => void
  /** Adónde se vuelve, para quien no ve la flecha. */
  etiquetaVolver?: string
  /** Un botón a la derecha: Ajustes, Editar. */
  accion?: React.ReactNode
  /**
   * Se queda arriba al desplazar. Lo pide la revisión de la lista importada: con
   * treinta filas, un encabezado que se va con el desplazamiento deja de existir
   * justo cuando hace falta saber de qué pantalla se trata.
   */
  pegajosa?: boolean
  id?: string
}) {
  return (
    <header
      className={cn(
        'flex items-start gap-1',
        // -mx-4 y px-4 para que la banda tape el ancho completo al pegarse: sin
        // eso las filas se ven pasar por los lados.
        pegajosa && 'sticky top-0 z-10 -mx-4 border-b border-linea bg-papel px-4 pb-2',
      )}
    >
      {alVolver && (
        <Button size="icon" variant="ghost" onClick={alVolver} aria-label={etiquetaVolver}>
          <IconoAtras className="size-6" />
        </Button>
      )}

      {/* `pt-2` alinea el título con el centro del botón de 44 px cuando lo hay;
          sin botón la cabecera empieza pegada al borde, como cualquier otro
          encabezado. */}
      <div className={alVolver ? 'min-w-0 flex-1 pt-2' : 'min-w-0 flex-1'}>
        <h1 id={id} className="truncate text-2xl font-bold text-tinta">
          {titulo}
        </h1>
        {detalle !== undefined && <p className="text-apoyo text-tinta-2">{detalle}</p>}
      </div>

      {accion !== undefined && <div className="shrink-0">{accion}</div>}
    </header>
  )
}
