import type { NuevoAlumno } from '@/data/ports/alumnos'
import { repos } from '@/data'
import { curpValido, fechaDeCurp, normalizarCurp, sexoDeCurp } from '@/domain/curp'
import type { Alumno } from '@/domain/entities'
import { fechaValida } from '@/domain/fechas'
import { comoSexo, type Id } from '@/domain/values'

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
 *
 * **Sin número de lista** (docs/DECISIONES.md D-033): dejó de ser un dato que
 * la maestra elija o corrija. El adaptador lo asigna internamente al dar de
 * alta y lo conserva sin tocar al corregir; lo que ella ve en cada renglón es
 * la posición alfabética que calcula `lista()`/`conBajas()`, no este valor.
 */

/** Lo que la pantalla edita: todo como texto, incluida la fecha. */
export interface FormularioAlumno {
  nombre: string
  fecha_nacimiento: string
  curp: string
  /** `'H'`, `'M'` o vacío. Vacío es «sin asignar», y es una opción legítima. */
  sexo: string
}

/** El formulario vacío para un alta. */
export function formularioNuevo(): FormularioAlumno {
  return {
    nombre: '',
    fecha_nacimiento: '',
    curp: '',
    sexo: '',
  }
}

/** El formulario de un alumno que ya existe, para corregirlo. */
export function formularioDe(alumno: Alumno): FormularioAlumno {
  return {
    nombre: alumno.nombre,
    fecha_nacimiento: alumno.fecha_nacimiento ?? '',
    curp: alumno.curp ?? '',
    sexo: alumno.sexo ?? '',
  }
}

/**
 * El formulario después de escribir en un campo, con la fecha rellenada desde la
 * CURP si estaba vacía.
 *
 * Vive aquí y no en la pantalla porque es la misma regla que aplica la carga de
 * la lista: lo escrito gana, la CURP rellena. Rellena y no sobrescribe —quien ya
 * puso una fecha la puso por algo—, y solo cuando la CURP está completa y bien
 * formada, para no ir cambiando la fecha a cada tecla.
 *
 * Vale para las dos cosas que la CURP trae dentro: la fecha de nacimiento y el
 * sexo. Es lo que hace que teclear la CURP del alumno que llegó en noviembre
 * deje los dos campos puestos sin escribirlos.
 */
export function editarFormulario(
  formulario: FormularioAlumno,
  campo: keyof FormularioAlumno,
  valor: string,
): FormularioAlumno {
  const siguiente = { ...formulario, [campo]: valor }
  if (campo !== 'curp') return siguiente

  const curp = normalizarCurp(valor)

  return {
    ...siguiente,
    curp,
    fecha_nacimiento: siguiente.fecha_nacimiento || (fechaDeCurp(curp) ?? ''),
    sexo: siguiente.sexo || (sexoDeCurp(curp) ?? ''),
  }
}

/**
 * Qué está mal en el formulario, o `undefined` si se puede guardar. El mensaje
 * se muestra tal cual: aquí no hay nadie leyendo la consola.
 */
export function revisarFormulario(formulario: FormularioAlumno): string | undefined {
  if (formulario.nombre.trim() === '') return 'Falta el nombre'

  if (formulario.fecha_nacimiento !== '' && !fechaValida(formulario.fecha_nacimiento)) {
    return 'La fecha debe ser AAAA-MM-DD'
  }

  if (formulario.curp !== '' && !curpValido(formulario.curp)) {
    return 'El CURP debe traer 18 caracteres'
  }

  return undefined
}

/** La conversión al tipo del dominio. La fecha vacía es un dato ausente. */
function aDatos(formulario: FormularioAlumno): NuevoAlumno {
  return {
    nombre: formulario.nombre.trim(),
    fecha_nacimiento:
      formulario.fecha_nacimiento === '' ? null : formulario.fecha_nacimiento,
    curp: formulario.curp === '' ? null : normalizarCurp(formulario.curp),
    sexo: comoSexo(formulario.sexo),
  }
}

/**
 * Da de alta a un alumno. Vuelve a validar antes de escribir: la pantalla ya lo
 * hizo, pero el caso de uso no puede confiar en que alguien lo llame bien.
 */
export async function agregarAlumno(formulario: FormularioAlumno): Promise<void> {
  const problema = revisarFormulario(formulario)
  if (problema !== undefined) throw new Error(problema)

  await repos.alumnos.agregar(aDatos(formulario))
}

/** Corrige a un alumno, conservando su `id` y con él toda su historia. */
export async function editarAlumno(id: Id, formulario: FormularioAlumno): Promise<void> {
  const problema = revisarFormulario(formulario)
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
