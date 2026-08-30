import type { Trimestre } from '@/domain/entities'
import { cn } from '@/ui/lib/utils'

/**
 * Las pastillas T1 · T2 · T3, con su marca de «cerrado».
 *
 * Estaban copiadas en cuatro pantallas —Calificaciones, Bitácora, el resumen del
 * grupo y Criterios y pesos— con el mismo marcado escrito cuatro veces.
 *
 * Ojo con dónde **no** aparece: en el camino diario no hay selector de trimestre y
 * no debe haberlo. La asistencia se atribuye por fecha y nunca a mano. Esto es para
 * las pantallas de consulta y configuración, donde elegir el trimestre que viene
 * mientras corre el actual sí es lo que hace falta.
 */
export function SelectorTrimestre({
  trimestres,
  activo,
  alElegir,
}: {
  trimestres: readonly Trimestre[]
  /** El número del trimestre a la vista, no su id: es lo que la pantalla recuerda. */
  activo: number
  alElegir: (numero: number) => void
}) {
  if (trimestres.length === 0) return null

  // Un ciclo con un solo trimestre es válido y normal —en agosto nadie sabe las
  // fechas de los otros dos (D-017)—, y entonces esto no es una elección. Una
  // pastilla sola, del ancho de la pantalla y en el color de la marca, se lee como
  // un botón que hace algo; escrito, se lee como lo que es: dónde se está.
  const unico = trimestres[0]
  if (trimestres.length === 1 && unico !== undefined) {
    return (
      <p className="text-base text-tinta-2">
        Trimestre {unico.numero}
        {unico.estado === 'cerrado' && ' · cerrado'}
      </p>
    )
  }

  return (
    <nav aria-label="Trimestre" className="flex gap-2">
      {trimestres.map((t) => {
        const elegido = t.numero === activo
        return (
          <button
            key={t.id}
            type="button"
            aria-current={elegido}
            onClick={() => alElegir(t.numero)}
            className={cn(
              'foco h-11 flex-1 rounded-md border px-3 text-base',
              elegido
                ? 'border-marca bg-marca text-papel'
                : 'border-linea text-tinta hover:bg-cuadro',
            )}
          >
            Trimestre {t.numero}
            {t.estado === 'cerrado' && (
              <span className="block text-apoyo opacity-80">cerrado</span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
