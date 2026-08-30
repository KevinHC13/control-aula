/**
 * Los íconos que usa la app, en línea. No se instala `lucide-react`: una
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

export function IconoAnterior({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} {...trazo}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

export function IconoSiguiente({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} {...trazo}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

export function IconoEngrane({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} {...trazo}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export function IconoAtras({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} {...trazo}>
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  )
}

export function IconoBasura({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} {...trazo}>
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" />
    </svg>
  )
}

/** Retroceso: la tecla de borrar del teclado numérico. */
export function IconoBorrar({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} {...trazo}>
      <path d="M9 5h10a2 2 0 012 2v10a2 2 0 01-2 2H9L2 12l7-7z" />
      <path d="M12 9l5 6M17 9l-5 6" />
    </svg>
  )
}

/* Los cuatro de la barra de pestañas. Van con la etiqueta debajo, nunca solos: un
   icono sin palabra se adivina, y esta barra es el objetivo más tocado de la
   aplicación. Lo que aportan es que la sección se reconozca sin leer. */

/** Asistencia: la palomita del nombre, sobre la lista. */
export function IconoLista({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} {...trazo}>
      <path d="M4 6h9M4 12h6M4 18h5" />
      <path d="M14 15l3 3 5-7" />
    </svg>
  )
}

/** Calificaciones: el cuaderno con su marca. */
export function IconoCuaderno({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} {...trazo}>
      <path d="M6 3h11a2 2 0 012 2v14a2 2 0 01-2 2H6z" />
      <path d="M6 3v18M9.5 8h6M9.5 12h6" />
    </svg>
  )
}

/** Bitácora: lo que se anota. */
export function IconoAnotacion({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} {...trazo}>
      <path d="M4 5h16v11a3 3 0 01-3 3H4z" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  )
}

/** Grupo: los que están en el salón. */
export function IconoGrupo({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} {...trazo}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" />
      <path d="M16 6.5a3 3 0 010 5.5M17.5 15.5c2.2.6 3.5 2.1 3.5 4.5" />
    </svg>
  )
}
