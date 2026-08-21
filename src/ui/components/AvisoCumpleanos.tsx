import { type Cumpleanos, cumpleanosDeHoy, cumpleanosProximos } from '@/application/cumpleanos'
import type { Alumno } from '@/domain/entities'
import { comoDate } from '@/domain/fechas'
import type { Fecha } from '@/domain/values'

/** Solo el nombre de pila: la lista guarda "Apellidos, Nombres". */
function nombreDePila(alumno: Alumno): string {
  const [, nombres] = alumno.nombre.split(',')
  return (nombres ?? alumno.nombre).trim()
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** «el jueves», que es como se dice, en vez de «en 3 días». */
function cuandoCae(fecha: Fecha, faltan: number): string {
  if (faltan === 0) return 'hoy'
  if (faltan === 1) return 'mañana'
  return `el ${DIAS[comoDate(fecha).getDay()]}`
}

/**
 * El aviso de cumpleaños, en la pantalla de asistencia.
 *
 * **No es un modal**, y eso no es un detalle de estilo: el camino diario tiene un
 * presupuesto de 15 segundos y un diálogo que hay que cerrar para pasar lista se
 * lleva un toque de ese presupuesto todos los días de la semana del cumpleaños. Va
 * en el flujo, se lee de paso y no pide nada.
 *
 * **Sin cumpleaños en la ventana no se pinta nada** —ni un espacio en blanco ni un
 * «no hay cumpleaños esta semana»—: la mayoría de las semanas no hay ninguno, y un
 * renglón vacío repetido enseña a ignorar el lugar donde después va a aparecer algo.
 */
export function AvisoCumpleanos({ alumnos, hoy }: { alumnos: readonly Alumno[]; hoy: Fecha }) {
  const proximos = cumpleanosProximos(alumnos, hoy)
  if (proximos.length === 0) return null

  const deHoy = cumpleanosDeHoy(proximos)
  const despues = proximos.filter((c) => c.faltan > 0)

  return (
    <aside
      aria-label="Cumpleaños"
      className="rounded-md border-l-[7px] border-ambar bg-ambar/5 py-2 pl-3"
    >
      {deHoy.length > 0 && (
        <p className="text-base text-tinta">
          {/* Los de hoy con nombre y edad: es lo que se dice en voz alta al empezar
              la clase. */}
          Hoy cumple{deHoy.length > 1 ? 'n' : ''}{' '}
          {deHoy.map((c, i) => (
            <span key={c.alumno.id}>
              {i > 0 && (i === deHoy.length - 1 ? ' y ' : ', ')}
              <strong className="font-medium">{nombreDePila(c.alumno)}</strong>
              {', '}
              <span className="cifra">{c.cumple}</span> años
            </span>
          ))}
        </p>
      )}

      {despues.length > 0 && (
        <p className={deHoy.length > 0 ? 'mt-1 text-[13px] text-tinta-2' : 'text-base text-tinta'}>
          {deHoy.length > 0 ? 'Esta semana: ' : 'Esta semana cumple años: '}
          {despues.map((c: Cumpleanos, i) => (
            <span key={c.alumno.id}>
              {i > 0 && ', '}
              {nombreDePila(c.alumno)} {cuandoCae(c.fecha, c.faltan)}
            </span>
          ))}
        </p>
      )}
    </aside>
  )
}
