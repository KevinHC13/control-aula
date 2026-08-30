import { AvisoActualizacion } from '@/ui/components/AvisoActualizacion'
import { BarraPestanas } from '@/ui/components/BarraPestanas'
import { Asistencia } from '@/ui/screens/Asistencia'
import { Bitacora } from '@/ui/screens/Bitacora'
import { Calificaciones } from '@/ui/screens/Calificaciones'
import { Grupo } from '@/ui/screens/Grupo'
import { type Pestana, useInterfaz } from '@/ui/store/interfaz'

/**
 * Sin router en la v1: cuatro pantallas manejadas con estado. Un router traería
 * historial, rutas anidadas y deep links que esta app no usa, y en una PWA
 * instalada el botón de atrás del navegador ni existe (docs/UX.md).
 */
const PANTALLAS: Record<Pestana, () => React.JSX.Element> = {
  asistencia: Asistencia,
  calificaciones: Calificaciones,
  bitacora: Bitacora,
  grupo: Grupo,
}

export function App() {
  const pestanaActiva = useInterfaz((s) => s.pestanaActiva)
  const Pantalla = PANTALLAS[pestanaActiva]

  return (
    <div className="min-h-dvh bg-papel">
      {/* pb-24 reserva el alto de la barra fija: sin esto la última fila de la
          lista queda tapada justo cuando hay 30 alumnos. */}
      <main className="px-4 pt-6 pb-24">
        {/* Dentro del `main` y no antes: el aviso es pegajoso y se sangra con
            `-mx-4` para tocar los bordes, y eso solo cuadra dentro del contenedor
            que tiene el `px-4`. */}
        <AvisoActualizacion />
        <Pantalla />
      </main>
      <BarraPestanas />
    </div>
  )
}
