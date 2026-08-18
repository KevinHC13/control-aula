import { useMemo, useState } from 'react'

import { type FilaAsistencia, marcarEstado, pasarLista } from '@/application/asistencia'
import { fechaLocal, mesDe } from '@/domain/fechas'
import type { Fecha } from '@/domain/values'
import { CalendarioMes } from '@/ui/components/CalendarioMes'
import { ContadorPresentes } from '@/ui/components/ContadorPresentes'
import { FilaAlumno } from '@/ui/components/FilaAlumno'
import { TiraDeDias } from '@/ui/components/TiraDeDias'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { useAsistenciaDelDia } from '@/ui/hooks/useAsistenciaDelDia'
import { useAsistenciaDelMes } from '@/ui/hooks/useAsistenciaDelMes'
import { useInterfaz } from '@/ui/store/interfaz'

export function Asistencia() {
  const diaSeleccionado = useInterfaz((s) => s.diaSeleccionado)
  const seleccionarDia = useInterfaz((s) => s.seleccionarDia)
  const { filas, cargando } = useAsistenciaDelDia(diaSeleccionado)

  // Se calcula una vez por montaje: si la app queda abierta al cruzar la
  // medianoche, "hoy" se corrige al volver a entrar, que es cuando importa.
  const hoy = useMemo(() => fechaLocal(new Date()), [])

  // Estado local y no del store: el calendario vive y muere con el diálogo, no
  // cruza pantallas (docs/ARCHITECTURE.md).
  const [calendarioAbierto, setCalendarioAbierto] = useState(false)
  const [mesVisible, setMesVisible] = useState(() => mesDe(diaSeleccionado))
  // Suscrito siempre: así el mosaico ya está pintado cuando el diálogo abre, en
  // vez de aparecer vacío un cuadro.
  const { dias } = useAsistenciaDelMes(mesVisible)

  function abrirCalendario() {
    setMesVisible(mesDe(diaSeleccionado))
    setCalendarioAbierto(true)
  }

  function seleccionarDesdeCalendario(fecha: Fecha) {
    seleccionarDia(fecha)
    setCalendarioAbierto(false)
  }

  const diaSinRegistrar = filas.some((f) => !f.registrado)

  async function alTocar(fila: FilaAsistencia) {
    // El primer toque del día lo materializa completo: los demás quedan
    // registrados en presente y el porcentaje de todos compara lo mismo
    // (docs/DECISIONES.md D-013). Es idempotente, así que del segundo toque en
    // adelante no escribe nada extra.
    if (diaSinRegistrar) await pasarLista(diaSeleccionado)
    await marcarEstado(fila.alumno.id, diaSeleccionado, fila.estado)
  }

  return (
    <section aria-labelledby="titulo-asistencia" className="flex flex-col gap-4">
      <h1 id="titulo-asistencia" className="sr-only">
        Asistencia
      </h1>

      <TiraDeDias
        diaSeleccionado={diaSeleccionado}
        hoy={hoy}
        alSeleccionar={seleccionarDia}
        alAbrirCalendario={abrirCalendario}
      />

      <Dialog open={calendarioAbierto} onOpenChange={setCalendarioAbierto}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Calendario</DialogTitle>
            <DialogDescription>
              Un día azul se capturó completo; uno rojo tiene faltas; uno hueco todavía no se
              pasa. Toca un día para verlo.
            </DialogDescription>
          </DialogHeader>

          <CalendarioMes
            mesVisible={mesVisible}
            dias={dias}
            diaSeleccionado={diaSeleccionado}
            hoy={hoy}
            alCambiarMes={setMesVisible}
            alSeleccionar={seleccionarDesdeCalendario}
          />
        </DialogContent>
      </Dialog>

      <ContadorPresentes filas={filas} />

      {/* -mx-4 para que la barra de color toque el borde de la pantalla: es lo
          que hace que la columna bicolor se lea de corrido. */}
      <ul className="-mx-4 border-t border-linea">
        {filas.map((fila) => (
          <li key={fila.alumno.id}>
            <FilaAlumno fila={fila} alTocar={() => void alTocar(fila)} />
          </li>
        ))}
      </ul>

      {!cargando && filas.length === 0 && (
        <p className="text-base text-tinta-2">
          Todavía no hay alumnos. La lista se carga desde el archivo del grupo.
        </p>
      )}
    </section>
  )
}
