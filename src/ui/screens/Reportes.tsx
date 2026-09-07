import { Cabecera } from '@/ui/components/Cabecera'
import { IconoFaltas } from '@/ui/components/iconos'
import { ListaDeOpciones, type Opcion } from '@/ui/components/ListaDeOpciones'

/**
 * Los reportes que se consultan, en un sitio pensado para crecer.
 *
 * Es una pantalla con un solo renglón hoy, y a propósito: el reporte de faltas no
 * será el único, y colgar el primero de un botón suelto en Grupo obliga a mover
 * todo el día que llegue el segundo. Agregar uno es agregar un objeto al arreglo
 * de abajo, una vista en `Grupo.tsx` y su pantalla.
 *
 * Vive en Grupo y no en Ajustes: Ajustes guarda lo que se hace una o dos veces al
 * año, y un reporte se consulta seguido. Y no vive en Asistencia, porque un botón
 * más en el camino diario hay que justificarlo contra los 15 segundos y este no
 * pasa esa prueba (docs/UX.md).
 */
export function Reportes({
  alVolver,
  alVerFaltas,
}: {
  alVolver: () => void
  alVerFaltas: () => void
}) {
  const opciones: Opcion[] = [
    {
      etiqueta: 'Faltas de la semana',
      Icono: IconoFaltas,
      ayuda: 'Cuántos niños y cuántas niñas faltaron cada día, y en toda la semana',
      alTocar: alVerFaltas,
    },
  ]

  return (
    <section aria-labelledby="titulo-reportes" className="flex flex-col gap-4">
      <Cabecera
        titulo="Reportes"
        id="titulo-reportes"
        alVolver={alVolver}
        etiquetaVolver="Volver a Grupo"
      />

      <ListaDeOpciones opciones={opciones} />
    </section>
  )
}
