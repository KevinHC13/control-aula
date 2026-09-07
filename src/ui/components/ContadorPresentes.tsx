import type { FilaAsistencia } from '@/application/asistencia'
import { contarFaltantesPorSexo, contarPresentes } from '@/application/asistencia'
import type { EstadoAsistencia } from '@/domain/values'
import { plural } from '@/ui/lib/plural'
import { frasePorSexo } from '@/ui/lib/porSexo'

const DESGLOSE: {
  estado: EstadoAsistencia
  singular: string
  plural: string
  color: string
}[] = [
  { estado: 'ausente', singular: 'ausente', plural: 'ausentes', color: 'text-rojo' },
  { estado: 'retardo', singular: 'retardo', plural: 'retardos', color: 'text-ambar' },
  { estado: 'justificada', singular: 'justificada', plural: 'justificadas', color: 'text-verde' },
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

  // La misma frase que dice el reporte de la semana, con las mismas reglas: las
  // partes en cero no se dicen y el que no tiene sexo se dice aparte.
  const porSexo = frasePorSexo(contarFaltantesPorSexo(filas))

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
      <p className="mt-1 text-apoyo text-tinta-2">
        {desglose.length === 0
          ? 'Todos presentes'
          : desglose.map((d, i) => (
              <span key={d.estado}>
                {i > 0 && ' · '}
                <span className={d.color}>
                  {d.cuantos} {plural(d.cuantos, d.singular, d.plural)}
                </span>
              </span>
            ))}
      </p>

      {/* Quién faltó, partido por sexo: es lo que la hoja oficial pide al pie de
          cada día. Solo cuando hay ausentes, igual que el desglose de arriba
          desaparece con «Todos presentes» —la pantalla de entrada es una cifra
          grande, no un tablero—. */}
      {porSexo !== '' && (
        <p className="mt-0.5 text-apoyo text-tinta-2" aria-live="polite">
          Faltaron {porSexo}
        </p>
      )}
    </div>
  )
}
