import { useState } from 'react'

import {
  borrarActividad,
  CAMPOS_CON_NOMBRE,
  cambiaLaCaptura,
  crearActividad,
  editarActividad,
  EJES_ARTICULADORES,
  estaCalificada,
} from '@/application/evaluacion'
import type {
  ActividadConEstado,
  ActividadesDelCriterio,
  DatosActividad,
} from '@/data/ports/evaluacion'
import type { Trimestre } from '@/domain/entities'
import type { CampoFormativo } from '@/domain/values'
import { IconoAtras } from '@/ui/components/iconos'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { useRubricas } from '@/ui/hooks/useRubricas'
import { cn } from '@/ui/lib/utils'

/**
 * Crear o editar una actividad.
 *
 * El **campo formativo va primero y el nombre no se habilita hasta elegirlo.** No
 * es capricho de orden: es la agrupación con la que ella reporta, y puesto al final
 * se queda en el que venía por omisión —con lo que el reporte por campo deja de
 * significar algo—.
 *
 * Los ejes articuladores son opcionales y van al final, después de lo que sí hace
 * falta para calificar.
 */
export function FormaActividad({
  trimestre,
  grupo,
  actual,
  rubricaPorOmision,
  hoy,
  alVolver,
}: {
  trimestre: Trimestre
  grupo: ActividadesDelCriterio
  /** Ausente cuando es una actividad nueva. */
  actual?: ActividadConEstado
  rubricaPorOmision: string | null
  hoy: string
  alVolver: () => void
}) {
  const { rubricas } = useRubricas()
  const editando = actual !== undefined

  const [campo, setCampo] = useState<CampoFormativo | null>(actual?.actividad.campo ?? null)
  const [nombre, setNombre] = useState(actual?.actividad.nombre ?? '')
  const [fecha, setFecha] = useState(actual?.actividad.fecha ?? hoy)
  const [ejes, setEjes] = useState<string[]>(actual?.actividad.ejes ?? [])
  const [rubricaId, setRubricaId] = useState<string | null>(
    actual ? actual.actividad.rubrica_id : rubricaPorOmision,
  )
  const [error, setError] = useState('')
  const [confirmando, setConfirmando] = useState<'captura' | 'borrado' | null>(null)

  const datos = (): DatosActividad => ({
    criterio_trimestre_id: grupo.ponderado.id,
    nombre,
    campo: campo ?? 'lenguajes',
    ejes,
    fecha,
    rubrica_id: rubricaId,
  })

  // Solo las activas, más la que ya está puesta aunque se haya desactivado: si no,
  // la forma mentiría sobre cómo se está calificando esta actividad.
  const ofrecidas = rubricas.filter(
    (r) => r.rubrica.activa || r.rubrica.id === actual?.actividad.rubrica_id,
  )

  const listo = campo !== null && nombre.trim() !== '' && fecha !== ''
  const perderia = actual ? cambiaLaCaptura(actual, datos()) : false

  async function guardar(confirmado = false) {
    setError('')
    try {
      if (actual) {
        await editarActividad(trimestre, grupo.criterio, actual, datos(), confirmado)
      } else {
        await crearActividad(trimestre, grupo.criterio, datos())
      }
      alVolver()
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo guardar')
    }
  }

  async function borrar(confirmado = false) {
    if (!actual) return
    setError('')
    try {
      await borrarActividad(trimestre, actual, confirmado)
      alVolver()
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo borrar')
    }
  }

  return (
    <section aria-labelledby="titulo-actividad" className="mx-auto flex max-w-2xl flex-col">
      <header className="flex items-center gap-1">
        <Button size="icon" variant="ghost" onClick={alVolver} aria-label="Volver">
          <IconoAtras className="size-6" />
        </Button>
        <h1 id="titulo-actividad" className="text-2xl font-bold text-tinta">
          {editando ? 'Actividad' : 'Nueva actividad'}
        </h1>
      </header>

      <div className="flex flex-col gap-5 pt-4">
        <p className="text-base text-tinta-2">
          En <span className="font-medium text-tinta">{grupo.criterio.nombre}</span>, trimestre{' '}
          {trimestre.numero}
        </p>

        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-base font-medium text-tinta">Campo formativo</legend>
          <div className="flex flex-col gap-2">
            {CAMPOS_CON_NOMBRE.map((opcion) => (
              <button
                key={opcion.campo}
                type="button"
                aria-pressed={campo === opcion.campo}
                onClick={() => setCampo(opcion.campo)}
                className={cn(
                  'flex min-h-11 items-center rounded-md border px-3 py-2 text-left text-base outline-none',
                  'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  campo === opcion.campo
                    ? 'border-azul bg-azul/10 text-tinta'
                    : 'border-linea text-tinta-2 hover:bg-cuadro',
                )}
              >
                {opcion.nombre}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="nombre-actividad" className="text-base font-medium text-tinta">
            Nombre de la actividad
          </label>
          <Input
            id="nombre-actividad"
            value={nombre}
            placeholder={campo === null ? 'Elige antes el campo formativo' : 'Cuento de terror…'}
            disabled={campo === null}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="fecha-actividad" className="text-base font-medium text-tinta">
            Fecha
          </label>
          {/* type="date" abre el selector de iPadOS y no el teclado, igual que las
              fechas del ciclo escolar. */}
          <Input
            id="fecha-actividad"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="cifra max-w-44"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="rubrica-actividad" className="text-base font-medium text-tinta">
            Se califica con
          </label>
          <select
            id="rubrica-actividad"
            value={rubricaId ?? ''}
            onChange={(e) => setRubricaId(e.target.value === '' ? null : e.target.value)}
            className={cn(
              'h-11 max-w-md rounded-md border border-linea bg-papel px-2 text-base text-tinta',
              'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
            )}
          >
            <option value="">Entregada / no entregada</option>
            {ofrecidas.map((r) => (
              <option key={r.rubrica.id} value={r.rubrica.id}>
                {r.rubrica.nombre}
                {!r.rubrica.activa && ' (desactivada)'}
              </option>
            ))}
          </select>
          {!editando && rubricaPorOmision !== null && (
            <p className="text-[13px] text-tinta-2">
              Viene de la actividad anterior de este criterio. Se puede cambiar.
            </p>
          )}
          {perderia && (
            <p className="text-[13px] text-rojo">
              Cambiarla borra lo ya calificado en esta actividad: {actual?.registros}{' '}
              {actual?.registros === 1 ? 'registro' : 'registros'}.
            </p>
          )}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-base font-medium text-tinta">
            Ejes articuladores{' '}
            <span className="font-normal text-tinta-2">— opcionales</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {EJES_ARTICULADORES.map((eje) => {
              const puesto = ejes.includes(eje)
              return (
                <button
                  key={eje}
                  type="button"
                  aria-pressed={puesto}
                  onClick={() =>
                    setEjes(puesto ? ejes.filter((e) => e !== eje) : [...ejes, eje])
                  }
                  className={cn(
                    'min-h-11 rounded-md border px-3 py-1 text-base outline-none',
                    'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    puesto
                      ? 'border-azul bg-azul/10 text-tinta'
                      : 'border-linea text-tinta-2 hover:bg-cuadro',
                  )}
                >
                  {eje}
                </button>
              )
            })}
          </div>
        </fieldset>

        {error && (
          <p
            role="alert"
            className="rounded-md border-l-[7px] border-rojo bg-rojo/5 px-4 py-3 text-base text-tinta"
          >
            {error}
          </p>
        )}

        {confirmando && (
          <div
            role="alertdialog"
            aria-label="Confirmar"
            className="flex flex-col gap-3 rounded-md border-l-[7px] border-rojo bg-rojo/5 px-4 py-3"
          >
            <p className="text-base text-tinta">
              {confirmando === 'captura'
                ? `Se van a borrar ${actual?.registros} registros ya calificados en esta actividad. No se pueden recuperar.`
                : `«${actual?.actividad.nombre}» ya está calificada: se va con sus ${actual?.registros} registros. No se pueden recuperar.`}
            </p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() =>
                  void (confirmando === 'captura' ? guardar(true) : borrar(true))
                }
              >
                {confirmando === 'captura' ? 'Guardar y borrar' : 'Borrar la actividad'}
              </Button>
              <Button variant="outline" onClick={() => setConfirmando(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-linea pt-3">
          <Button
            size="lg"
            disabled={!listo}
            onClick={() => (perderia ? setConfirmando('captura') : void guardar())}
          >
            {editando ? 'Guardar cambios' : 'Crear actividad'}
          </Button>
          {editando && (
            <Button
              variant="outline"
              onClick={() =>
                estaCalificada(actual) ? setConfirmando('borrado') : void borrar()
              }
            >
              Borrar
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
