import type { Trimestre } from '@/domain/entities'

/**
 * A qué trimestre pertenece el día que está a la vista.
 *
 * Se ve siempre, pero no pide nada: es una línea de texto, no un selector. La
 * atribución es por fecha y nunca manual —elegir trimestre sería un toque más en
 * el camino diario y una ocasión más de equivocarse— así que esto solo informa a
 * dónde está yendo lo que ella captura.
 *
 * Un día fuera de todo rango —vacaciones, un puente— se dice tal cual. No es un
 * error: el registro existe, simplemente no cuenta para ningún trimestre, y
 * callarlo dejaría a alguien preguntándose por qué un día no aparece en la suma.
 *
 * `sinAbrir` distingue ese caso de otro que se parece pero no es igual: el día cae
 * después del último trimestre abierto y todavía falta abrir alguno. Los dos no
 * atribuyen a nada, pero este se arregla abriendo el trimestre —y lo capturado se
 * acomoda solo, porque la atribución se calcula de la fecha al leer—. Decir «fuera
 * de los trimestres» ahí la mandaría a buscar el error donde no está.
 */
export function EtiquetaTrimestre({
  trimestre,
  hayCiclo,
  sinAbrir,
  cargando,
}: {
  trimestre: Trimestre | null
  hayCiclo: boolean
  sinAbrir: boolean
  cargando: boolean
}) {
  // Mientras carga no se dice nada: escribir "Sin ciclo escolar" y corregirlo un
  // cuadro después es peor que esperar.
  if (cargando) return null

  const texto = !hayCiclo
    ? 'Falta registrar el ciclo escolar'
    : trimestre
      ? `Trimestre ${trimestre.numero}`
      : sinAbrir
        ? 'El trimestre de este día todavía no se ha registrado'
        : 'Día sin trimestre asignado'

  return (
    <p className="text-base text-tinta-2">
      {texto}
      {/* El espacio explícito no es cosmético: sin él, el margen separa las dos
          palabras en pantalla pero un lector de pantalla dice "Trimestre
          1cerrado". */}
      {trimestre?.estado === 'cerrado' && ' '}
      {trimestre?.estado === 'cerrado' && (
        <span className="ml-2 rounded-sm bg-cuadro px-1.5 py-0.5 text-base text-tinta-2">
          cerrado
        </span>
      )}
    </p>
  )
}
