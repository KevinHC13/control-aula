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
  alConsultarAnteriores,
  alRespaldar,
  alSincronizar,
}: {
  alVolver: () => void
  alCargarLista: () => void
  alConfigurarCiclo: () => void
  alConfigurarCriterios: () => void
  alConfigurarRubricas: () => void
  alConsultarAnteriores: () => void
  alRespaldar: () => void
  alSincronizar: () => void
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
              Se leen los nombres de un PDF o de una fotografía de la lista oficial
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
              Las fechas de inicio y fin de cada trimestre
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
              Qué se toma en cuenta para calificar y cuánto vale cada cosa
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
              Los aspectos que se observan al revisar un trabajo y qué significa cada
              nivel
            </span>
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={alConsultarAnteriores}
            className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left"
          >
            <span className="text-base font-medium text-tinta">Ciclos anteriores</span>
            <span className="text-base text-tinta-2">
              Las calificaciones de los ciclos que ya terminaron, tal como se reportaron
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
              Guardar toda la información en un archivo, o recuperarla
            </span>
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={alSincronizar}
            className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left"
          >
            <span className="text-base font-medium text-tinta">Copia en la nube</span>
            <span className="text-base text-tinta-2">
              Respaldar la información en internet, o traerla a un iPad nuevo
            </span>
          </button>
        </li>
      </ul>
    </section>
  )
}
