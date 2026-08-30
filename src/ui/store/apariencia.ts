import { create } from 'zustand'

import {
  type Apariencia,
  leerApariencia,
  type ModoDeColor,
  POR_OMISION,
  type TamanoDeTexto,
} from '@/ui/lib/tema'

/**
 * Cómo se ve la aplicación, según quien la usa.
 *
 * **Store aparte de `interfaz.ts`, y no un campo más ahí.** No es capricho de
 * orden: `interfaz.test.ts` afirma las claves exactas de aquel store para que nadie
 * le meta datos del salón, y una preferencia de apariencia no es estado de
 * navegación —vive entre sesiones, esto se guarda y aquello no—. Mezclarlos habría
 * obligado a aflojar la prueba que protege la regla.
 *
 * Se persiste a mano en vez de con el middleware `persist`: son cinco campos y una
 * clave, y `leerApariencia` ya hace la validación campo por campo que hace falta
 * para que un valor corrupto no deje la aplicación sin color.
 */
const CLAVE = 'palomita.apariencia'

function guardar(apariencia: Apariencia) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(apariencia))
  } catch {
    // Modo privado, cuota llena, almacenamiento bloqueado. La apariencia vale para
    // esta sesión y se pierde al cerrar; no es motivo para romper nada.
  }
}

function recuperar(): Apariencia {
  try {
    return leerApariencia(localStorage.getItem(CLAVE))
  } catch {
    return POR_OMISION
  }
}

interface EstadoApariencia extends Apariencia {
  elegirColor: (color: string) => void
  elegirModo: (modo: ModoDeColor) => void
  elegirTamano: (tamano: TamanoDeTexto) => void
  alternarCuadricula: (encendida: boolean) => void
  nombrarGrupo: (nombre: string) => void
}

export const useApariencia = create<EstadoApariencia>((set, get) => {
  /** Toda escritura pasa por aquí: no hay forma de cambiar algo y no guardarlo. */
  const cambiar = (parte: Partial<Apariencia>) => {
    set(parte)
    // Se arma campo por campo en vez de quitarle las acciones al estado: así, el
    // día que se agregue una preferencia, TypeScript obliga a nombrarla aquí en
    // lugar de dejarla sin guardar en silencio.
    const s = get()
    guardar({
      color: s.color,
      modo: s.modo,
      tamano: s.tamano,
      cuadricula: s.cuadricula,
      nombreDelGrupo: s.nombreDelGrupo,
    })
  }

  return {
    ...recuperar(),
    elegirColor: (color) => cambiar({ color }),
    elegirModo: (modo) => cambiar({ modo }),
    elegirTamano: (tamano) => cambiar({ tamano }),
    alternarCuadricula: (cuadricula) => cambiar({ cuadricula }),
    nombrarGrupo: (nombreDelGrupo) => cambiar({ nombreDelGrupo }),
  }
})
