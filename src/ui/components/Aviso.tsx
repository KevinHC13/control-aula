import { cn } from '@/ui/lib/utils'

/**
 * La banda con el borde izquierdo de 7 px, en sus cuatro tonos.
 *
 * Es el mismo gesto que la barra de color de la fila de asistencia, y por eso se
 * lee como parte del producto y no como un cuadro de diálogo de sistema. Estaba
 * escrita a mano en unas quince partes, con dos componentes `Aviso` locales
 * —`CargarLista` y `CicloEscolar`— que eran el mismo código.
 *
 * `role` va según el tono, no como decoración: `alert` interrumpe la lectura de un
 * lector de pantalla y `status` no, así que un error lo lleva y un dato informativo
 * no debe llevarlo.
 */
const TONOS = {
  error: { caja: 'border-rojo bg-rojo/5 text-tinta', papel: 'alert' },
  atencion: { caja: 'border-ambar bg-ambar/5 text-tinta', papel: 'status' },
  logro: { caja: 'border-verde bg-verde/5 text-tinta', papel: 'status' },
  dato: { caja: 'border-marca bg-marca/5 text-tinta', papel: undefined },
  apagado: { caja: 'border-linea bg-cuadro text-tinta-2', papel: undefined },
} as const

export type TonoDeAviso = keyof typeof TONOS

export function Aviso({
  tono = 'dato',
  titulo,
  children,
  acciones,
  className,
}: {
  tono?: TonoDeAviso
  /** Se destaca sobre el cuerpo. Un aviso de una sola frase no lo necesita. */
  titulo?: string
  children?: React.ReactNode
  /** Los botones del aviso, cuando pide una decisión. */
  acciones?: React.ReactNode
  className?: string
}) {
  const { caja, papel } = TONOS[tono]

  return (
    <div
      role={papel}
      className={cn(
        'flex flex-col gap-2 rounded-md border-l-[7px] px-4 py-3 text-base',
        caja,
        className,
      )}
    >
      {titulo !== undefined && <p className="font-medium text-tinta">{titulo}</p>}
      {children !== undefined && <div>{children}</div>}
      {acciones !== undefined && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  )
}

/**
 * El aviso que pide confirmar algo que no se puede deshacer.
 *
 * Es un `alertdialog` en el sitio y no un modal a propósito: lo que se va a
 * perder está a la vista detrás del aviso, y taparlo con una ventana es
 * exactamente lo que no conviene en el momento de decidir.
 */
export function Confirmacion({
  etiqueta,
  children,
  acciones,
}: {
  /** Qué se está confirmando, para quien no ve la banda roja. */
  etiqueta: string
  children: React.ReactNode
  acciones: React.ReactNode
}) {
  return (
    <div
      role="alertdialog"
      aria-label={etiqueta}
      className="flex flex-col gap-3 rounded-md border-l-[7px] border-rojo bg-rojo/5 px-4 py-3"
    >
      <div className="text-base text-tinta">{children}</div>
      <div className="flex flex-wrap gap-2">{acciones}</div>
    </div>
  )
}
