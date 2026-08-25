import { repos } from '@/data'
import type { Alumno, DatosAlumno } from '@/domain/entities'
import { fechaValida } from '@/domain/fechas'
import type { Id } from '@/domain/values'

/**
 * Administrar el grupo uno por uno: alta, corrección y baja (D-026).
 *
 * No reemplaza la carga de la lista con IA, que sigue siendo el camino normal y
 * el que evita teclear treinta nombres. Cubre lo que la carga no puede: el
 * alumno que llega en noviembre, el que se cambia de escuela, y el apellido que
 * el OCR leyó mal y nadie notó hasta diciembre.
 *
 * La validación es la misma que la de la revisión de la lista importada, y a
 * propósito: son las mismas reglas y tenerlas en dos sitios es tenerlas mal en
 * uno de los dos.
 */

/** Lo que la pantalla edita: los tres campos, la fecha como texto. */
export interface FormularioAlumno {
  nombre: string
  numero_lista: string
  fecha_nacimiento: string
}

/** El formulario vacío para un alta, con el número ya propuesto. */
export function formularioNuevo(alumnos: readonly Alumno[]): FormularioAlumno {
  return { nombre: '', numero_lista: String(siguienteNumero(alumnos)), fecha_nacimiento: '' }
}

/** El formulario de un alumno que ya existe, para corregirlo. */
export function formularioDe(alumno: Alumno): FormularioAlumno {
  return {
    nombre: alumno.nombre,
    numero_lista: String(alumno.numero_lista),
    fecha_nacimiento: alumno.fecha_nacimiento ?? '',
  }
}

/**
 * El siguiente número libre: el más alto del grupo, más uno.
 *
 * Cuenta a los dados de baja, así que un número no se recicla. Es deliberado:
 * `sembrar()` fusiona por número de lista sobre todos los del ciclo, borrados
 * incluidos, de modo que reutilizar el 14 de quien se fue haría que recargar la
 * lista escribiera sobre cualquiera de los dos.
 *
 * Y no se recorre a nadie (D-026): el alumno 14 sigue siendo el 14 todo el año,
 * porque ella pasa lista por esos números.
 */
export function siguienteNumero(alumnos: readonly Alumno[]): number {
  return alumnos.reduce((max, a) => Math.max(max, a.numero_lista), 0) + 1
}

/**
 * Qué está mal en el formulario, o `undefined` si se puede guardar. El mensaje
 * se muestra tal cual: aquí no hay nadie leyendo la consola.
 *
 * `exceptoId` es el alumno que se está editando, para que su propio número no se
 * cuente como repetido.
 */
export function revisarFormulario(
  formulario: FormularioAlumno,
  alumnos: readonly Alumno[],
  exceptoId?: Id,
): string | undefined {
  if (formulario.nombre.trim() === '') return 'Falta el nombre'

  const numero = Number(formulario.numero_lista)
  if (!Number.isInteger(numero) || numero < 1) return 'El número de lista no es válido'

  const tomado = alumnos.some((a) => a.numero_lista === numero && a.id !== exceptoId)
  if (tomado) return `El número de lista ${numero} ya está ocupado`

  if (formulario.fecha_nacimiento !== '' && !fechaValida(formulario.fecha_nacimiento)) {
    return 'La fecha debe ser AAAA-MM-DD'
  }

  return undefined
}

/** La conversión al tipo del dominio. La fecha vacía es un dato ausente. */
function aDatos(formulario: FormularioAlumno): DatosAlumno {
  return {
    nombre: formulario.nombre.trim(),
    numero_lista: Number(formulario.numero_lista),
    fecha_nacimiento:
      formulario.fecha_nacimiento === '' ? null : formulario.fecha_nacimiento,
  }
}

/**
 * Da de alta a un alumno. Vuelve a validar antes de escribir: la pantalla ya lo
 * hizo, pero el caso de uso no puede confiar en que alguien lo llame bien.
 */
export async function agregarAlumno(
  formulario: FormularioAlumno,
  alumnos: readonly Alumno[],
): Promise<void> {
  const problema = revisarFormulario(formulario, alumnos)
  if (problema !== undefined) throw new Error(problema)

  await repos.alumnos.agregar(aDatos(formulario))
}

/** Corrige a un alumno, conservando su `id` y con él toda su historia. */
export async function editarAlumno(
  id: Id,
  formulario: FormularioAlumno,
  alumnos: readonly Alumno[],
): Promise<void> {
  const problema = revisarFormulario(formulario, alumnos, id)
  if (problema !== undefined) throw new Error(problema)

  await repos.alumnos.editar(id, aDatos(formulario))
}

/**
 * Da de baja a un alumno. Nada suyo se borra: su asistencia y sus
 * calificaciones se quedan, y sigue apareciendo en los trimestres que ya se
 * cerraron (D-026).
 */
export async function darDeBajaAlumno(id: Id): Promise<void> {
  await repos.alumnos.darDeBaja(id)
}

/** Deshace una baja. */
export async function reactivarAlumno(id: Id): Promise<void> {
  await repos.alumnos.reactivar(id)
}

/** Los que siguen en el grupo y los que se dieron de baja, separados. */
export function separarBajas(alumnos: readonly Alumno[]): {
  vigentes: Alumno[]
  bajas: Alumno[]
} {
  return {
    vigentes: alumnos.filter((a) => a.deleted_at === null),
    bajas: alumnos.filter((a) => a.deleted_at !== null),
  }
}
