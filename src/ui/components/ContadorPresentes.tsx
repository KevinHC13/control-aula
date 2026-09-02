import type { FilaAsistencia } from '@/application/asistencia'
import { contarFaltantesPorSexo, contarPresentes } from '@/application/asistencia'
import type { EstadoAsistencia } from '@/domain/values'
import { plural } from '@/ui/lib/plural'

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

  const { ninos, ninas, sinAsignar } = contarFaltantesPorSexo(filas)
  // Las tres partes de la línea de abajo, ya en palabras. Se arma como lista y
  // se une con « · » para no acabar con un separador suelto cuando falta una:
  // «1 niño · » es peor que no enseñar la línea.
  const porSexo = [
    ninos > 0 && `${ninos} ${plural(ninos, 'niño', 'niños')}`,
    ninas > 0 && `${ninas} ${plural(ninas, 'niña', 'niñas')}`,
    // Un ausente sin sexo se dice, no se reparte: es lo que hace visible que
    // falta un dato en vez de dar una cifra que suma bien y miente.
    sinAsignar > 0 && `${sinAsignar} sin asignar`,
  ].filter((parte): parte is string => parte !== false)

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
                  {d.cuantos} {d.etiqueta}
                </span>
              </span>
            ))}
      </p>

      {/* Quién faltó, partido por sexo: es lo que la hoja oficial pide al pie de
          cada día. Solo cuando hay ausentes, igual que el desglose de arriba
          desaparece con «Todos presentes» —la pantalla de entrada es una cifra
          grande, no un tablero—. */}
      {porSexo.length > 0 && (
        <p className="mt-0.5 text-apoyo text-tinta-2" aria-live="polite">
          Faltaron {porSexo.join(' · ')}
        </p>
      )}
    </div>
  )
}
