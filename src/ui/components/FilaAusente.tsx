import type { Alumno } from '@/domain/entities'

/**
 * Un alumno que faltó, en la lista de un día del reporte.
 *
 * Es la misma anatomía de fila que el resto de la aplicación —barra de color de
 * 7 px, número en su columna, nombre— y no un párrafo con el nombre dentro. La
 * barra es el elemento distintivo del proyecto (docs/UX.md): convierte una lista
 * en una columna que se recorre sin leer, y aquí dice de un vistazo cuántos
 * renglones hay antes de contar ninguno.
 *
 * **Roja, como en la pantalla de asistencia.** Es el mismo dato —quien no vino— y
 * darle otro color aquí obligaría a aprender dos códigos para una sola cosa.
 *
 * No es un botón, al revés que `FilaAlumno`: este reporte se lee, no se captura, y
 * un renglón que responde al toque promete algo que no va a pasar.
 */
export function FilaAusente({ alumno }: { alumno: Alumno }) {
  return (
    <li className="flex min-h-10 items-center gap-3 border-b border-linea last:border-b-0">
      <span aria-hidden className="w-[7px] self-stretch bg-rojo" />
      {/* Ancho fijo y a la derecha: si no, «1» y «39» empiezan el nombre en
          sitios distintos y la columna de nombres se lee en zigzag. */}
      <span className="cifra w-7 shrink-0 text-right text-base text-tinta-2">
        {alumno.numero_lista}
      </span>
      <span className="min-w-0 flex-1 truncate pr-3 text-base text-tinta">{alumno.nombre}</span>
    </li>
  )
}
