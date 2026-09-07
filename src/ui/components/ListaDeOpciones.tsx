import { IconoSiguiente } from '@/ui/components/iconos'

/**
 * Una lista de renglones que llevan a otra pantalla.
 *
 * Sale de `Ajustes`, que fue la primera en necesitarla, y vive aquí desde que
 * hubo una segunda —`Reportes`—: la auditoría de interfaz ya pagó el precio de la
 * cabecera copiada doce veces, y esta lista tiene tres detalles que se pierden al
 * copiarla (docs/UX.md).
 *
 * Los tres, por si alguien se pregunta si sobran:
 *
 * - **El galón de la derecha** dice que el renglón lleva a otro sitio, y era lo
 *   único que distinguía estos botones de una lista de datos.
 * - **El dibujo de la izquierda** hace que el renglón que se busca salte antes de
 *   leerlo; sin él son nueve líneas de texto que hay que leer enteras.
 * - **`min-h-14`** es el objetivo táctil, que aquí manda sobre el contenido.
 *
 * No sabe de grupos con título: quien los quiera pone varias listas, que es lo
 * que hace `Ajustes`.
 */
export interface Opcion {
  etiqueta: string
  ayuda: string
  Icono: (p: { className?: string }) => React.JSX.Element
  alTocar: () => void
}

export function ListaDeOpciones({ opciones }: { opciones: Opcion[] }) {
  return (
    <ul className="divide-y divide-linea overflow-hidden rounded-md border border-linea">
      {opciones.map((opcion) => (
        <li key={opcion.etiqueta}>
          <button
            type="button"
            onClick={opcion.alTocar}
            className="foco-dentro flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left active:bg-cuadro"
          >
            <opcion.Icono className="size-6 shrink-0 text-tinta-2" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-base font-medium text-tinta">{opcion.etiqueta}</span>
              <span className="text-apoyo text-tinta-2">{opcion.ayuda}</span>
            </span>
            <IconoSiguiente className="size-5 shrink-0 text-tinta-2" />
          </button>
        </li>
      ))}
    </ul>
  )
}
