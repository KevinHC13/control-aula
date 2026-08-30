import { Cabecera } from '@/ui/components/Cabecera'
import {
  IconoAlumno,
  IconoApariencia,
  IconoArchivo,
  IconoBalanza,
  IconoCicloEscolar,
  IconoHistorial,
  IconoImportar,
  IconoNube,
  IconoRubrica,
  IconoSiguiente,
} from '@/ui/components/iconos'

/**
 * Lo que no cabe en el camino diario.
 *
 * No es «la pantalla de configuración» que docs/UX.md descartó: no hay nada que
 * ajustar para que la aplicación funcione, solo cosas que se hacen una vez al año
 * —o una vez y ya—.
 *
 * **Agrupado y no en una lista plana.** Eran ocho opciones seguidas que mezclaban
 * tres cosas distintas: quién está en el grupo, cómo se califica, y dónde está
 * guardada la información. Ocho renglones iguales obligan a leerlos todos para
 * encontrar uno; cuatro grupos de dos o tres se recorren de un vistazo, porque el
 * título del grupo ya descarta las tres cuartas partes que no son.
 *
 * El galón de la derecha no es adorno: dice que el renglón lleva a otra pantalla, y
 * era lo único que distinguía a estos botones de una lista de datos. El dibujo de la
 * izquierda tampoco: nueve renglones de texto son nueve cosas que hay que leer para
 * encontrar una, y el icono hace que la que se busca salte antes de leerla.
 */
interface Opcion {
  etiqueta: string
  ayuda: string
  Icono: (p: { className?: string }) => React.JSX.Element
  alTocar: () => void
}

export function Ajustes({
  alVolver,
  alCargarLista,
  alAdministrarAlumnos,
  alConfigurarCiclo,
  alConfigurarCriterios,
  alConfigurarRubricas,
  alConsultarAnteriores,
  alRespaldar,
  alSincronizar,
  alPersonalizar,
}: {
  alVolver: () => void
  alCargarLista: () => void
  alAdministrarAlumnos: () => void
  alConfigurarCiclo: () => void
  alConfigurarCriterios: () => void
  alConfigurarRubricas: () => void
  alConsultarAnteriores: () => void
  alRespaldar: () => void
  alSincronizar: () => void
  alPersonalizar: () => void
}) {
  const grupos: { titulo: string; opciones: Opcion[] }[] = [
    {
      titulo: 'El grupo',
      opciones: [
        {
          etiqueta: 'Cargar lista de alumnos',
          Icono: IconoImportar,
          ayuda: 'Se leen los nombres de un archivo de Excel, de un PDF o de una fotografía de la lista oficial',
          alTocar: alCargarLista,
        },
        {
          etiqueta: 'Alumnos',
          Icono: IconoAlumno,
          ayuda: 'Agregar a quien llegó después, corregir un nombre o dar de baja a quien se fue',
          alTocar: alAdministrarAlumnos,
        },
      ],
    },
    {
      titulo: 'La evaluación',
      opciones: [
        {
          etiqueta: 'Ciclo escolar',
          Icono: IconoCicloEscolar,
          ayuda: 'Las fechas de inicio y fin de cada trimestre',
          alTocar: alConfigurarCiclo,
        },
        {
          etiqueta: 'Criterios y pesos',
          Icono: IconoBalanza,
          ayuda: 'Qué se toma en cuenta para calificar y cuánto vale cada cosa',
          alTocar: alConfigurarCriterios,
        },
        {
          etiqueta: 'Rúbricas',
          Icono: IconoRubrica,
          ayuda: 'Los aspectos que se observan al revisar un trabajo y qué significa cada nivel',
          alTocar: alConfigurarRubricas,
        },
        {
          etiqueta: 'Ciclos anteriores',
          Icono: IconoHistorial,
          ayuda: 'Las calificaciones de los ciclos que ya terminaron, tal como se reportaron',
          alTocar: alConsultarAnteriores,
        },
      ],
    },
    {
      titulo: 'La información',
      opciones: [
        {
          etiqueta: 'Respaldo',
          Icono: IconoArchivo,
          ayuda: 'Guardar toda la información en un archivo, o recuperarla',
          alTocar: alRespaldar,
        },
        {
          etiqueta: 'Copia en la nube',
          Icono: IconoNube,
          ayuda: 'Respaldar la información en internet, o traerla a un iPad nuevo',
          alTocar: alSincronizar,
        },
      ],
    },
    {
      titulo: 'La aplicación',
      opciones: [
        {
          etiqueta: 'Apariencia',
          Icono: IconoApariencia,
          ayuda: 'El color, el papel, el modo claro u oscuro, el tamaño del texto y el nombre del grupo',
          alTocar: alPersonalizar,
        },
      ],
    },
  ]

  return (
    <section aria-labelledby="titulo-ajustes" className="flex flex-col gap-6">
      <Cabecera
        titulo="Ajustes"
        id="titulo-ajustes"
        alVolver={alVolver}
        etiquetaVolver="Volver a Grupo"
      />

      {grupos.map((grupo) => (
        <section
          key={grupo.titulo}
          aria-label={grupo.titulo}
          className="flex flex-col gap-2"
        >
          <h2 className="text-apoyo font-medium tracking-wide text-tinta-2 uppercase">
            {grupo.titulo}
          </h2>
          <ul className="divide-y divide-linea overflow-hidden rounded-md border border-linea">
            {grupo.opciones.map((opcion) => (
              <li key={opcion.etiqueta}>
                <button
                  type="button"
                  onClick={opcion.alTocar}
                  className="foco-dentro flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left active:bg-cuadro"
                >
                  <opcion.Icono className="size-6 shrink-0 text-tinta-2" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-base font-medium text-tinta">
                      {opcion.etiqueta}
                    </span>
                    <span className="text-apoyo text-tinta-2">{opcion.ayuda}</span>
                  </span>
                  {/* Dice que el renglón lleva a otro sitio. Sin él, estos botones se
                      leían igual que una lista de datos. */}
                  <IconoSiguiente className="size-5 shrink-0 text-tinta-2" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  )
}
