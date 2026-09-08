import { useState } from 'react'

import { construirPdf, type DocumentoPdf } from '@/services/pdf'
import { IconoArchivo } from '@/ui/components/iconos'
import { Button } from '@/ui/components/ui/button'
import { entregarArchivo, seCancelo } from '@/ui/lib/archivo'

/**
 * Guardar un reporte en PDF.
 *
 * **Todo reporte lleva este botón** (docs/DECISIONES.md D-031). No es una función
 * de un reporte: es lo que hace que un reporte sirva fuera del iPad —entregarlo en
 * dirección, mandarlo por correo, archivarlo— y un reporte que solo se puede leer
 * en la pantalla obliga a copiarlo a mano, que es exactamente de lo que la
 * aplicación viene a sacar a la maestra.
 *
 * Por eso el botón está aquí y no dentro de una pantalla: agregar un reporte nuevo
 * es escribir su `DocumentoPdf` y poner esta línea. Si exportar costara media
 * pantalla de código, el segundo reporte nacería sin exportar.
 *
 * Recibe una función y no un documento ya armado: construir el PDF de un grupo de
 * treinta cuesta lo suyo, y no hay por qué pagarlo en cada render de una pantalla
 * que se está mirando.
 */
export function BotonGuardarPdf({
  documento,
  nombre,
  deshabilitado = false,
}: {
  documento: () => DocumentoPdf
  /** Con `.pdf`. Se ve en Archivos, así que dice de qué y de cuándo es. */
  nombre: string
  deshabilitado?: boolean
}) {
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      await entregarArchivo(construirPdf(documento()), nombre, 'application/pdf')
    } catch (e) {
      if (!seCancelo(e)) {
        // Con el motivo: «no se pudo» a secas no deja nada que intentar.
        setError(
          e instanceof Error && e.message !== ''
            ? `No se pudo guardar el PDF: ${e.message}`
            : 'No se pudo guardar el PDF',
        )
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        className="self-start"
        onClick={() => void guardar()}
        disabled={deshabilitado || guardando}
      >
        <IconoArchivo className="size-5" />
        {guardando ? 'Guardando…' : 'Guardar en PDF'}
      </Button>
      {error !== null && (
        <p className="text-base text-rojo" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  )
}
