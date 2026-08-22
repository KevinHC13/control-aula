import { useState } from 'react'

import {
  alumnosParaEquipos,
  cuantosEquipos,
  formarEquipos,
  type ModoDeReparto,
} from '@/application/equipos'
import { IconoAtras } from '@/ui/components/iconos'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { useAsistenciaDelDia } from '@/ui/hooks/useAsistenciaDelDia'
import { plural } from '@/ui/lib/plural'
import { cn } from '@/ui/lib/utils'
import { useInterfaz } from '@/ui/store/interfaz'

/**
 * Los repartos más pedidos, como atajo de un toque. No son las únicas opciones: al
 * lado hay un campo para cualquier número.
 *
 * Los dos conviven porque esta pantalla se usa con los niños esperando: «cuatro
 * equipos» es un toque, y escribirlo son tres. Quitar los atajos para ganar
 * generalidad costaría tiempo en el caso común.
 */
const ATAJOS = [2, 3, 4, 5, 6] as const

/** El tope del campo: con dos cifras se cubre cualquier salón. */
const MAXIMO = 99

/**
 * Formar equipos.
 *
 * La segunda de las dos funciones que se usan **con los niños mirando la
 * pantalla**, así que los nombres van grandes y nada hace esperar: se arma al
 * toque y se rehace al toque.
 *
 * **No guarda nada.** Los equipos viven en el estado de esta pantalla y se van con
 * ella, como el calendario del mes o la pestaña activa: son estado de interfaz, no
 * un dato del salón (D-021). El día que pida «los equipos de ayer» se paga una
 * tabla, una fecha y una pantalla de historial; para armar equipos en el momento,
 * no.
 *
 * Vive en *Grupo* y no en *Asistencia* porque es una herramienta sobre la
 * composición del salón, no sobre el día —aunque se pueda armar con los presentes
 * del día, que es el caso normal—.
 */
export function Equipos({ alVolver }: { alVolver: () => void }) {
  const diaSeleccionado = useInterfaz((s) => s.diaSeleccionado)
  const { filas, cargando } = useAsistenciaDelDia(diaSeleccionado)

  const [modo, setModo] = useState<ModoDeReparto>('equipos')
  const [cantidad, setCantidad] = useState(4)
  const [soloPresentes, setSoloPresentes] = useState(true)
  // El reparto se deriva de la semilla, igual que el sorteado en la ruleta: así
  // «volver a sortear» es cambiar un número y no hay dos verdades que sincronizar.
  const [semilla, setSemilla] = useState<number | null>(null)

  const alumnos = alumnosParaEquipos(filas, soloPresentes)
  const equipos = semilla === null ? [] : formarEquipos(alumnos, modo, cantidad, semilla)
  // Cuántos salen de verdad, para poder decir que se pidieron más de los posibles
  // en vez de pintar tarjetas vacías.
  const posibles = cuantosEquipos(alumnos.length, modo, cantidad)
  const pedidos = modo === 'equipos' ? cantidad : posibles
  // El equipo más grande del reparto: es lo que hace visible que pedir «7 por
  // equipo» pueda dar equipos de 6.
  const mayorEquipo = equipos.reduce((mayor, e) => Math.max(mayor, e.integrantes.length), 0)

  return (
    <section aria-labelledby="titulo-equipos" className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={alVolver} aria-label="Volver a Grupo">
          <IconoAtras className="size-6" />
        </Button>
        <h1 id="titulo-equipos" className="text-2xl font-bold text-tinta">
          Equipos
        </h1>
      </header>

      <div className="flex flex-col gap-3">
        <div role="group" aria-label="Cómo repartir" className="flex gap-2">
          {(
            [
              { valor: 'equipos', etiqueta: 'Número de equipos' },
              { valor: 'por_equipo', etiqueta: 'Niños por equipo' },
            ] as const
          ).map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              aria-pressed={modo === opcion.valor}
              onClick={() => setModo(opcion.valor)}
              className={cn(
                'h-11 flex-1 rounded-md border px-3 text-base outline-none',
                'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                modo === opcion.valor
                  ? 'border-azul bg-azul text-papel'
                  : 'border-linea text-tinta hover:bg-cuadro',
              )}
            >
              {opcion.etiqueta}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label={modo === 'equipos' ? 'Cuántos equipos' : 'Cuántos niños por equipo'}
            className="flex flex-wrap gap-2"
          >
            {ATAJOS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={cantidad === n}
                onClick={() => setCantidad(n)}
                className={cn(
                  'cifra h-11 min-w-11 rounded-md border px-3 text-base outline-none',
                  'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  cantidad === n
                    ? 'border-azul bg-azul/10 text-tinta'
                    : 'border-linea text-tinta-2 hover:bg-cuadro',
                )}
              >
                {n}
              </button>
            ))}
          </div>

          <CampoDeCantidad modo={modo} cantidad={cantidad} alCambiar={setCantidad} />
        </div>

        <button
          type="button"
          aria-pressed={soloPresentes}
          onClick={() => setSoloPresentes((solo) => !solo)}
          className={cn(
            'min-h-11 self-start rounded-md border px-3 text-base outline-none',
            'focus-visible:ring-[3px] focus-visible:ring-ring/50',
            soloPresentes
              ? 'border-verde bg-verde/10 text-tinta'
              : 'border-linea text-tinta-2 hover:bg-cuadro',
          )}
        >
          {soloPresentes ? 'Solo los presentes de hoy' : 'Todo el grupo'}
        </button>

        <p className="text-[13px] text-tinta-2">
          {cargando
            ? 'Cargando…'
            : soloPresentes
              ? `${alumnos.length} en el salón hoy — sin los ausentes ni las faltas justificadas`
              : `${alumnos.length} en el grupo, vinieran o no`}
        </p>

        <Button
          className="self-start"
          disabled={alumnos.length === 0}
          onClick={() => setSemilla(Math.random())}
        >
          {semilla === null ? 'Formar equipos' : 'Volver a sortear'}
        </Button>

        {alumnos.length === 0 && !cargando && (
          <p className="text-base text-tinta-2">
            No hay a quién repartir. {soloPresentes ? 'Hoy no hay nadie presente.' : ''}
          </p>
        )}

        {/* Pedir «7 por equipo» con 30 alumnos da 5 equipos de 6, no 4 de 7 y uno
            de 2. Es la regla de repartir el sobrante, y sorprende lo suficiente
            como para decirla: si no, parece que la app ignoró el número. */}
        {modo === 'por_equipo' && equipos.length > 0 && mayorEquipo !== cantidad && (
          <p className="text-base text-tinta-2">
            Se pidieron <span className="cifra">{cantidad}</span> por equipo. Con{' '}
            <span className="cifra">{alumnos.length}</span> alumnos salen{' '}
            <span className="cifra">{equipos.length}</span>{' '}
            {plural(equipos.length, 'equipo', 'equipos')} de{' '}
            <span className="cifra">{mayorEquipo}</span>, para que ninguno quede con muy
            pocos integrantes.
          </p>
        )}

        {pedidos > posibles && (
          <p className="text-base text-tinta-2">
            Pediste <span className="cifra">{pedidos}</span> equipos y hay{' '}
            <span className="cifra">{alumnos.length}</span>{' '}
            {plural(alumnos.length, 'alumno', 'alumnos')}: salen{' '}
            <span className="cifra">{posibles}</span>, de uno. No se arman equipos
            vacíos.
          </p>
        )}
      </div>

      {equipos.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {equipos.map((equipo) => (
            <li
              key={equipo.numero}
              className="rounded-md border-l-[7px] border-azul bg-cuadro/40 px-3 py-2"
            >
              <p className="text-base font-medium text-tinta">
                Equipo <span className="cifra">{equipo.numero}</span>{' '}
                <span className="font-normal text-tinta-2">
                  · <span className="cifra">{equipo.integrantes.length}</span>
                </span>
              </p>
              {/* Los nombres son lo que se lee de lejos, así que van al tamaño del
                  cuerpo y no en letra chica. */}
              <ul className="mt-1">
                {equipo.integrantes.map((alumno) => (
                  <li key={alumno.id} className="text-base text-tinta">
                    {alumno.nombre}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Cualquier número de equipos, o de niños por equipo, escrito a mano.
 *
 * Campo de texto y no `type="number"`: en iPad el nativo abre el teclado con
 * desplazamiento y arriesga el zoom de Safari, y además convierte los estados
 * intermedios —el campo vacío mientras ella borra para escribir otra cifra— en
 * `NaN`. Es el mismo patrón que el peso de un criterio.
 *
 * Mientras ella escribe manda el campo; al salir, manda el valor real. Sin eso,
 * borrar el campo para teclear otro número lo repondría solo a media palabra.
 */
function CampoDeCantidad({
  modo,
  cantidad,
  alCambiar,
}: {
  modo: ModoDeReparto
  cantidad: number
  alCambiar: (cantidad: number) => void
}) {
  const [texto, setTexto] = useState(String(cantidad))
  const [editando, setEditando] = useState(false)

  function escribir(valor: string) {
    setEditando(true)
    setTexto(valor)

    const limpio = valor.replace(/[^\d]/g, '')
    if (limpio === '') return
    const numero = Number(limpio)
    // Cero no se acepta —no hay cero equipos— y del tope para arriba tampoco:
    // pedir más de los posibles ya lo dice la pantalla, pero un número de cuatro
    // cifras solo puede ser un dedo resbalado.
    if (numero < 1 || numero > MAXIMO) return
    alCambiar(numero)
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="cantidad-equipos" className="text-base text-tinta-2">
        u otro:
      </label>
      <Input
        id="cantidad-equipos"
        type="text"
        inputMode="numeric"
        aria-label={
          modo === 'equipos' ? 'Otro número de equipos' : 'Otro número de niños por equipo'
        }
        value={editando ? texto : String(cantidad)}
        onChange={(e) => escribir(e.target.value)}
        // Al enfocarlo se selecciona lo que hay, así que teclear reemplaza en vez
        // de añadir. Sin esto, en un campo de dos cifras hay que borrar antes de
        // escribir, y con los niños esperando eso son dos toques de más.
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => setEditando(false)}
        className="cifra w-16 shrink-0 text-center"
      />
    </div>
  )
}
