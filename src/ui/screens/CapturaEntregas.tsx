import { useEffect } from 'react'

import { abrirCaptura, alternarEntrega, contarEntregadas } from '@/application/entregas'
import { CAMPOS_CON_NOMBRE } from '@/application/evaluacion'
import type { ActividadConEstado } from '@/data/ports/evaluacion'
import type { Trimestre } from '@/domain/entities'
import { Cabecera } from '@/ui/components/Cabecera'
import { FilaEntregaAlumno } from '@/ui/components/FilaEntregaAlumno'
import { comoDiaCorto } from '@/ui/lib/fechas'
import { Button } from '@/ui/components/ui/button'
import { useEntregasDeActividad } from '@/ui/hooks/useEntregasDeActividad'

/**
 * Capturar quién entregó y quién no.
 *
 * Es el camino de captura, no de configuración: **un toque por alumno, sin botón
 * de Guardar y sin confirmación**. El presupuesto es el mismo que el de la
 * asistencia —30 alumnos en menos de 15 segundos— y todo lo de esta pantalla se
 * deriva de ahí.
 *
 * Al abrir se materializan las 30 entregas en `entregada: true`. Es lo contrario
 * de la asistencia, donde hojear un día no escribe (D-013), y a propósito: a una
 * actividad no se entra si no es a calificarla, así que aquí «abrir» ya es
 * «calificar». Con eso, «cero registros ⇒ sin calificar» queda inequívoco y el
 * promedio no tiene huecos.
 */
export function CapturaEntregas({
  trimestre,
  actividad,
  alVolver,
  alEditar,
}: {
  trimestre: Trimestre
  actividad: ActividadConEstado
  alVolver: () => void
  alEditar: () => void
}) {
  const { filas, cargando } = useEntregasDeActividad(actividad.actividad.id)
  const { entregadas, total } = contarEntregadas(filas)
  const abierto = trimestre.estado === 'abierto'

  // Se materializa al abrir, una vez por actividad. Es idempotente, así que un
  // remontaje no duplica nada, y en un trimestre cerrado no escribe.
  useEffect(() => {
    void abrirCaptura(trimestre, actividad)
  }, [trimestre, actividad])

  const campo = CAMPOS_CON_NOMBRE.find((c) => c.campo === actividad.actividad.campo)?.nombre

  return (
    <section aria-labelledby="titulo-captura" className="flex flex-col gap-4">
      <Cabecera
        titulo={actividad.actividad.nombre}
        id="titulo-captura"
        alVolver={alVolver}
        detalle={
          <>
            {comoDiaCorto(actividad.actividad.fecha)}
            {campo && ` · ${campo}`}
          </>
        }
        accion={
          <Button variant="ghost" onClick={alEditar} className="mt-1">
            Editar
          </Button>
        }
      />

      <div>
        {/* Una sola cifra, no un tablero. aria-live porque al tocar una fila el
            número cambia sin que nada reciba el foco (docs/UX.md). */}
        <p className="cifra text-4xl font-semibold text-tinta" aria-live="polite">
          {entregadas} <span className="text-tinta-2">/ {total}</span>
        </p>
        <p className="mt-1 text-apoyo text-tinta-2">
          {total === 0
            ? ''
            : entregadas === total
              ? 'Todos entregaron'
              : `${total - entregadas} sin entregar`}
        </p>
      </div>

      {/* Lo más importante de la pantalla, y no estaba escrito: al abrirla todos
          quedan como entregado. Sin decirlo, se guarda un diez sin querer. */}
      {abierto && total > 0 && (
        <p className="text-apoyo text-tinta-2">
          Todos los alumnos aparecen como entregado. Toque el nombre de quien no entregó
          para marcarlo. Los cambios se guardan solos.
        </p>
      )}

      {!abierto && (
        <p className="text-apoyo text-tinta-2">
          Este trimestre está cerrado: se puede consultar, no cambiar.
        </p>
      )}

      {/* -mx-4 para que la barra de color toque el borde de la pantalla: es lo
          que hace que la columna bicolor se lea de corrido. */}
      <ul className="-mx-4 border-t border-linea">
        {filas.map((fila) => (
          <li key={fila.alumno.id}>
            <FilaEntregaAlumno
              fila={fila}
              deshabilitada={!abierto}
              alTocar={() => void alternarEntrega(trimestre, actividad, fila)}
            />
          </li>
        ))}
      </ul>

      {!cargando && filas.length === 0 && (
        <p className="text-base text-tinta-2">
          Todavía no hay alumnos. La lista se carga en Grupo → Ajustes → Cargar lista de alumnos.
        </p>
      )}
    </section>
  )
}
