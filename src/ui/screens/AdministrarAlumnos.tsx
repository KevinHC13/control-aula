import { useState } from 'react'

import {
  agregarAlumno,
  darDeBajaAlumno,
  editarAlumno,
  editarFormulario,
  type FormularioAlumno,
  formularioDe,
  formularioNuevo,
  reactivarAlumno,
  revisarFormulario,
  separarBajas,
} from '@/application/alumnos'
import type { Alumno } from '@/domain/entities'
import { EstadoVacio } from '@/ui/components/EstadoVacio'
import { Cabecera } from '@/ui/components/Cabecera'
import { Cargando } from '@/ui/components/Cargando'
import { SelectorSexo } from '@/ui/components/SelectorSexo'
import { Button } from '@/ui/components/ui/button'
import { useAlumnosConBajas } from '@/ui/hooks/useAlumnosConBajas'
import { cn } from '@/ui/lib/utils'

/**
 * Administrar el grupo uno por uno (D-026).
 *
 * No sustituye a *Cargar lista de alumnos*, que sigue siendo la forma de meter
 * treinta nombres sin teclear ninguno. Esto cubre lo que aquella no puede: el
 * que llega en noviembre, el que se cambia de escuela, y el apellido que el OCR
 * leyó mal.
 *
 * **Se lee como lista y se edita como formulario**, el mismo idioma que la
 * revisión de la lista importada: de treinta alumnos se corrigen dos, así que lo
 * que domina es leer. Un renglón se abre al tocarlo y se cierra al guardar.
 *
 * Aquí sí hay botón de Guardar, al revés que las pantallas de captura: un nombre
 * a medio escribir no es un dato, y escribir en cada tecla llenaría la cola de
 * sincronía de versiones intermedias de un apellido.
 */
export function AdministrarAlumnos({ alVolver }: { alVolver: () => void }) {
  const { alumnos, cargando } = useAlumnosConBajas()
  const { vigentes, bajas } = separarBajas(alumnos)

  // Qué renglón está abierto: el `id` de un alumno, 'nuevo' para el alta, o
  // nada. Uno a la vez, para que no haya dos formularios compitiendo.
  const [abierto, setAbierto] = useState<string | null>(null)

  return (
    <section aria-labelledby="titulo-alumnos" className="flex flex-col gap-4">
      <Cabecera titulo="Alumnos" id="titulo-alumnos" alVolver={alVolver} etiquetaVolver="Volver a Ajustes" />

      <p className="text-base text-tinta-2">
        Para cargar el grupo entero conviene Grupo → Ajustes → Cargar lista de alumnos. Aquí se
        agrega a quien llegó después, se corrige un nombre y se da de baja a quien se fue.
      </p>

      {cargando && <Cargando />}

      {!cargando && (
        <>
          {abierto === 'nuevo' ? (
            <Formulario
              inicial={formularioNuevo(alumnos)}
              alumnos={alumnos}
              alGuardar={(formulario) => agregarAlumno(formulario, alumnos)}
              alCerrar={() => setAbierto(null)}
              verbo="Agregar"
            />
          ) : (
            <Button className="self-start" onClick={() => setAbierto('nuevo')}>
              Agregar un alumno
            </Button>
          )}

          {vigentes.length === 0 && (
            <EstadoVacio titulo="Todavía no hay alumnos en el grupo.">
              El grupo entero se carga de una vez en Grupo → Ajustes → Cargar lista de
              alumnos. Aquí se agrega a quien llegue después.
            </EstadoVacio>
          )}

          <ul className="-mx-4 border-t border-linea">
            {vigentes.map((alumno) => (
              <Renglon
                key={alumno.id}
                alumno={alumno}
                alumnos={alumnos}
                abierto={abierto === alumno.id}
                alAbrir={() => setAbierto(abierto === alumno.id ? null : alumno.id)}
                alCerrar={() => setAbierto(null)}
              />
            ))}
          </ul>

          {bajas.length > 0 && <Bajas bajas={bajas} />}
        </>
      )}
    </section>
  )
}

/** Un alumno del grupo: se lee de un vistazo y se abre para corregirlo. */
function Renglon({
  alumno,
  alumnos,
  abierto,
  alAbrir,
  alCerrar,
}: {
  alumno: Alumno
  alumnos: readonly Alumno[]
  abierto: boolean
  alAbrir: () => void
  alCerrar: () => void
}) {
  const [confirmandoBaja, setConfirmandoBaja] = useState(false)

  return (
    <li className="border-b border-linea">
      <button
        type="button"
        onClick={alAbrir}
        aria-expanded={abierto}
        className="flex min-h-14 w-full items-center gap-3 px-4 text-left"
      >
        <span className="cifra w-7 shrink-0 text-base text-tinta-2">
          {alumno.numero_lista}
        </span>
        <span className="min-w-0 flex-1 truncate text-base text-tinta">{alumno.nombre}</span>
        {alumno.fecha_nacimiento && (
          <span className="cifra shrink-0 text-apoyo text-tinta-2">
            {alumno.fecha_nacimiento}
          </span>
        )}
      </button>

      {abierto && (
        <div className="flex flex-col gap-3 px-4 pb-4">
          <Formulario
            inicial={formularioDe(alumno)}
            alumnos={alumnos}
            exceptoId={alumno.id}
            alGuardar={(formulario) => editarAlumno(alumno.id, formulario, alumnos)}
            alCerrar={alCerrar}
            verbo="Guardar"
          />

          {confirmandoBaja ? (
            <div
              role="alertdialog"
              aria-label={`Confirmar la baja de ${alumno.nombre}`}
              className="flex flex-col gap-3 rounded-md border-l-[7px] border-rojo bg-rojo/5 px-4 py-3"
            >
              <p className="text-base text-tinta">
                {alumno.nombre} deja de aparecer al pasar lista y al calificar.{' '}
                <strong className="font-medium">Nada suyo se borra</strong>: su asistencia
                y sus calificaciones se quedan, sigue en los trimestres ya cerrados, y la
                baja se puede deshacer.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="destructive" onClick={() => void darDeBajaAlumno(alumno.id)}>
                  Sí, dar de baja
                </Button>
                <Button variant="outline" onClick={() => setConfirmandoBaja(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="self-start"
              onClick={() => setConfirmandoBaja(true)}
            >
              Dar de baja
            </Button>
          )}
        </div>
      )}
    </li>
  )
}

/** Los que se fueron. Aparte y al final: no son el grupo, son su historia. */
function Bajas({ bajas }: { bajas: readonly Alumno[] }) {
  return (
    <section aria-labelledby="titulo-bajas" className="flex flex-col gap-2 pt-2">
      <h2 id="titulo-bajas" className="text-base font-medium text-tinta">
        Dados de baja
      </h2>
      <p className="text-base text-tinta-2">
        No aparecen al pasar lista ni al calificar, pero siguen en los trimestres que ya se
        cerraron.
      </p>
      <ul className="-mx-4 border-t border-linea">
        {bajas.map((alumno) => (
          <li
            key={alumno.id}
            className="flex min-h-14 items-center gap-3 border-b border-linea px-4"
          >
            <span className="cifra w-7 shrink-0 text-base text-tinta-2">
              {alumno.numero_lista}
            </span>
            <span className="min-w-0 flex-1 truncate text-base text-tinta-2 line-through">
              {alumno.nombre}
            </span>
            <Button variant="ghost" onClick={() => void reactivarAlumno(alumno.id)}>
              Reactivar
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * El estilo de campo se define aquí una vez y no se parchea por sitio de uso
 * (docs/DECISIONES.md D-010). Altura táctil y 16 px: por debajo, Safari hace
 * zoom al enfocar.
 */
const CAMPO = cn(
  'h-11 min-w-0 rounded-md border border-linea bg-papel px-2 text-base text-tinta',
  'outline-none transition-colors',
  'focus:border-ring focus:ring-[3px] focus:ring-ring/50',
  'placeholder:text-tinta-2',
)

/**
 * Uno solo para el alta y para la corrección: los campos y las reglas son los
 * mismos, y lo único que cambia es el verbo del botón.
 */
function Formulario({
  inicial,
  alumnos,
  exceptoId,
  alGuardar,
  alCerrar,
  verbo,
}: {
  inicial: FormularioAlumno
  alumnos: readonly Alumno[]
  exceptoId?: string
  alGuardar: (formulario: FormularioAlumno) => Promise<void>
  alCerrar: () => void
  verbo: string
}) {
  const [formulario, setFormulario] = useState(inicial)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const problema = revisarFormulario(formulario, alumnos, exceptoId)

  function editar(campo: keyof FormularioAlumno, valor: string) {
    setError('')
    setFormulario((previo) => editarFormulario(previo, campo, valor))
  }

  async function guardar() {
    setGuardando(true)
    setError('')
    try {
      await alGuardar(formulario)
      alCerrar()
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-linea bg-papel p-3">
      <div className="flex gap-2">
        <label className="flex w-16 shrink-0 flex-col gap-1">
          <span className="text-apoyo text-tinta-2">Número</span>
          <input
            type="text"
            inputMode="numeric"
            value={formulario.numero_lista}
            onChange={(e) => editar('numero_lista', e.target.value)}
            className={cn(CAMPO, 'cifra text-center')}
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-apoyo text-tinta-2">Nombre</span>
          <input
            type="text"
            value={formulario.nombre}
            placeholder="Apellidos, Nombres"
            onChange={(e) => editar('nombre', e.target.value)}
            className={CAMPO}
          />
        </label>
      </div>

      {/* La CURP va antes que la fecha porque la trae dentro: al escribirla, la
          fecha de abajo se llena sola. Es el mismo trato que en la carga de la
          lista, donde la fecha impresa casi nunca aparece. */}
      <label className="flex flex-col gap-1">
        <span className="text-apoyo text-tinta-2">CURP (opcional)</span>
        <input
          type="text"
          value={formulario.curp}
          placeholder="18 caracteres"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => editar('curp', e.target.value)}
          className={cn(CAMPO, 'cifra')}
        />
      </label>

      {/* Debajo de la CURP y por lo mismo que la fecha: al escribirla, esto se
          pone solo. Queda a la vista para el que llegó sin CURP y para
          corregir lo que la lista trajera mal. */}
      <div className="flex flex-col gap-1">
        <span className="text-apoyo text-tinta-2">Niño o niña (opcional)</span>
        <SelectorSexo
          valor={formulario.sexo}
          etiqueta="Niño o niña"
          alElegir={(sexo) => editar('sexo', sexo)}
        />
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-apoyo text-tinta-2">
          Fecha de nacimiento (opcional, para el aviso de cumpleaños)
        </span>
        <input
          type="date"
          value={formulario.fecha_nacimiento}
          onChange={(e) => editar('fecha_nacimiento', e.target.value)}
          className={cn(CAMPO, 'cifra')}
        />
      </label>

      {/* El problema se enseña mientras se escribe, no al guardar: corregir un
          número repetido con el formulario todavía abierto es más barato que
          descubrirlo después de apretar el botón. */}
      {(problema ?? error) && (
        <p className="text-base text-rojo" aria-live="polite">
          {error || problema}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button disabled={problema !== undefined || guardando} onClick={() => void guardar()}>
          {guardando ? 'Guardando…' : verbo}
        </Button>
        <Button variant="ghost" onClick={alCerrar}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
