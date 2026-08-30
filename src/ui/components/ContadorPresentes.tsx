import type { FilaAsistencia } from '@/application/asistencia'
import { contarPresentes } from '@/application/asistencia'
import type { EstadoAsistencia } from '@/domain/values'

const DESGLOSE: { estado: EstadoAsistencia; etiqueta: string; color: string }[] = [
  { estado: 'ausente', etiqueta: 'ausentes', color: 'text-rojo' },
  { estado: 'retardo', etiqueta: 'retardos', color: 'text-ambar' },
  { estado: 'justificada', etiqueta: 'justificadas', color: 'text-verde' },
]

/**
 * Una sola cifra grande, no un tablero. Es lo único que hace falta ver de un
 * vistazo; el desglose va debajo y en chico. Sin gráficas ni tendencias
 * (docs/UX.md).
 */
export function ContadorPresentes({ filas }: { filas: FilaAsistencia[] }) {
  const { presentes, total } = contarPresentes(filas)

  // Sin lista cargada no se pinta nada. «0 / 0 · Todos presentes» afirma que todos
  // vinieron cuando no hay a quién contar, y una cifra que miente en la pantalla de
  // entrada es peor que un hueco.
  if (total === 0) return null

  const desglose = DESGLOSE.map((d) => ({
    ...d,
    cuantos: filas.filter((f) => f.estado === d.estado).length,
  })).filter((d) => d.cuantos > 0)

  return (
    <div>
      {/* aria-live: al ciclar un estado el número cambia sin que nada reciba el
          foco, así que hay que anunciarlo. */}
      <p className="cifra text-4xl font-semibold text-tinta" aria-live="polite">
        {presentes} <span className="text-tinta-2">/ {total}</span>
      </p>
      <p className="mt-1 text-[13px] text-tinta-2">
        {desglose.length === 0
          ? 'Todos presentes'
          : desglose.map((d, i) => (
              <span key={d.estado}>
                {i > 0 && ' · '}
                <span className={d.color}>
                  {d.cuantos} {d.etiqueta}
                </span>
              </span>
            ))}
      </p>
    </div>
  )
}
