import { useEffect, useState } from 'react'

import { sumarParticipacion } from '@/application/participacion'
import { candidatosPresentes, sortearEntre } from '@/application/sorteo'
import type { Trimestre } from '@/domain/entities'
import type { Fecha } from '@/domain/values'
import { Button } from '@/ui/components/ui/button'
import { useAsistenciaDelDia } from '@/ui/hooks/useAsistenciaDelDia'
import { useParticipacionDelDia } from '@/ui/hooks/useParticipacionDelDia'

/** Cuánto dura la ruleta. Divertida la primera vez, estorbo la décima. */
const GIRO_MS = 1200
/** Cada cuánto cambia el nombre mientras gira. */
const PARPADEO_MS = 90

/** Si el dispositivo pide menos movimiento, no hay ruleta: sale el nombre. */
function prefiereQuietud(): boolean {
  return typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
}

/**
 * Sortear quién pasa al pizarrón.
 *
 * Es una de las dos únicas funciones de la app que se usan **con los niños
 * mirando la pantalla**, así que manda una regla que no aplica en ningún otro
 * lado: el nombre se lee de lejos y nada hace esperar. La ruleta dura un segundo
 * y dos décimas y **se puede saltar**; una animación de tres segundos es divertida
 * la primera vez y un estorbo la décima, con treinta niños esperando.
 *
 * **No registra nada por sí solo** (D-021): sale el nombre y ella dice si
 * participó. Un sorteo que anota la participación por haber salido sorteado
 * mediría *salir sorteado*, y la calificación dejaría de significar lo que dice.
 *
 * El sorteado se **deriva** de un número al azar guardado en estado, no se guarda
 * aparte: así «volver a sortear» es cambiar ese número, y nada puede quedar
 * apuntando a un alumno que ya no está en la lista.
 */
export function Sorteo({ fecha, trimestre }: { fecha: Fecha; trimestre: Trimestre | null }) {
  const { filas: asistencia, cargando } = useAsistenciaDelDia(fecha)
  const { filas: participacion } = useParticipacionDelDia(fecha, trimestre)

  const candidatos = candidatosPresentes(asistencia, participacion)

  const [azar, setAzar] = useState(() => Math.random())
  const [girando, setGirando] = useState(() => !prefiereQuietud())
  // El nombre que se ve mientras gira, y que no es el resultado.
  const [parpadeo, setParpadeo] = useState(0)
  /** Lo ya resuelto de este tiro: el nombre y qué dijo ella. */
  const [resuelto, setResuelto] = useState<{ nombre: string; participo: boolean } | null>(null)

  const elegido = sortearEntre(candidatos, azar)

  // La ruleta: dos temporizadores, uno que cambia el nombre y otro que la para.
  // Van en un efecto porque son del reloj, no del toque, y se sueltan al cerrar
  // el diálogo o al volver a sortear.
  useEffect(() => {
    if (!girando) return

    const parpadear = window.setInterval(() => {
      setParpadeo((n) => n + 1)
    }, PARPADEO_MS)
    const parar = window.setTimeout(() => {
      setGirando(false)
    }, GIRO_MS)

    return () => {
      window.clearInterval(parpadear)
      window.clearTimeout(parar)
    }
  }, [girando, azar])

  function otraVez() {
    setResuelto(null)
    setAzar(Math.random())
    setGirando(!prefiereQuietud())
  }

  async function confirmar(participo: boolean) {
    if (!elegido) return
    setResuelto({ nombre: elegido.alumno.nombre, participo })
    // Solo el sí escribe. El no no deja rastro: no participar no es un dato que
    // esta pantalla tenga que guardar.
    if (participo) await sumarParticipacion(elegido.alumno.id, fecha)
  }

  if (cargando) {
    return (
      <p className="py-8 text-center text-base text-tinta-2" aria-live="polite">
        Cargando…
      </p>
    )
  }

  if (candidatos.length === 0) {
    return (
      <div className="flex flex-col gap-2 py-6">
        <p className="text-base text-tinta">
          No hay alumnos entre los que sortear: hoy ninguno está registrado como presente.
        </p>
        <p className="text-apoyo text-tinta-2">
          Participan en el sorteo los alumnos que están en el salón, es decir los presentes
          y los que llegaron con retardo. Las faltas justificadas cuentan como asistencia,
          pero el alumno no está para pasar al frente.
        </p>
      </div>
    )
  }

  // Mientras gira, un nombre cualquiera de los candidatos; al parar, el sorteado.
  const enPantalla = resuelto
    ? resuelto.nombre
    : girando
      ? (candidatos[parpadeo % candidatos.length]?.alumno.nombre ?? '')
      : (elegido?.alumno.nombre ?? '')

  return (
    <div className="flex flex-col gap-4 py-2">
      {/* Lo único que importa en la pantalla. text-4xl y no text-2xl porque esto
          se lee desde la última fila del salón. */}
      <p
        className={
          girando
            ? 'text-4xl leading-tight font-bold break-words text-tinta-2'
            : 'text-4xl leading-tight font-bold break-words text-tinta'
        }
        aria-live={girando ? 'off' : 'polite'}
      >
        {enPantalla}
      </p>

      {resuelto ? (
        <>
          <p className="text-base text-tinta-2" aria-live="polite">
            {resuelto.participo
              ? 'Se registró su participación de hoy.'
              : 'No se registró nada.'}
          </p>
          <Button onClick={otraVez} className="self-start">
            Sortear otra vez
          </Button>
        </>
      ) : girando ? (
        <Button variant="outline" onClick={() => setGirando(false)} className="self-start">
          Saltar
        </Button>
      ) : (
        <>
          <p className="text-base text-tinta">¿Participó este alumno?</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void confirmar(true)}>Sí, participó</Button>
            <Button variant="outline" onClick={() => void confirmar(false)}>
              No participó
            </Button>
            <Button variant="ghost" onClick={otraVez}>
              Sortear otra vez
            </Button>
          </div>
        </>
      )}

      {/* Se dice que el sorteo no es uniforme: es la mitad de para qué sirve, y
          se puede decir en voz alta —«le toca a quien menos ha pasado»—. */}
      <p className="border-t border-linea pt-3 text-apoyo text-tinta-2">
        El sorteo favorece a quienes menos han participado en el trimestre, para que el turno
        no recaiga siempre en los mismos. Participan{' '}
        <span className="cifra">{candidatos.length}</span> alumnos: los presentes de hoy.
      </p>
    </div>
  )
}
