import type { DiaDelMes } from '@/application/asistencia'
import { comoDate, huecosIniciales, mesDe, mesMas } from '@/domain/fechas'
import type { Fecha, Mes } from '@/domain/values'
import { cn } from '@/ui/lib/utils'

const INICIALES = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const nombreDelMes = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' })
const diaLargo = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long' })

/**
 * El mes como mosaico. Componente propio y no un `Calendar` de librería: lo que
 * se pinta no es una fecha por escoger, es el estatus de cada día del salón, y
 * eso es identidad del producto (docs/DECISIONES.md D-010).
 *
 * Un día sin registrar se ve hueco, uno capturado sin faltas azul, y uno con
 * faltas rojo con la cifra. La distinción entre hueco y azul es la que importa:
 * pintar igual "todavía no lo capturé" y "ese día no faltó nadie" sería mentir.
 */
export function CalendarioMes({
  mesVisible,
  dias,
  diaSeleccionado,
  hoy,
  alCambiarMes,
  alSeleccionar,
}: {
  mesVisible: Mes
  dias: DiaDelMes[]
  diaSeleccionado: Fecha
  hoy: Fecha
  alCambiarMes: (mes: Mes) => void
  alSeleccionar: (fecha: Fecha) => void
}) {
  const enElMesDeHoy = mesVisible === mesDe(hoy)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <FlechaMes etiqueta="Mes anterior" alTocar={() => alCambiarMes(mesMas(mesVisible, -1))}>
          ‹
        </FlechaMes>

        {/* aria-live: al cambiar de mes con las flechas, el lector anuncia a
            dónde llegó sin que haya que buscar el encabezado. */}
        <span aria-live="polite" className="text-base font-semibold text-tinta first-letter:uppercase">
          {nombreDelMes.format(comoDate(`${mesVisible}-01`))}
        </span>

        <FlechaMes
          etiqueta="Mes siguiente"
          deshabilitada={enElMesDeHoy}
          alTocar={() => alCambiarMes(mesMas(mesVisible, 1))}
        >
          ›
        </FlechaMes>
      </div>

      <div aria-hidden className="grid grid-cols-7 gap-1 text-center text-base text-tinta-2">
        {INICIALES.map((inicial, i) => (
          <span key={i}>{inicial}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: huecosIniciales(mesVisible) }, (_, i) => (
          <span key={`hueco-${i}`} />
        ))}

        {dias.map((dia) => (
          <Mosaico
            key={dia.fecha}
            dia={dia}
            seleccionado={dia.fecha === diaSeleccionado}
            futuro={dia.fecha > hoy}
            alTocar={() => alSeleccionar(dia.fecha)}
          />
        ))}
      </div>
    </div>
  )
}

function FlechaMes({
  etiqueta,
  deshabilitada = false,
  alTocar,
  children,
}: {
  etiqueta: string
  deshabilitada?: boolean
  alTocar: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={alTocar}
      disabled={deshabilitada}
      aria-label={etiqueta}
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-lg border border-linea',
        'text-2xl leading-none text-tinta-2',
        'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'disabled:opacity-40',
      )}
    >
      <span aria-hidden>{children}</span>
    </button>
  )
}

function Mosaico({
  dia,
  seleccionado,
  futuro,
  alTocar,
}: {
  dia: DiaDelMes
  seleccionado: boolean
  futuro: boolean
  alTocar: () => void
}) {
  const conFaltas = dia.ausentes > 0

  return (
    <button
      type="button"
      onClick={alTocar}
      disabled={futuro}
      aria-current={seleccionado ? 'date' : undefined}
      // El color no habla: la etiqueta dice el día y su estatus completo.
      aria-label={`${diaLargo.format(comoDate(dia.fecha))}, ${estatus(dia)}`}
      className={cn(
        'flex aspect-square min-h-11 flex-col items-center justify-center rounded-lg border',
        'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        !dia.registrado && 'border-linea bg-cuadro text-tinta-2/60',
        dia.registrado && !conFaltas && 'border-azul bg-azul text-papel',
        dia.registrado && conFaltas && 'border-rojo bg-rojo text-papel',
        seleccionado && 'ring-2 ring-tinta ring-offset-2 ring-offset-papel',
        futuro && 'opacity-40',
      )}
    >
      <span aria-hidden className="cifra text-base leading-none font-semibold">
        {dia.fecha.slice(-2)}
      </span>
      {conFaltas && (
        <span aria-hidden className="cifra mt-0.5 text-base leading-none">
          −{dia.ausentes}
        </span>
      )}
    </button>
  )
}

function estatus(dia: DiaDelMes): string {
  if (!dia.registrado) return 'sin registrar'
  if (dia.ausentes === 0) return 'todos presentes'
  return dia.ausentes === 1 ? '1 ausente' : `${dia.ausentes} ausentes`
}
