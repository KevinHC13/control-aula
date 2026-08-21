import { IconoAtras } from '@/ui/components/iconos'
import { Button } from '@/ui/components/ui/button'

/**
 * Lo que no cabe en el camino diario. Nació como lista con una sola opción justo
 * para que lo que llegara después —el ciclo, los criterios, las rúbricas, el
 * respaldo— entrara sin volver a discutir dónde ponerlo.
 *
 * No es "la pantalla de configuración" que docs/UX.md descartó: no hay nada que
 * ajustar para que la app funcione, solo cosas que se hacen una vez al año.
 */
export function Ajustes({
  alVolver,
  alCargarLista,
  alConfigurarCiclo,
  alConfigurarCriterios,
  alConfigurarRubricas,
  alRespaldar,
}: {
  alVolver: () => void
  alCargarLista: () => void
  alConfigurarCiclo: () => void
  alConfigurarCriterios: () => void
  alConfigurarRubricas: () => void
  alRespaldar: () => void
}) {
  return (
    <section aria-labelledby="titulo-ajustes" className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={alVolver} aria-label="Volver a Grupo">
          <IconoAtras className="size-6" />
        </Button>
        <h1 id="titulo-ajustes" className="text-2xl font-bold text-tinta">
          Ajustes
        </h1>
      </header>

      <ul className="divide-y divide-linea rounded-md border border-linea bg-papel">
        <li>
          <button
            type="button"
            onClick={alCargarLista}
            className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left"
          >
            <span className="text-base font-medium text-tinta">Cargar lista de alumnos</span>
            <span className="text-base text-tinta-2">
              Desde un PDF o una foto de la lista oficial
            </span>
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={alConfigurarCiclo}
            className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left"
          >
            <span className="text-base font-medium text-tinta">Ciclo escolar</span>
            <span className="text-base text-tinta-2">
              Las fechas de los tres trimestres
            </span>
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={alConfigurarCriterios}
            className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left"
          >
            <span className="text-base font-medium text-tinta">Criterios y pesos</span>
            <span className="text-base text-tinta-2">
              Con qué se evalúa cada trimestre y cuánto vale
            </span>
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={alConfigurarRubricas}
            className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left"
          >
            <span className="text-base font-medium text-tinta">Rúbricas</span>
            <span className="text-base text-tinta-2">
              Qué significa cada nivel al calificar un trabajo
            </span>
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={alRespaldar}
            className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left"
          >
            <span className="text-base font-medium text-tinta">Respaldo</span>
            <span className="text-base text-tinta-2">
              Guardar una copia de todo en un archivo, o restaurarla
            </span>
          </button>
        </li>
      </ul>
    </section>
  )
}
