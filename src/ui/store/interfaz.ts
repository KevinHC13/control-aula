import { create } from 'zustand'

import { fechaLocal } from '@/domain/fechas'
import type { Fecha } from '@/domain/values'

export type Pestana = 'asistencia' | 'calificaciones' | 'bitacora' | 'grupo'

/**
 * Estado de interfaz, y solo de interfaz.
 *
 * Zustand es hermano de React, no una capa de datos: aquí **nunca** van alumnos,
 * asistencia, calificaciones ni reportes. Eso vive en IndexedDB y se lee por hook,
 * porque un dato copiado a memoria es un dato que puede quedar desactualizado y
 * mentir en silencio (docs/ARCHITECTURE.md).
 */
interface EstadoInterfaz {
  pestanaActiva: Pestana
  diaSeleccionado: Fecha
  irA: (pestana: Pestana) => void
  seleccionarDia: (fecha: Fecha) => void
}

export const useInterfaz = create<EstadoInterfaz>((set) => ({
  pestanaActiva: 'asistencia',
  // El día del dispositivo, no el de UTC: a las 19:00 en México UTC ya es mañana.
  diaSeleccionado: fechaLocal(new Date()),
  irA: (pestana) => set({ pestanaActiva: pestana }),
  seleccionarDia: (fecha) => set({ diaSeleccionado: fecha }),
}))
