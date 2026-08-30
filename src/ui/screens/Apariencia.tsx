import { useState } from 'react'

import { Cabecera } from '@/ui/components/Cabecera'
import { Input } from '@/ui/components/ui/input'
import {
  COLORES,
  LARGO_DEL_NOMBRE,
  LINEAS,
  marcaDe,
  MODOS,
  normalizarHex,
  PAPELES,
  PROPIO,
  TAMANOS,
  tocaOscuro,
} from '@/ui/lib/tema'
import { cn } from '@/ui/lib/utils'
import { useApariencia } from '@/ui/store/apariencia'

/**
 * Cómo se ve la aplicación.
 *
 * Vive en Ajustes y no en el camino diario, como todo lo que se toca una vez y no
 * todos los días. Nada de lo que hay aquí cambia lo que la aplicación **hace**: son
 * preferencias de quien mira la pantalla, se guardan en el dispositivo y no viajan
 * en el respaldo ni a la nube —restaurar en un iPad nuevo no tiene por qué imponer
 * el tema del viejo—.
 *
 * El límite que gobierna esta pantalla: **el color elegido no toca el bicolor**.
 * Presente sigue azul, ausente rojo, retardo ámbar y justificada verde, porque eso
 * no es decoración sino la información que la lista da de un vistazo. Lo que se
 * personaliza es la identidad —el día seleccionado, la sección activa, los botones—
 * y la muestra de abajo está para que eso se vea, no para que se prometa por
 * escrito.
 */
export function Apariencia({ alVolver }: { alVolver: () => void }) {
  const apariencia = useApariencia()
  const {
    elegirColor,
    elegirPropio,
    elegirModo,
    elegirTamano,
    elegirPapel,
    elegirLineas,
    nombrarGrupo,
  } = apariencia

  const oscuro = tocaOscuro(
    apariencia,
    globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  )

  return (
    <section
      aria-labelledby="titulo-apariencia"
      className="mx-auto flex max-w-2xl flex-col gap-6"
    >
      <Cabecera
        titulo="Apariencia"
        id="titulo-apariencia"
        alVolver={alVolver}
        etiquetaVolver="Volver a Ajustes"
      />

      <Preferencia
        titulo="Color de la aplicación"
        ayuda="Pinta el día que está seleccionado, la sección en la que se está y los botones principales."
      >
        <ul className="flex flex-wrap gap-2">
          {COLORES.map((color) => (
            <li key={color.id}>
              <Muestra
                nombre={color.nombre}
                color={oscuro ? color.oscuro : color.claro}
                elegido={color.id === apariencia.color}
                alElegir={() => elegirColor(color.id)}
              />
            </li>
          ))}
        </ul>

        <ColorPropio
          valor={apariencia.propio}
          elegido={apariencia.color === PROPIO}
          resultante={marcaDe({ ...apariencia, color: PROPIO }, oscuro)}
          alElegir={elegirPropio}
        />

        <FilasDeEjemplo />
      </Preferencia>

      <Preferencia
        titulo="Modo"
        ayuda="«Según el iPad» sigue lo que esté puesto en el dispositivo, y cambia solo al anochecer si así lo tiene configurado."
      >
        <Opciones
          etiqueta="Modo"
          opciones={MODOS.map((m) => ({ id: m.id, principal: m.nombre }))}
          activa={apariencia.modo}
          alElegir={(id) => elegirModo(id as (typeof MODOS)[number]['id'])}
        />
      </Preferencia>

      <Preferencia
        titulo="Tamaño del texto"
        ayuda="Agranda toda la aplicación, incluidos los nombres de la lista. Los botones crecen con el texto, así que no se vuelven más difíciles de tocar."
      >
        <Opciones
          etiqueta="Tamaño del texto"
          opciones={TAMANOS.map((t) => ({
            id: t.id,
            principal: t.nombre,
            ayuda: t.ejemplo,
          }))}
          activa={apariencia.tamano}
          alElegir={(id) => elegirTamano(id as (typeof TAMANOS)[number]['id'])}
        />
      </Preferencia>

      <Preferencia
        titulo="Papel"
        ayuda="El color del fondo. El amarillo es el de una libreta de notas; con el modo oscuro se vuelve un negro cálido."
      >
        <ul className="flex flex-wrap gap-2">
          {PAPELES.map((papel) => (
            <li key={papel.id}>
              <Muestra
                nombre={papel.nombre}
                color={papel.muestra}
                elegido={papel.id === apariencia.papel}
                alElegir={() => elegirPapel(papel.id)}
              />
            </li>
          ))}
        </ul>
      </Preferencia>

      <Preferencia
        titulo="Líneas del papel"
        ayuda="La cuadrícula del cuaderno de la escuela, los renglones de una libreta, o nada."
      >
        <Opciones
          etiqueta="Líneas del papel"
          opciones={LINEAS.map((l) => ({ id: l.id, principal: l.nombre }))}
          activa={apariencia.lineas}
          alElegir={(id) => elegirLineas(id as (typeof LINEAS)[number]['id'])}
        />
      </Preferencia>

      <Preferencia
        titulo="Nombre del grupo"
        ayuda="Aparece en la pantalla de Grupo y en el nombre del archivo de respaldo. Puede dejarse vacío."
      >
        <Input
          aria-label="Nombre del grupo"
          value={apariencia.nombreDelGrupo}
          maxLength={LARGO_DEL_NOMBRE}
          placeholder="3.º B"
          onChange={(e) => nombrarGrupo(e.target.value)}
          className="max-w-64"
        />
      </Preferencia>
    </section>
  )
}

function Preferencia({
  titulo,
  ayuda,
  children,
}: {
  titulo: string
  ayuda: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-medium text-tinta">{titulo}</h2>
      <p className="text-apoyo text-tinta-2">{ayuda}</p>
      {children}
    </section>
  )
}

/**
 * Una muestra de color con su nombre. La misma para los colores y para el papel.
 *
 * El círculo lleva el tono que de verdad se va a usar en el modo que está activo,
 * no el claro siempre: en oscuro los colores se aclaran, y enseñar el otro sería
 * enseñar algo que no ocurre.
 */
function Muestra({
  nombre,
  color,
  elegido,
  alElegir,
}: {
  nombre: string
  color: string
  elegido: boolean
  alElegir: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={elegido}
      onClick={alElegir}
      className={cn(
        'foco flex min-h-14 items-center gap-2 rounded-md border px-3 text-base',
        elegido
          ? 'border-marca bg-marca/10 font-medium text-tinta'
          : 'border-linea text-tinta-2 hover:bg-cuadro',
      )}
    >
      <span
        aria-hidden
        className="size-6 shrink-0 rounded-full border border-linea"
        style={{ backgroundColor: color }}
      />
      {nombre}
    </button>
  )
}

/**
 * El color de quien quiere exactamente el suyo.
 *
 * Dos maneras de darlo, porque son dos personas distintas: el selector del sistema
 * —tocar y arrastrar, sin saber qué es un hexadecimal— y el campo de texto, para
 * quien trae el color de la escuela apuntado en un papel.
 *
 * **Lo que se pinta puede no ser exactamente lo que se pidió**, y la pantalla lo
 * dice cuando pasa. Un amarillo canario con texto blanco encima no se lee, así que
 * se oscurece lo justo conservando el tono; callarlo dejaría a quien elige pensando
 * que la aplicación se equivocó.
 */
function ColorPropio({
  valor,
  elegido,
  resultante,
  alElegir,
}: {
  valor: string
  elegido: boolean
  /** El color ya ajustado para que contraste. Puede no ser `valor`. */
  resultante: string
  alElegir: (hex: string) => void
}) {
  // El texto se escribe carácter a carácter, y «#1b4» es válido a medio teclear un
  // «#1b4f9c». Se guarda solo cuando ya es un color; mientras tanto se ve lo que se
  // está escribiendo.
  const [texto, setTexto] = useState(valor)
  const [escribiendo, setEscribiendo] = useState(false)
  const mostrado = escribiendo ? texto : valor
  const invalido = escribiendo && normalizarHex(texto) === null && texto.trim() !== ''
  const ajustado = elegido && normalizarHex(valor) !== resultante

  return (
    <div className="flex flex-col gap-2 rounded-md border border-linea p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label
          className={cn(
            'foco-dentro flex min-h-14 cursor-pointer items-center gap-2 rounded-md border px-3 text-base',
            elegido
              ? 'border-marca bg-marca/10 font-medium text-tinta'
              : 'border-linea text-tinta-2 hover:bg-cuadro',
          )}
        >
          {/* El selector nativo: en iPadOS abre la rueda de color del sistema, que
              es mejor que cualquier cosa que se pueda dibujar aquí. */}
          <input
            type="color"
            value={normalizarHex(valor) ?? '#1b4f9c'}
            onChange={(e) => alElegir(e.target.value)}
            className="size-6 shrink-0 cursor-pointer rounded-full border border-linea bg-transparent p-0"
            aria-label="Elegir un color propio"
          />
          Otro color
        </label>

        <Input
          value={mostrado}
          aria-label="Color propio en hexadecimal"
          aria-invalid={invalido}
          spellCheck={false}
          autoCapitalize="none"
          placeholder="#1b4f9c"
          className="cifra w-32"
          onFocus={() => {
            setTexto(valor)
            setEscribiendo(true)
          }}
          onBlur={() => setEscribiendo(false)}
          onChange={(e) => {
            setTexto(e.target.value)
            const hex = normalizarHex(e.target.value)
            if (hex !== null) alElegir(hex)
          }}
        />
      </div>

      {invalido && (
        <p className="text-apoyo text-rojo">
          Un color se escribe como <span className="cifra">#1b4f9c</span>: una
          almohadilla y seis cifras o letras de la A a la F.
        </p>
      )}

      {ajustado && !invalido && (
        <p className="text-apoyo text-tinta-2">
          Este color se oscurece un poco al pintarse para que los números y los
          nombres se sigan leyendo encima. El tono es el elegido.
        </p>
      )}
    </div>
  )
}

/** Una fila de opciones excluyentes. El mismo gesto en todas las preferencias. */
function Opciones({
  etiqueta,
  opciones,
  activa,
  alElegir,
}: {
  etiqueta: string
  opciones: readonly { id: string; principal: string; ayuda?: string }[]
  activa: string
  alElegir: (id: string) => void
}) {
  return (
    <div role="group" aria-label={etiqueta} className="flex flex-wrap gap-2">
      {opciones.map((opcion) => {
        const elegida = opcion.id === activa
        return (
          <button
            key={opcion.id}
            type="button"
            aria-pressed={elegida}
            onClick={() => alElegir(opcion.id)}
            className={cn(
              'foco flex min-h-14 flex-col items-start justify-center rounded-md border px-4 text-base',
              elegida
                ? 'border-marca bg-marca/10 font-medium text-tinta'
                : 'border-linea text-tinta-2 hover:bg-cuadro',
            )}
          >
            <span className="leading-tight">{opcion.principal}</span>
            {opcion.ayuda !== undefined && (
              <span className="cifra text-apoyo leading-tight opacity-80">
                {opcion.ayuda}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Las cuatro filas del bicolor, con un nombre de ejemplo.
 *
 * Es la parte de la pantalla que más trabaja: enseña, sin tener que prometerlo por
 * escrito, que elegir verde **no** vuelve verde a «presente». Quien está eligiendo
 * un color lo comprueba aquí mismo en vez de salir a la lista a ver qué pasó.
 */
const EJEMPLO = [
  { barra: 'bg-azul', nombre: 'Presente', tono: 'text-tinta-2' },
  { barra: 'bg-rojo', nombre: 'Ausente', tono: 'text-rojo' },
  { barra: 'bg-ambar', nombre: 'Retardo', tono: 'text-ambar' },
  { barra: 'bg-verde', nombre: 'Justificada', tono: 'text-verde' },
] as const

function FilasDeEjemplo() {
  return (
    <div className="mt-2 overflow-hidden rounded-md border border-linea">
      <p className="border-b border-linea bg-cuadro px-3 py-2 text-apoyo text-tinta-2">
        Los colores de la lista de asistencia no cambian: dicen quién vino y quién no.
      </p>
      <ul>
        {EJEMPLO.map((fila) => (
          <li
            key={fila.nombre}
            className="flex min-h-11 items-center gap-3 border-b border-linea last:border-b-0"
          >
            <span aria-hidden className={cn('h-11 w-[7px] shrink-0', fila.barra)} />
            <span className="flex-1 text-base text-tinta">Alumno de ejemplo</span>
            <span className={cn('pr-3 text-apoyo', fila.tono)}>{fila.nombre}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
