import { Cabecera } from '@/ui/components/Cabecera'
import { Input } from '@/ui/components/ui/input'
import {
  COLORES,
  colorDe,
  LARGO_DEL_NOMBRE,
  MODOS,
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
  const { elegirColor, elegirModo, elegirTamano, alternarCuadricula, nombrarGrupo } =
    apariencia

  const oscuro = tocaOscuro(
    apariencia,
    globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  )
  const actual = colorDe(apariencia)

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
          {COLORES.map((color) => {
            const elegido = color.id === actual.id
            return (
              <li key={color.id}>
                <button
                  type="button"
                  aria-pressed={elegido}
                  onClick={() => elegirColor(color.id)}
                  className={cn(
                    'foco flex min-h-14 items-center gap-2 rounded-md border px-3 text-base',
                    elegido
                      ? 'border-marca bg-marca/10 font-medium text-tinta'
                      : 'border-linea text-tinta-2 hover:bg-cuadro',
                  )}
                >
                  {/* La muestra lleva el tono que de verdad se va a usar en el modo
                      activo, no el claro siempre: en oscuro el color se aclara, y
                      enseñar el otro sería enseñar algo que no ocurre. */}
                  <span
                    aria-hidden
                    className="size-6 shrink-0 rounded-full border border-linea"
                    style={{ backgroundColor: oscuro ? color.oscuro : color.claro }}
                  />
                  {color.nombre}
                </button>
              </li>
            )
          })}
        </ul>

        <Muestra />
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
        titulo="Fondo de cuaderno"
        ayuda="La cuadrícula tenue del fondo, como la de un cuaderno de la escuela."
      >
        <Opciones
          etiqueta="Fondo de cuaderno"
          opciones={[
            { id: 'si', principal: 'Con cuadrícula' },
            { id: 'no', principal: 'Liso' },
          ]}
          activa={apariencia.cuadricula ? 'si' : 'no'}
          alElegir={(id) => alternarCuadricula(id === 'si')}
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

/** Una fila de opciones excluyentes. El mismo gesto en las cuatro preferencias. */
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
const MUESTRA = [
  { barra: 'bg-azul', nombre: 'Presente', tono: 'text-tinta-2' },
  { barra: 'bg-rojo', nombre: 'Ausente', tono: 'text-rojo' },
  { barra: 'bg-ambar', nombre: 'Retardo', tono: 'text-ambar' },
  { barra: 'bg-verde', nombre: 'Justificada', tono: 'text-verde' },
] as const

function Muestra() {
  return (
    <div className="mt-2 overflow-hidden rounded-md border border-linea">
      <p className="border-b border-linea bg-cuadro px-3 py-2 text-apoyo text-tinta-2">
        Los colores de la lista de asistencia no cambian: dicen quién vino y quién no.
      </p>
      <ul>
        {MUESTRA.map((fila) => (
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
