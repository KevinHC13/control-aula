import {
  dentroDeLaVentana,
  diasHasta,
  edadEn,
  proximoCumpleanos,
} from '@/domain/cumpleanos'
import type { Alumno } from '@/domain/entities'
import { porNombre } from '@/domain/orden'
import type { Fecha } from '@/domain/values'

/**
 * El aviso de cumpleaños: quién cumple hoy y quién cumple esta semana.
 *
 * No hay tabla ni lectura nueva: sale de `Alumno.fecha_nacimiento`, que existe
 * desde el primer commit y llena la carga de lista. Por eso también **funciona sin
 * red** sin tener que hacer nada especial: es una cuenta sobre lo que ya está en el
 * dispositivo.
 */

/** La ventana del aviso: hoy y los seis días siguientes. */
export const DIAS_DE_LA_VENTANA = 7

/** Un cumpleaños por venir, con lo que hace falta para escribirlo. */
export interface Cumpleanos {
  alumno: Alumno
  /** El día que cae, con el año que le toca. */
  fecha: Fecha
  /** Cuántos años cumple ese día. */
  cumple: number
  /** Días desde hoy. Cero es hoy. */
  faltan: number
}

/**
 * Los cumpleaños de la ventana, del más próximo al más lejano.
 *
 * Un alumno sin `fecha_nacimiento` simplemente no aparece: es lo más común en una
 * lista cargada de un PDF que no traía fechas, y pedirla para poder usar la app
 * sería cobrarle treinta capturas por un aviso.
 *
 * Función pura: recibe el grupo y el día, y no lee nada.
 */
export function cumpleanosProximos(
  alumnos: readonly Alumno[],
  hoy: Fecha,
  cuantos: number = DIAS_DE_LA_VENTANA,
): Cumpleanos[] {
  return alumnos
    .filter((a) => a.fecha_nacimiento !== null)
    .map((alumno) => {
      const fecha = proximoCumpleanos(alumno.fecha_nacimiento!, hoy)
      return {
        alumno,
        fecha,
        cumple: edadEn(alumno.fecha_nacimiento!, fecha),
        faltan: diasHasta(hoy, fecha),
      }
    })
    .filter((c) => dentroDeLaVentana(hoy, c.fecha, cuantos))
    // Desempate por apellido, igual que el resto del grupo: dos cumpleaños el
    // mismo día se dicen en el orden en que se lee la lista.
    .sort((a, b) => a.faltan - b.faltan || porNombre(a.alumno, b.alumno))
}

/** Los de hoy, que son los que se dicen en voz alta al empezar la clase. */
export function cumpleanosDeHoy(cumpleanos: readonly Cumpleanos[]): Cumpleanos[] {
  return cumpleanos.filter((c) => c.faltan === 0)
}
