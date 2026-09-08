import { useState } from 'react'

import { Cabecera } from '@/ui/components/Cabecera'
import { IconoFaltas } from '@/ui/components/iconos'
import { ListaDeOpciones, type Opcion } from '@/ui/components/ListaDeOpciones'
import { FaltasDeLaSemana } from '@/ui/screens/FaltasDeLaSemana'

/**
 * Los reportes que se consultan, en un sitio pensado para crecer.
 *
 * Es una pantalla con un solo renglón hoy, y a propósito: el reporte de faltas no
 * será el único, y colgar el primero de un botón suelto en Grupo obliga a mover
 * todo el día que llegue el segundo.
 *
 * Vive en Grupo y no en Ajustes: Ajustes guarda lo que se hace una o dos veces al
 * año, y un reporte se consulta seguido. Y no vive en Asistencia, porque un botón
 * más en el camino diario hay que justificarlo contra los 15 segundos y este no
 * pasa esa prueba (docs/UX.md).
 *
 * **Esta pantalla enruta a sus reportes**, en vez de dejárselo a `Grupo` como hacen
 * las demás. No es un capricho de simetría: así la lista de reportes existe en un
 * solo sitio y se puede comprobar. `tests/arquitectura.test.ts` lee de aquí qué
 * pantallas son reportes y exige que cada una ofrezca guardarse en PDF
 * (docs/DECISIONES.md D-031) —la regla se cumple con una línea, así que lo caro no
 * es cumplirla sino acordarse, y de eso se acuerda la prueba—.
 *
 * Agregar un reporte son cuatro cosas: su pantalla, su `DocumentoPdf` en
 * `application/`, un renglón en `REPORTES` y su caso en el enrutado de abajo.
 */
type Cual = 'faltas-semana'

const REPORTES: { id: Cual; etiqueta: string; ayuda: string; Icono: Opcion['Icono'] }[] = [
  {
    id: 'faltas-semana',
    etiqueta: 'Faltas de la semana',
    ayuda: 'Cuántos niños y cuántas niñas faltaron cada día, y en toda la semana',
    Icono: IconoFaltas,
  },
]

export function Reportes({ alVolver }: { alVolver: () => void }) {
  const [cual, setCual] = useState<Cual | null>(null)

  if (cual === 'faltas-semana') {
    return <FaltasDeLaSemana alVolver={() => setCual(null)} />
  }

  return (
    <section aria-labelledby="titulo-reportes" className="flex flex-col gap-4">
      <Cabecera
        titulo="Reportes"
        id="titulo-reportes"
        alVolver={alVolver}
        etiquetaVolver="Volver a Grupo"
      />

      <ListaDeOpciones
        opciones={REPORTES.map((reporte) => ({
          etiqueta: reporte.etiqueta,
          ayuda: reporte.ayuda,
          Icono: reporte.Icono,
          alTocar: () => setCual(reporte.id),
        }))}
      />
    </section>
  )
}
