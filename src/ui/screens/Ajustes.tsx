import { IconoAtras } from '@/ui/components/iconos'
import { Button } from '@/ui/components/ui/button'

/**
 * Lo que no cabe en el camino diario. Nace con una sola opción, pero nace como
 * lista: aquí caben después el respaldo en JSON (C14) y la versión de la app,
 * sin volver a discutir dónde ponerlos.
 *
 * No es "la pantalla de configuración" que docs/UX.md descartó: no hay nada que
 * ajustar para que la app funcione, solo cosas que se hacen una vez al año.
 */
export function Ajustes({
  alVolver,
  alCargarLista,
  alConfigurarCiclo,
}: {
  alVolver: () => void
  alCargarLista: () => void
  alConfigurarCiclo: () => void
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
      </ul>
    </section>
  )
}
