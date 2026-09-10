import { useMemo, useState } from 'react'

import { nombreDeArchivo } from '@/application/archivos'
import { asistenciasComoDocumento } from '@/application/asistencias'
import { fechaLocal, fechaMas, lunesDe } from '@/domain/fechas'
import { BotonGuardarPdf } from '@/ui/components/BotonGuardarPdf'
import { Cabecera } from '@/ui/components/Cabecera'
import { Cargando } from '@/ui/components/Cargando'
import { EstadoVacio } from '@/ui/components/EstadoVacio'
import { FilaAusente } from '@/ui/components/FilaAusente'
import { SelectorSemana } from '@/ui/components/SelectorSemana'
import { useAsistenciasDeLaSemana } from '@/ui/hooks/useAsistenciasDeLaSemana'
import { comoDiaConNombre, comoRango } from '@/ui/lib/fechas'
import { plural } from '@/ui/lib/plural'
import { frasePorSexo } from '@/ui/lib/porSexo'
import { useApariencia } from '@/ui/store/apariencia'

/**
 * Cuántos niños y cuántas niñas asistieron esta semana, y quién faltó.
 *
 * Es la cuenta que la hoja oficial pide al pie de cada día, sumada de toda la
 * semana. Una cifra grande arriba con su corte por sexo, y debajo el día a día
 * —que **suma exactamente** el total, así que la cuenta se verifica sin hacerla
 * (docs/UX.md)—.
 *
 * La cifra principal es la asistencia (docs/DECISIONES.md D-032), pero la falta se
 * dice **igual de completa** —partida por sexo, con su verbo por delante—, y cada
 * día **sigue diciendo quién faltó**: dos o tres nombres son el dato accionable de
 * la semana.
 *
 * La nota del pie escribe el criterio, como el resumen del grupo escribe sus
 * umbrales: un número cuya definición no se ve es un número en el que no se puede
 * confiar.
 */
const NOTA =
  'Cuenta a todo el que vino: los retardos y las faltas justificadas cuentan como ' +
  'asistencia. Quien vino dos días cuenta dos veces, así que los días suman el ' +
  'total de arriba. Los que asistieron y los que faltaron se dicen los dos por ' +
  'sexo, y quien todavía no lo tiene asignado se cuenta aparte. Debajo de cada día ' +
  'van los nombres de quienes faltaron, con su número de lista. Un día que todavía ' +
  'no se registra no aparece.'

/**
 * «Asistieron 2 niños · 1 niña», o nada cuando no hay a quién contar.
 *
 * El verbo va pegado a la frase y no suelto en la pantalla porque es lo que se
 * guarda en el PDF: el documento recibe los textos ya escritos.
 */
function frase(verbo: string, corte: Parameters<typeof frasePorSexo>[0]): string {
  const dicho = frasePorSexo(corte)
  return dicho === '' ? '' : `${verbo} ${dicho}`
}

export function AsistenciasDeLaSemana({ alVolver }: { alVolver: () => void }) {
  const hoy = useMemo(() => fechaLocal(new Date()), [])
  const [lunes, setLunes] = useState(() => lunesDe(hoy))
  const nombreDelGrupo = useApariencia((s) => s.nombreDelGrupo)

  const { reporte, cargando } = useAsistenciasDeLaSemana(lunes)
  const vinieron = reporte === null ? '' : frase('Asistieron', reporte.asistieron)
  const faltaron = reporte === null ? '' : frase('Faltaron', reporte.faltaron)

  // El documento se arma al tocar el botón, no en cada render: la pantalla se
  // mira mucho más de lo que se guarda.
  const documento = () =>
    asistenciasComoDocumento(reporte!, {
      periodo: comoRango(reporte!.desde, fechaMas(reporte!.desde, 4)),
      grupo: nombreDelGrupo,
      asistieron: vinieron,
      faltaron,
      dias: reporte!.dias.map((dia) => ({
        fecha: comoDiaConNombre(dia.fecha),
        asistieron: frase('Asistieron', dia.asistieron),
        faltaron: frase('Faltaron', dia.faltaron),
      })),
      nota: NOTA,
    })

  return (
    <section aria-labelledby="titulo-asistencias" className="flex flex-col gap-4">
      <Cabecera
        titulo="Asistencias de la semana"
        id="titulo-asistencias"
        alVolver={alVolver}
        etiquetaVolver="Volver a Reportes"
      />

      <SelectorSemana lunes={lunes} hoy={hoy} alElegir={setLunes} />

      {cargando && <Cargando />}

      {/* Sin un solo día capturado no se dice «0 asistencias»: no vino nadie y no
          se pasó lista no son lo mismo, y el cero diría lo primero. */}
      {reporte !== null && reporte.dias.length === 0 && (
        <EstadoVacio titulo="Esta semana todavía no se pasa lista.">
          Las asistencias se cuentan solas conforme se registra cada día en Asistencia.
        </EstadoVacio>
      )}

      {reporte !== null && reporte.dias.length > 0 && (
        <>
          <div>
            {/* Con denominador, como la cifra grande de Asistencia: «138» sola no
                se puede juzgar y «138 / 150» sí. */}
            <p className="cifra text-4xl font-semibold text-tinta" aria-live="polite">
              {reporte.asistencias} <span className="text-tinta-2">/ {reporte.posibles}</span>
            </p>
            <p className="mt-1 text-apoyo text-tinta-2">
              {plural(reporte.asistencias, 'asistencia', 'asistencias')} esta semana
            </p>
            {vinieron !== '' && (
              <p className="mt-0.5 text-base text-tinta" aria-live="polite">
                {vinieron}
              </p>
            )}
            {/* La falta no desaparece por dejar de ser la cifra principal, y se dice
                igual de completa: partida por sexo, con su verbo delante. Una cuenta
                desglosada junto a otra en bruto parece a la que le falta el dato. */}
            {faltaron !== '' && (
              <p className="text-base text-tinta" aria-live="polite">
                {faltaron}
              </p>
            )}
          </div>

          {/* Los encabezados, para que las cifras de la derecha no se adivinen. */}
          <div className="flex items-end gap-3 border-b border-linea pb-1">
            <span className="min-w-0 flex-1 text-apoyo text-tinta-2">día</span>
            <span className="w-12 shrink-0 text-right text-apoyo text-tinta-2">asisten</span>
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
                      {frase('Asistieron', dia.asistieron)}
                    </span>
                    {/* En su propio renglón y no detrás de un separador: las dos
                        frases llevan sexo, y en una sola línea se leen como una. */}
                    {dia.faltas > 0 && (
                      <span className="block text-apoyo text-tinta-2">
                        {frase('Faltaron', dia.faltaron)}
                      </span>
                    )}
                  </span>
                  {/* La cifra del día ya no es una alerta: cuenta a los que
                      vinieron. Y las dos frases de abajo van del mismo color: una
                      en rojo y la otra no diría que faltar es peor que venir, que
                      es cierto pero no es lo que este reporte viene a decir. */}
                  <span className="cifra w-12 shrink-0 text-right text-base text-tinta">
                    {dia.asistencias}
                  </span>
                </div>

                {/* Quiénes faltaron: la cifra dice que vinieron veintiocho y solo
                    los nombres dicen cuáles dos no. Sangrados, para que se lean
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
              nombre={nombreDeArchivo('pdf', 'asistencias', nombreDelGrupo, lunes)}
            />
          </div>
        </>
      )}

      <p className="border-t border-linea pt-3 text-apoyo text-tinta-2">{NOTA}</p>
    </section>
  )
}
