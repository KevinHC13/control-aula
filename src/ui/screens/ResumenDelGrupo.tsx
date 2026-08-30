import { useMemo, useState } from 'react'

import { trimestreDe } from '@/application/evaluacion'
import { UMBRALES } from '@/application/resumen'
import { comoCalificacion } from '@/domain/calculo'
import { fechaLocal } from '@/domain/fechas'
import { FilaResumenAlumno } from '@/ui/components/FilaResumenAlumno'
import { useCicloEnCurso } from '@/ui/hooks/useCicloEnCurso'
import { useResumenDelGrupo } from '@/ui/hooks/useResumenDelGrupo'
import { plural } from '@/ui/lib/plural'
import { cn } from '@/ui/lib/utils'

/**
 * El resumen del grupo: cómo va el trimestre, de un vistazo.
 *
 * Dos cifras arriba —asistencia y promedio— y la lista debajo, con las mismas dos
 * por alumno. No hay gráficas ni tendencias: lo que ella necesita saber al abrir
 * esta pantalla es *a quién hay que mirar*, y eso es una columna de barras rojas y
 * un número (docs/UX.md).
 *
 * El promedio sale de `reporteDeTrimestre`, así que un trimestre cerrado muestra su
 * snapshot y uno abierto lo calculado, sin que esta pantalla tenga que saber cuál
 * es cuál.
 *
 * **El criterio de la marca va escrito.** Los umbrales son los del prototipo y no
 * están validados con ella (`[POR VALIDAR]`, docs/ESTADO.md): mientras eso siga
 * así, esconderlos volvería el color rojo una opinión sin firma.
 */
export function ResumenDelGrupo() {
  const { ciclo, cargando: cargandoCiclo } = useCicloEnCurso()
  const hoy = useMemo(() => fechaLocal(new Date()), [])

  const [elegido, setElegido] = useState<number | null>(null)
  const numeroActivo = elegido ?? trimestreDe(hoy, ciclo)?.numero ?? 1
  const trimestre = ciclo?.trimestres.find((t) => t.numero === numeroActivo) ?? null

  const { resumen, cargando } = useResumenDelGrupo(trimestre)

  if (cargandoCiclo) {
    return (
      <p className="text-base text-tinta-2" aria-live="polite">
        Cargando…
      </p>
    )
  }

  if (!ciclo) {
    return (
      <p className="text-base text-tinta-2">
        Todavía no hay ciclo escolar. El resumen es de un trimestre, y los trimestres se
        abren en Ajustes → Ciclo escolar.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Trimestre" className="flex gap-2">
        {ciclo.trimestres.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={t.numero === numeroActivo}
            onClick={() => setElegido(t.numero)}
            className={cn(
              'h-11 flex-1 rounded-md border px-3 text-base outline-none',
              'foco',
              t.numero === numeroActivo
                ? 'border-azul bg-azul text-papel'
                : 'border-linea text-tinta hover:bg-cuadro',
            )}
          >
            T{t.numero}
            {t.estado === 'cerrado' && (
              <span className="block text-apoyo opacity-80">cerrado</span>
            )}
          </button>
        ))}
      </nav>

      {/* Las dos cifras del grupo. Grandes y juntas: son las que se dicen en voz
          alta cuando alguien pregunta cómo va el salón. */}
      <div className="flex gap-8">
        <div>
          <p className="cifra text-4xl font-semibold text-tinta" aria-live="polite">
            {resumen?.asistencia === null || resumen === null
              ? '—'
              : `${Math.round(resumen.asistencia)}%`}
          </p>
          <p className="mt-1 text-apoyo text-tinta-2">
            asistencia
            {resumen && resumen.diasCapturados > 0 && (
              <>
                {' · '}
                <span className="cifra">{resumen.diasCapturados}</span>{' '}
                {plural(resumen.diasCapturados, 'día', 'días')}
              </>
            )}
          </p>
        </div>
        <div>
          <p className="cifra text-4xl font-semibold text-tinta" aria-live="polite">
            {comoCalificacion(resumen?.promedio ?? null)}
          </p>
          <p className="mt-1 text-apoyo text-tinta-2">
            promedio {cargando && '· cargando…'}
          </p>
        </div>
      </div>

      {resumen && resumen.enRiesgo > 0 && (
        <p className="text-base text-rojo" aria-live="polite">
          <span className="cifra">{resumen.enRiesgo}</span>{' '}
          {plural(resumen.enRiesgo, 'alumno', 'alumnos')} por mirar.
        </p>
      )}

      {resumen && resumen.filas.length > 0 && (
        <>
          {/* Los encabezados de las dos columnas, para que las cifras de la derecha
              no se tengan que adivinar. */}
          <div className="flex items-end gap-3 border-b border-linea pb-1 pr-3">
            <span aria-hidden className="w-[7px] shrink-0" />
            <span className="w-7 shrink-0" />
            <span className="min-w-0 flex-1 text-apoyo text-tinta-2">alumno</span>
            <span className="w-14 shrink-0 text-right text-apoyo text-tinta-2">asist.</span>
            <span className="w-12 shrink-0 text-right text-apoyo text-tinta-2">prom.</span>
          </div>

          <ul className="-mx-4">
            {resumen.filas.map((fila) => (
              <FilaResumenAlumno key={fila.alumno.id} fila={fila} />
            ))}
          </ul>
        </>
      )}

      {resumen?.filas.length === 0 && (
        <p className="text-base text-tinta-2">
          Todavía no hay alumnos. La lista se carga en Ajustes → Cargar lista de alumnos.
        </p>
      )}

      <p className="border-t border-linea pt-3 text-apoyo text-tinta-2">
        Se marca a quien baje de <span className="cifra">{UMBRALES.asistencia}%</span> de
        asistencia o de <span className="cifra">{UMBRALES.promedio}.0</span> de promedio.
        Son los umbrales de arranque y están por confirmar; un alumno sin días capturados
        no se marca. Los retardos y las faltas justificadas cuentan como asistencia.
      </p>
    </div>
  )
}
