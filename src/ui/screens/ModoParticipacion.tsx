import {
  quitarParticipacion,
  sumarParticipacion,
  totalDelDia,
} from '@/application/participacion'
import type { Trimestre } from '@/domain/entities'
import type { Fecha } from '@/domain/values'
import { FilaParticipacionAlumno } from '@/ui/components/FilaParticipacionAlumno'
import { useEsquemaTrimestre } from '@/ui/hooks/useEsquemaTrimestre'
import { useParticipacionDelDia } from '@/ui/hooks/useParticipacionDelDia'

/**
 * La pantalla de asistencia, en modo participación.
 *
 * No es otra pantalla: vive dentro de *Asistencia*, debajo de la misma tira de
 * días, y por eso marcar participación no cuesta ni un toque en el camino de
 * pasar lista —quien no usa el modo no lo enciende y no lo ve—.
 *
 * Lo que cambia es todo lo demás: el contador cuenta participaciones y no
 * presentes, las barras son verdes y no azules, y hay un aviso arriba. Con el
 * mismo gesto significando dos cosas, la pantalla tiene que ser imposible de
 * confundir con la de pasar lista (D-020).
 *
 * Monta las suscripciones al encenderse y las suelta al apagarse: con el modo
 * apagado no hay ni una consulta de participaciones abierta.
 */
export function ModoParticipacion({
  fecha,
  trimestre,
}: {
  fecha: Fecha
  trimestre: Trimestre | null
}) {
  const { filas, cargando } = useParticipacionDelDia(fecha, trimestre)
  const { esquema } = useEsquemaTrimestre(trimestre?.id ?? null)

  // El criterio del trimestre, si está configurado: de ahí sale la meta que se ve
  // en cada fila. Si no está, se marca igual y se dice que no califica: el dato es
  // válido y el criterio se puede agregar después, porque la atribución al
  // trimestre se deriva al leer.
  const criterio = esquema?.criterios.find((c) => c.criterio.tipo === 'auto_participacion')
  const meta = criterio?.ponderado.meta_participacion ?? null

  const { participaciones, alumnos } = totalDelDia(filas)

  return (
    <>
      <div className="flex flex-col gap-1 rounded-md border-l-[7px] border-verde bg-verde/5 py-2 pl-3">
        <p className="text-base font-medium text-tinta">Modo participación</p>
        <p className="text-[13px] text-tinta-2">
          Un toque suma una participación; sostener el dedo resta una. La asistencia no se
          toca mientras el modo está prendido.
        </p>
        {trimestre === null ? (
          <p className="text-[13px] text-tinta-2">
            Este día no cae en ningún trimestre, así que lo que se marque no va a calificar.
          </p>
        ) : criterio === undefined ? (
          <p className="text-[13px] text-tinta-2">
            El trimestre {trimestre.numero} no tiene el criterio de Participación: se guarda,
            pero todavía no califica.
          </p>
        ) : meta === null ? (
          <p className="text-[13px] text-rojo">
            La participación no tiene meta en este trimestre, así que no califica. Se pone en
            Ajustes → Criterios y pesos.
          </p>
        ) : null}
      </div>

      <div>
        {/* La misma cifra grande de siempre, en el mismo lugar, contando otra cosa:
            participaciones del día, no presentes. */}
        <p className="cifra text-4xl font-semibold text-verde" aria-live="polite">
          {participaciones}
        </p>
        <p className="mt-1 text-[13px] text-tinta-2">
          {cargando
            ? 'Cargando…'
            : participaciones === 0
              ? 'Nadie ha participado hoy'
              : `${participaciones === 1 ? 'una participación' : `${participaciones} participaciones`} de ${alumnos === 1 ? 'un alumno' : `${alumnos} alumnos`}`}
        </p>
      </div>

      <ul className="-mx-4 border-t border-linea">
        {filas.map((fila) => (
          <li key={fila.alumno.id}>
            <FilaParticipacionAlumno
              fila={fila}
              meta={meta}
              alSumar={() => void sumarParticipacion(fila.alumno.id, fecha)}
              alRestar={() => void quitarParticipacion(fila.alumno.id, fecha)}
            />
          </li>
        ))}
      </ul>
    </>
  )
}
