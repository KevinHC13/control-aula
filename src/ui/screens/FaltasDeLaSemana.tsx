import { useMemo, useState } from 'react'

import { nombreDeArchivo } from '@/application/archivos'
import { faltasComoDocumento } from '@/application/faltas'
import { fechaLocal, fechaMas, lunesDe } from '@/domain/fechas'
import { BotonGuardarPdf } from '@/ui/components/BotonGuardarPdf'
import { Cabecera } from '@/ui/components/Cabecera'
import { Cargando } from '@/ui/components/Cargando'
import { EstadoVacio } from '@/ui/components/EstadoVacio'
import { FilaAusente } from '@/ui/components/FilaAusente'
import { SelectorSemana } from '@/ui/components/SelectorSemana'
import { useFaltasDeLaSemana } from '@/ui/hooks/useFaltasDeLaSemana'
import { comoDiaConNombre, comoRango } from '@/ui/lib/fechas'
import { plural } from '@/ui/lib/plural'
import { frasePorSexo } from '@/ui/lib/porSexo'
import { cn } from '@/ui/lib/utils'
import { useApariencia } from '@/ui/store/apariencia'

/**
 * Cuántas faltas hubo esta semana, y de quiénes.
 *
 * Es la cuenta que la hoja oficial pide al pie de cada día, sumada de toda la
 * semana. Una cifra grande arriba con su corte por sexo, y debajo el día a día
 * —que **suma exactamente** el total, así que la cuenta se verifica sin hacerla
 * (docs/UX.md)—.
 *
 * La nota del pie escribe el criterio, como el resumen del grupo escribe sus
 * umbrales: un número cuya definición no se ve es un número en el que no se puede
 * confiar.
 */
const NOTA =
  'Solo cuenta quien no vino: los retardos y las faltas justificadas cuentan como ' +
  'asistencia. Debajo de cada día van los nombres de quienes faltaron, con su ' +
  'número de lista. Quien faltó dos días cuenta dos veces, así que los días suman ' +
  'el total de arriba. Un día que todavía no se registra no aparece.'

export function FaltasDeLaSemana({ alVolver }: { alVolver: () => void }) {
  const hoy = useMemo(() => fechaLocal(new Date()), [])
  const [lunes, setLunes] = useState(() => lunesDe(hoy))
  const nombreDelGrupo = useApariencia((s) => s.nombreDelGrupo)

  const { reporte, cargando } = useFaltasDeLaSemana(lunes)
  const porSexo = reporte === null ? '' : frasePorSexo(reporte)

  // El documento se arma al tocar el botón, no en cada render: la pantalla se
  // mira mucho más de lo que se guarda.
  const documento = () =>
    faltasComoDocumento(reporte!, {
      periodo: comoRango(reporte!.desde, fechaMas(reporte!.desde, 4)),
      grupo: nombreDelGrupo,
      porSexo,
      dias: reporte!.dias.map((dia) => ({
        fecha: comoDiaConNombre(dia.fecha),
        porSexo: dia.faltas > 0 ? frasePorSexo(dia) : '',
      })),
      nota: NOTA,
    })

  return (
    <section aria-labelledby="titulo-faltas" className="flex flex-col gap-4">
      <Cabecera
        titulo="Faltas de la semana"
        id="titulo-faltas"
        alVolver={alVolver}
        etiquetaVolver="Volver a Reportes"
      />

      <SelectorSemana lunes={lunes} hoy={hoy} alElegir={setLunes} />

      {cargando && <Cargando />}

      {/* Sin un solo día capturado no se dice «0 faltas»: nadie faltó y no se
          pasó lista no son lo mismo, y el cero diría lo primero. */}
      {reporte !== null && reporte.dias.length === 0 && (
        <EstadoVacio titulo="Esta semana todavía no se pasa lista.">
          Las faltas se cuentan solas conforme se registra cada día en Asistencia.
        </EstadoVacio>
      )}

      {reporte !== null && reporte.dias.length > 0 && (
        <>
          <div>
            <p className="cifra text-4xl font-semibold text-tinta" aria-live="polite">
              {reporte.faltas}
            </p>
            <p className="mt-1 text-apoyo text-tinta-2">
              {plural(reporte.faltas, 'falta', 'faltas')} esta semana
            </p>
            {porSexo !== '' && (
              <p className="mt-0.5 text-base text-tinta" aria-live="polite">
                {porSexo}
              </p>
            )}
          </div>

          {/* Los encabezados, para que las cifras de la derecha no se adivinen. */}
          <div className="flex items-end gap-3 border-b border-linea pb-1">
            <span className="min-w-0 flex-1 text-apoyo text-tinta-2">día</span>
            <span className="w-12 shrink-0 text-right text-apoyo text-tinta-2">faltas</span>
          </div>

          {/* Dos listas anidadas de verdad, y no párrafos dentro de párrafos: los
              días son una lista y los alumnos de cada día son otra. Así se lee
              también con un lector de pantalla, que antes oía un solo bloque. */}
          <ul className="flex flex-col">
            {reporte.dias.map((dia) => (
              <li key={dia.fecha} className="border-b border-linea py-3 last:border-b-0">
                <div className="flex items-baseline gap-3">
                  <span className="min-w-0 flex-1">
                    {/* El día manda sobre sus alumnos: sin peso, el bloque entero
                        se leía como una sola masa de texto. */}
                    <span className="block text-base font-medium text-tinta">
                      {comoDiaConNombre(dia.fecha)}
                    </span>
                    <span className="block text-apoyo text-tinta-2">
                      {/* Un día bueno lo dice, en vez de dejar el renglón a medias:
                          el cero de la derecha se entiende, pero se lee después. */}
                      {dia.faltas > 0 ? frasePorSexo(dia) : 'Nadie faltó'}
                    </span>
                  </span>
                  {/* Un día sin faltas no se pinta en rojo: es un día bueno, y
                      darle el color de la alerta enseña a ignorar el color. */}
                  <span
                    className={cn(
                      'cifra w-12 shrink-0 text-right text-base',
                      dia.faltas > 0 ? 'text-rojo' : 'text-tinta-2',
                    )}
                  >
                    {dia.faltas}
                  </span>
                </div>

                {/* Quiénes faltaron: una cifra dice que faltaron tres y solo los
                    nombres dejan comprobar cuáles tres. Sangrados, para que se lean
                    como parte del día y no como días nuevos. */}
                {dia.ausentes.length > 0 && (
                  <ul className="mt-2 ml-3">
                    {dia.ausentes.map((alumno) => (
                      <FilaAusente key={alumno.id} alumno={alumno} />
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          {/* Todo reporte se puede guardar en PDF (docs/DECISIONES.md D-031).
              Va al pie y no en la cabecera: primero se elige la semana y se mira
              lo que dice, y solo entonces se guarda. La línea de arriba lo separa
              de la lista: es una acción sobre todo lo anterior, no un renglón más. */}
          <div className="border-t border-linea pt-4">
            <BotonGuardarPdf
              documento={documento}
              nombre={nombreDeArchivo('pdf', 'faltas', nombreDelGrupo, lunes)}
            />
          </div>
        </>
      )}

      <p className="border-t border-linea pt-3 text-apoyo text-tinta-2">{NOTA}</p>
    </section>
  )
}
