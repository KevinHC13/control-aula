/**
 * Los dos íconos que usa la app, en línea. No se instala `lucide-react`: una
 * dependencia entera por dos trazos no se paga, y `currentColor` los deja seguir
 * al token de color de quien los contiene.
 */

const trazo = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export function IconoCalendario({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} {...trazo}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  )
}

export function IconoCerrar({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} {...trazo}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
