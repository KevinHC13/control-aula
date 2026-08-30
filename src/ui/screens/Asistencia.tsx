import { useMemo, useState } from 'react'

import { type FilaAsistencia, marcarEstado, pasarLista } from '@/application/asistencia'
import { faltaAbrirTrimestre, trimestreDe } from '@/application/evaluacion'
import { fechaLocal, mesDe } from '@/domain/fechas'
import type { Fecha } from '@/domain/values'
import { AvisoCumpleanos } from '@/ui/components/AvisoCumpleanos'
import { CalendarioMes } from '@/ui/components/CalendarioMes'
import { ContadorPresentes } from '@/ui/components/ContadorPresentes'
import { EtiquetaTrimestre } from '@/ui/components/EtiquetaTrimestre'
import { FilaAlumno } from '@/ui/components/FilaAlumno'
import { TiraDeDias } from '@/ui/components/TiraDeDias'
import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { useAsistenciaDelDia } from '@/ui/hooks/useAsistenciaDelDia'
import { useAsistenciaDelMes } from '@/ui/hooks/useAsistenciaDelMes'
import { useCicloEnCurso } from '@/ui/hooks/useCicloEnCurso'
import { cn } from '@/ui/lib/utils'
import { ModoParticipacion } from '@/ui/screens/ModoParticipacion'
import { Sorteo } from '@/ui/screens/Sorteo'
import { useInterfaz } from '@/ui/store/interfaz'

export function Asistencia() {
  const diaSeleccionado = useInterfaz((s) => s.diaSeleccionado)
  const seleccionarDia = useInterfaz((s) => s.seleccionarDia)
  const irA = useInterfaz((s) => s.irA)
  const { filas, cargando } = useAsistenciaDelDia(diaSeleccionado)
  const { ciclo, cargando: cargandoCiclo } = useCicloEnCurso()

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

  /**
   * El modo participación: con el interruptor prendido, tocar a un alumno le suma
   * una participación en vez de ciclar su asistencia (D-020).
   *
   * Se guarda **el día en que se prendió**, no un booleano, y el modo está
   * prendido solo si ese día sigue siendo el que se está viendo. Así se apaga solo
   * al cambiar de día sin un efecto que lo apague —el modo es para la clase que
   * está ocurriendo; hojear otro día es consultar, no capturar—.
   *
   * Y es estado local, no del store: eso es lo que lo apaga al salir de la
   * pantalla. Guardarlo en Zustand sería dejarlo prendido esperando a que ella
   * vuelva y pase lista sin darse cuenta.
   */
  const [modoDesde, setModoDesde] = useState<Fecha | null>(null)
  const participacion = modoDesde === diaSeleccionado

  // El sorteo vive en un diálogo y su contenido se monta solo cuando está abierto:
  // con el diálogo cerrado no hay ni una suscripción de participaciones abierta.
  const [sorteoAbierto, setSorteoAbierto] = useState(false)

  function abrirCalendario() {
    setMesVisible(mesDe(diaSeleccionado))
    setCalendarioAbierto(true)
  }

  function seleccionarDesdeCalendario(fecha: Fecha) {
    seleccionarDia(fecha)
    setCalendarioAbierto(false)
  }

  const diaSinRegistrar = filas.some((f) => !f.registrado)
  const sinAlumnos = !cargando && filas.length === 0

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
              Azul: el día se pasó completo y sin faltas. Rojo: hay faltas registradas.
              Sin color: la lista de ese día todavía no se pasa. Seleccione un día para
              abrirlo.
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

      {/* Va después de la tira de días y antes de los controles: se lee de paso,
          en el camino a pasar lista, y no pide nada. El día que se mira es el que
          manda —hojear el jueves enseña los cumpleaños de ese jueves—. */}
      <AvisoCumpleanos alumnos={filas.map((f) => f.alumno)} hoy={diaSeleccionado} />

      {/* Los dos controles de participación, juntos: el interruptor va antes del
          contador porque cambia lo que el contador significa, y el sorteo va al
          lado porque es la otra forma de llegar a lo mismo. Apagados no cuestan
          ni un toque a quien pasa lista y se va. */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={participacion}
          onClick={() => setModoDesde(participacion ? null : diaSeleccionado)}
          className={cn(
            'flex min-h-11 items-center gap-2 rounded-md border px-3 text-base',
            'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
            participacion
              ? 'border-verde bg-verde text-papel'
              : 'border-linea text-tinta-2 hover:bg-cuadro',
          )}
        >
          {participacion ? 'Marcando participación' : 'Marcar participación'}
        </button>

        <button
          type="button"
          onClick={() => setSorteoAbierto(true)}
          className={cn(
            'flex min-h-11 items-center gap-2 rounded-md border border-linea px-3 text-base',
            'text-tinta-2 outline-none hover:bg-cuadro',
            'focus-visible:ring-[3px] focus-visible:ring-ring/50',
          )}
        >
          Sortear quién pasa
        </button>
      </div>

      <Dialog open={sorteoAbierto} onOpenChange={setSorteoAbierto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>¿Quién pasa?</DialogTitle>
            <DialogDescription>
              Aparece un nombre al azar entre los alumnos presentes. Después se indica si
              participó: solo entonces se registra.
            </DialogDescription>
          </DialogHeader>

          {/* El contenido se monta con el diálogo: al cerrarlo se sueltan sus
              suscripciones y el siguiente sorteo empieza limpio. */}
          {sorteoAbierto && (
            <Sorteo
              fecha={diaSeleccionado}
              trimestre={trimestreDe(diaSeleccionado, ciclo)}
            />
          )}
        </DialogContent>
      </Dialog>

      {participacion ? (
        <ModoParticipacion
          fecha={diaSeleccionado}
          trimestre={trimestreDe(diaSeleccionado, ciclo)}
        />
      ) : sinAlumnos ? (
        /* Sin lista, el contador y la etiqueta del trimestre no dicen nada: lo que
           hace falta es cargar el grupo. Por eso el vacío los **sustituye** en vez
           de esperar debajo de ellos, y lleva el botón en vez de solo describir el
           camino. */
        <div className="flex flex-col items-start gap-3 pt-2">
          <p className="text-base text-tinta">Todavía no hay alumnos en el grupo.</p>
          <p className="text-[13px] text-tinta-2">
            La lista se carga una sola vez al empezar el ciclo, desde Ajustes. Puede
            leerse de un archivo de Excel, de un PDF o de una fotografía de la lista
            oficial.
          </p>
          <Button onClick={() => irA('grupo')}>Cargar la lista del grupo</Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <ContadorPresentes filas={filas} />
            {/* A qué trimestre va lo que se capture hoy. Informa, no pregunta: la
                atribución es por fecha y nunca manual. */}
            <EtiquetaTrimestre
              trimestre={trimestreDe(diaSeleccionado, ciclo)}
              hayCiclo={ciclo !== null}
              sinAbrir={faltaAbrirTrimestre(diaSeleccionado, ciclo)}
              cargando={cargandoCiclo}
            />
            {/* La instrucción de la pantalla más usada de la app. No cuesta un
                toque —es texto— y sin ella el ciclo de cuatro estados hay que
                descubrirlo tocando. */}
            {filas.length > 0 && (
              <p className="text-[13px] text-tinta-2">
                Todos los alumnos empiezan como presentes. Toque el nombre de quien faltó
                para ir cambiando su estado: ausente, retardo y falta justificada.
              </p>
            )}
          </div>

          {/* -mx-4 para que la barra de color toque el borde de la pantalla: es lo
              que hace que la columna bicolor se lea de corrido. */}
          <ul className="-mx-4 border-t border-linea">
            {filas.map((fila) => (
              <li key={fila.alumno.id}>
                <FilaAlumno fila={fila} alTocar={() => void alTocar(fila)} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
