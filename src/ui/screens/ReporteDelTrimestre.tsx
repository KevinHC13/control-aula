import { useMemo, useState } from 'react'

import type { CalificacionDeAlumno } from '@/application/calificaciones'
import { CAMPOS_CON_NOMBRE } from '@/application/evaluacion'
import { aportacionAlFinal, aportacionesQueSuman, comoCalificacion } from '@/domain/calculo'
import type { Trimestre } from '@/domain/entities'
import type { CampoFormativo } from '@/domain/values'
import { IconoAtras } from '@/ui/components/iconos'
import { Button } from '@/ui/components/ui/button'
import { useReporteDeTrimestre } from '@/ui/hooks/useReporteDeTrimestre'
import { cn } from '@/ui/lib/utils'

/**
 * Las calificaciones del trimestre: por grupo para transcribir la boleta, por
 * alumno para entender de dónde salió cada número.
 *
 * **El desglose no es un lujo.** Cuando un resultado no cuadre con su intuición —y
 * va a pasar— el desglose por criterio es lo único que dice si el error está en la
 * fórmula o en la expectativa. Sin él, el reporte que llega es «está mal» y no hay
 * dónde buscar.
 *
 * Todo en base 10 con un decimal, y `—` donde no hay dato: un criterio sin nada
 * capturado no es un cero. El porcentaje no aparece en ninguna parte —el único `%`
 * de la pantalla es el peso de un criterio, que es otra cosa—.
 *
 * Cuando el trimestre está a medias, la cifra viene normalizada sobre lo que sí se
 * ha calificado (D-019), así que **la pantalla lo dice**: sin ese aviso, un 10.0
 * sobre el 40% del trimestre se lee como un 10 de boleta.
 */
export function ReporteDelTrimestre({
  trimestre,
  alVolver,
  cicloId = null,
}: {
  trimestre: Trimestre
  alVolver: () => void
  /**
   * Solo para consultar un ciclo **cerrado**: el grupo se lee de ese ciclo y no
   * del de hoy. En el camino diario no se pasa, y esa es la diferencia entre
   * «las calificaciones» y «las calificaciones del año pasado».
   */
  cicloId?: string | null
}) {
  const { reporte, cargando } = useReporteDeTrimestre(trimestre.id, cicloId)
  const [vista, setVista] = useState<'campo' | 'criterio'>('campo')
  const [abierto, setAbierto] = useState<string | null>(null)

  // Memorizado para que la lista vacía no cambie de identidad en cada render y
  // recalcule las columnas sin que nada haya cambiado.
  const alumnos = useMemo(() => reporte?.alumnos ?? [], [reporte])
  const alumno = alumnos.find((a) => a.alumno.id === abierto)

  // Los campos que alguien evaluó, en el orden en que ella reporta. Un campo que
  // nadie tocó no merece una columna vacía.
  const campos = useMemo(() => {
    const conDatos = new Set(
      alumnos.flatMap((a) => Object.keys(a.porCampo) as CampoFormativo[]),
    )
    return CAMPOS_CON_NOMBRE.filter((c) => conDatos.has(c.campo))
  }, [alumnos])

  // Los criterios salen del primer alumno: todos traen los mismos, en el mismo
  // orden, porque el reporte los arma del esquema del trimestre.
  const criterios = alumnos[0]?.criterios ?? []
  const incompletos = alumnos.filter((a) => a.pesoConsiderado < 100).length

  return (
    <section aria-labelledby="titulo-reporte" className="flex flex-col gap-4">
      <header className="flex items-start gap-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => (alumno ? setAbierto(null) : alVolver())}
          aria-label={alumno ? 'Volver al grupo' : 'Volver'}
        >
          <IconoAtras className="size-6" />
        </Button>
        <div className="min-w-0 flex-1 pt-2">
          <h1 id="titulo-reporte" className="text-2xl font-bold text-tinta">
            Calificaciones
          </h1>
          <p className="text-apoyo text-tinta-2">
            Trimestre {trimestre.numero} ·{' '}
            {trimestre.estado === 'cerrado' ? 'cerrado' : 'en curso'}
          </p>
        </div>
      </header>

      {cargando ? (
        <p className="text-base text-tinta-2" aria-live="polite">
          Cargando…
        </p>
      ) : reporte === null ? (
        <p className="text-base text-tinta-2">Este trimestre ya no existe.</p>
      ) : (
        <>
          {/* De dónde salen los números. Con el trimestre cerrado no se
              recalculan, y no decirlo haría parecer que sí. */}
          <p
            className={cn(
              'rounded-md border-l-[7px] px-3 py-2 text-apoyo',
              reporte.delSnapshot
                ? 'border-azul bg-azul/5 text-tinta'
                : 'border-linea bg-cuadro text-tinta-2',
            )}
          >
            {reporte.delSnapshot
              ? 'Estas son las calificaciones que quedaron guardadas al cerrar el trimestre. No cambian aunque después se modifique un criterio o su valor.'
              : 'El trimestre está abierto: estas calificaciones se actualizan solas cada vez que se registra una evaluación.'}
          </p>

          {incompletos > 0 && (
            <p className="text-apoyo text-tinta-2">
              {incompletos === alumnos.length
                ? 'Todavía hay criterios sin calificar. Cada calificación se obtiene solamente de lo que ya está evaluado, no del trimestre completo.'
                : `${incompletos} de ${alumnos.length} alumnos tienen criterios sin capturar: su calificación sale solo de lo que ya se calificó.`}
            </p>
          )}

          {alumno ? (
            <DetalleDeAlumno alumno={alumno} />
          ) : (
            <>
              <nav aria-label="Desglose" className="flex gap-2">
                {(
                  [
                    { modo: 'campo' as const, etiqueta: 'Por campo formativo' },
                    { modo: 'criterio' as const, etiqueta: 'Por criterio' },
                  ] satisfies { modo: 'campo' | 'criterio'; etiqueta: string }[]
                ).map(({ modo, etiqueta }) => (
                  <button
                    key={modo}
                    type="button"
                    aria-current={vista === modo}
                    onClick={() => setVista(modo)}
                    className={cn(
                      'h-11 flex-1 rounded-md border px-3 text-base outline-none',
                      'foco',
                      vista === modo
                        ? 'border-azul bg-azul text-papel'
                        : 'border-linea text-tinta hover:bg-cuadro',
                    )}
                  >
                    {etiqueta}
                  </button>
                ))}
              </nav>

              {alumnos.length === 0 ? (
                <p className="text-base text-tinta-2">
                  Todavía no hay alumnos. La lista se carga desde Grupo → Ajustes.
                </p>
              ) : (
                <TablaDelGrupo
                  alumnos={alumnos}
                  columnas={
                    vista === 'campo'
                      ? campos.map((c) => ({
                          clave: c.campo,
                          corto: c.corto,
                          largo: c.nombre,
                          valor: (a: CalificacionDeAlumno) => a.porCampo[c.campo] ?? null,
                        }))
                      : criterios.map((c, i) => ({
                          clave: `${c.nombre}-${i}`,
                          corto: c.nombre,
                          largo: `${c.nombre}, ${c.peso}% del trimestre`,
                          peso: c.peso,
                          valor: (a: CalificacionDeAlumno) => a.criterios[i]?.general ?? null,
                        }))
                  }
                  alAbrir={setAbierto}
                />
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}

interface Columna {
  clave: string
  corto: string
  largo: string
  /** El porcentaje del trimestre, cuando la columna es un criterio. */
  peso?: number
  valor: (alumno: CalificacionDeAlumno) => number | null
}

/**
 * El grupo entero: una fila por alumno, una columna por campo o por criterio, y el
 * general al final.
 *
 * Es la vista para transcribir, así que la última columna es la que se copia y va
 * en negritas. La tabla scrollea dentro de su contenedor cuando no cabe, nunca la
 * página.
 */
function TablaDelGrupo({
  alumnos,
  columnas,
  alAbrir,
}: {
  alumnos: CalificacionDeAlumno[]
  columnas: Columna[]
  alAbrir: (alumnoId: string) => void
}) {
  return (
    <div className="-mx-4 overflow-x-auto">
      <table className="w-full border-collapse">
        <caption className="sr-only">
          Calificaciones del grupo. Seleccione un alumno para ver de dónde sale su
          calificación.
        </caption>
        <thead>
          <tr className="border-b border-linea">
            <th scope="col" className="px-2 pb-1 text-left text-apoyo font-medium text-tinta-2">
              Alumno
            </th>
            {columnas.map((c) => (
              <th
                key={c.clave}
                scope="col"
                className="px-2 pb-1 align-bottom text-right text-apoyo font-medium text-tinta-2"
              >
                <span className="block leading-tight">{c.corto}</span>
                {/* El peso, a la vista. Antes vivía en un `title=` —un tooltip— y en
                    iPad no hay hover: en el dispositivo de destino no existía, y sin
                    él la fila «10.0 · 0.0 · 2.0 → 4.6» no se puede entender. */}
                {c.peso !== undefined && (
                  <span className="cifra block font-normal text-tinta-2/70">{c.peso}%</span>
                )}
              </th>
            ))}
            <th scope="col" className="px-2 pb-1 text-right text-apoyo font-medium text-tinta">
              Final
            </th>
          </tr>
        </thead>
        <tbody>
          {alumnos.map((a) => (
            <tr key={a.alumno.id} className="border-b border-linea">
              <th scope="row" className="p-0 text-left font-normal">
                {/* El nombre es el objetivo táctil: lleva al desglose, que es
                    donde se contesta «¿por qué salió esto?». */}
                <button
                  type="button"
                  onClick={() => alAbrir(a.alumno.id)}
                  className={cn(
                    'flex min-h-14 w-full items-center gap-2 px-2 text-left',
                    'foco-dentro',
                    'active:bg-cuadro',
                  )}
                >
                  <span className="cifra shrink-0 text-base text-tinta-2">
                    {a.alumno.numero_lista}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-base text-tinta">
                    {a.alumno.nombre}
                  </span>
                </button>
              </th>
              {columnas.map((c) => {
                const valor = c.valor(a)
                return (
                  <td
                    key={c.clave}
                    className={cn(
                      'cifra px-2 text-right text-base',
                      // Tres estados que se veían casi iguales: sin calificar es un
                      // hueco y va tenue; el cero es un dato duro y va en rojo,
                      // porque es el que hunde el promedio y hay que verlo.
                      valor === null
                        ? 'text-tinta-2/50'
                        : valor === 0
                          ? 'text-rojo'
                          : 'text-tinta-2',
                    )}
                  >
                    {comoCalificacion(valor)}
                  </td>
                )
              })}
              <td className="cifra px-2 text-right text-base font-semibold text-tinta">
                {comoCalificacion(a.general)}
                {a.pesoConsiderado < 100 && a.general !== null && (
                  /* «sobre 70» se leía como la fracción 5.2/70, que no significa
                     nada. Lo que falta por evaluar sí se entiende solo, y es
                     además lo accionable. */
                  <span className="block text-apoyo font-normal text-ambar">
                    falta {100 - a.pesoConsiderado}%
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Un alumno con todo su desglose: el final, cada criterio con su peso y su reparto
 * por campo, y el trimestre por campo.
 *
 * Este es el que contesta «¿por qué salió esto?», y por eso muestra el peso de cada
 * criterio junto a su calificación: es la única forma de reconstruir la cuenta a
 * mano si hace falta.
 */
function DetalleDeAlumno({ alumno }: { alumno: CalificacionDeAlumno }) {
  const campos = CAMPOS_CON_NOMBRE.filter((c) => alumno.porCampo[c.campo] !== undefined)

  // Se calculan de una vez y para el conjunto: el ajuste de la última décima
  // depende de todas las aportaciones a la vez, así que no se puede decidir
  // criterio por criterio dentro del map.
  const aportaciones = aportacionesQueSuman(
    alumno.criterios.map((c) =>
      aportacionAlFinal(c.general, c.peso, alumno.pesoConsiderado),
    ),
    alumno.general,
  )

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xl font-semibold text-tinta">
          <span className="cifra font-normal text-tinta-2">{alumno.alumno.numero_lista}</span>{' '}
          {alumno.alumno.nombre}
        </p>
        <p className="cifra mt-1 text-4xl font-semibold text-tinta">
          {comoCalificacion(alumno.general)}
        </p>
        <p className="text-apoyo text-tinta-2">
          {alumno.general === null
            ? 'Este alumno todavía no tiene ninguna evaluación registrada'
            : alumno.pesoConsiderado < 100
              ? `Calculada solo con el ${alumno.pesoConsiderado}% del trimestre que ya está evaluado. Falta evaluar el ${100 - alumno.pesoConsiderado}% restante, así que esta calificación todavía puede cambiar.`
              : 'Del trimestre completo'}
        </p>
      </div>

      <section aria-labelledby="desglose-criterios" className="flex flex-col">
        <h2
          id="desglose-criterios"
          className="text-base font-medium text-tinta"
        >
          Por criterio
        </h2>
        {/* Los encabezados de las dos cifras: sin ellos, «10.0» y «4.0» en la misma
            fila parecen un error en vez de dos cosas distintas. */}
        {/* Las dos cifras están en escalas distintas y eso hay que decirlo: la
            primera es la calificación de ese criterio por sí solo, de 0 a 10; la
            segunda es lo que pone en el final, que depende de su porcentaje. Sin
            los encabezados, «3.3» y «0.7» en la misma fila parecen un error. */}
        <div className="flex items-end gap-2 border-b border-linea pb-1">
          <span className="min-w-0 flex-1 text-apoyo text-tinta-2">criterio</span>
          <span className="w-16 text-right text-apoyo leading-tight text-tinta-2">
            su nota
            <span className="block text-tinta-2/70">de 10</span>
          </span>
          <span className="w-16 text-right text-apoyo leading-tight text-tinta-2">
            aporta
            <span className="block text-tinta-2/70">al final</span>
          </span>
        </div>
        <ul>
          {alumno.criterios.length === 0 && (
            <li className="py-2 text-base text-tinta-2">
              Este trimestre no tiene criterios configurados.
            </li>
          )}
          {alumno.criterios.map((c, i) => (
            <li key={`${c.nombre}-${i}`} className="border-b border-linea py-2">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 text-base text-tinta">
                  {c.nombre}{' '}
                  <span className="cifra text-apoyo text-tinta-2">{c.peso}%</span>
                </span>
                <span
                  className={cn(
                    'cifra w-16 text-right text-base',
                    c.general === null ? 'text-tinta-2/50' : 'text-tinta-2',
                  )}
                >
                  {comoCalificacion(c.general)}
                </span>
                {/* Lo que este criterio pone en el final. La columna suma el final
                    exacto, así que la cuenta se puede verificar sin hacerla. */}
                <span
                  className={cn(
                    'cifra w-16 text-right text-base',
                    c.general === null ? 'text-tinta-2/50' : 'font-semibold text-tinta',
                  )}
                >
                  {comoCalificacion(aportaciones[i] ?? null)}
                </span>
              </div>
              {c.general === null ? (
                <p className="text-apoyo text-rojo">Sin calificar</p>
              ) : (
                <p className="text-apoyo text-tinta-2">
                  {CAMPOS_CON_NOMBRE.filter((campo) => c.porCampo[campo.campo] !== undefined)
                    .map(
                      (campo) =>
                        `${campo.corto} ${comoCalificacion(c.porCampo[campo.campo] ?? null)}`,
                    )
                    .join(' · ')}
                </p>
              )}
            </li>
          ))}
        </ul>

        {/* El renglón que cierra la cuenta: la columna de la derecha suma esto, y
            esto es el final de arriba. Sin decirlo, la relación entre las dos
            cifras hay que descubrirla sumando de cabeza. */}
        {alumno.criterios.length > 0 && alumno.general !== null && (
          <div className="flex items-baseline gap-2 pt-2">
            <span className="min-w-0 flex-1 text-apoyo text-tinta-2">
              La columna de la derecha suma la calificación final
            </span>
            <span className="w-16 shrink-0" />
            <span className="cifra w-16 shrink-0 text-right text-base font-semibold text-tinta">
              {comoCalificacion(alumno.general)}
            </span>
          </div>
        )}
      </section>

      {campos.length > 0 && (
        <section aria-labelledby="desglose-campos" className="flex flex-col">
          <h2
            id="desglose-campos"
            className="border-b border-linea pb-1 text-base font-medium text-tinta"
          >
            Por campo formativo
          </h2>
          <ul>
            {campos.map((c) => (
              <li
                key={c.campo}
                className="flex items-baseline gap-2 border-b border-linea py-2"
              >
                <span className="min-w-0 flex-1 text-base text-tinta">{c.nombre}</span>
                <span className="cifra text-base font-semibold text-tinta">
                  {comoCalificacion(alumno.porCampo[c.campo] ?? null)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
