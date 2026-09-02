import type { Sexo } from '@/domain/values'
import { cn } from '@/ui/lib/utils'

/**
 * H o M, y el tercer estado es no elegir ninguno.
 *
 * Dos botones y no un desplegable: son dos opciones y un `select` en iPadOS
 * abre una rueda que tapa media pantalla para elegir entre dos cosas. Tocar el
 * que ya está puesto lo quita, que es como se vuelve a «sin asignar» sin un
 * tercer botón que ocupe sitio y que casi nadie va a usar.
 *
 * Es **azul y no marca**: comunica un dato del alumno, no la identidad de la
 * app (docs/DECISIONES.md D-028). Y dice «Niño» y «Niña» donde hay sitio, que
 * es como habla la maestra, aunque por dentro se guarden las letras de la lista
 * oficial.
 */
const OPCIONES = [
  { valor: 'H', letra: 'H', palabra: 'Niño' },
  { valor: 'M', letra: 'M', palabra: 'Niña' },
] as const satisfies readonly { valor: Sexo; letra: string; palabra: string }[]

export function SelectorSexo({
  valor,
  alElegir,
  etiqueta,
  compacto = false,
}: {
  valor: string
  alElegir: (sexo: Sexo | '') => void
  /** A quién pertenece, para que el lector de pantalla no lea dos botones sueltos. */
  etiqueta: string
  /** Solo las letras, para la línea secundaria de la revisión. */
  compacto?: boolean
}) {
  return (
    <div role="group" aria-label={etiqueta} className="flex gap-1">
      {OPCIONES.map(({ valor: opcion, letra, palabra }) => {
        const puesto = valor === opcion

        return (
          <button
            key={opcion}
            type="button"
            aria-pressed={puesto}
            // El nombre accesible dice la palabra aunque el botón enseñe la
            // letra: «H» a solas no se entiende leído en voz alta.
            aria-label={palabra}
            onClick={() => alElegir(puesto ? '' : opcion)}
            className={cn(
              'flex min-h-11 items-center justify-center rounded-md border text-base foco',
              compacto ? 'min-w-11 px-2' : 'min-w-11 flex-1 px-3',
              puesto
                ? 'border-azul bg-azul/12 font-semibold text-azul'
                : 'border-linea text-tinta-2 hover:bg-cuadro',
            )}
          >
            {compacto ? letra : palabra}
          </button>
        )
      })}
    </div>
  )
}
