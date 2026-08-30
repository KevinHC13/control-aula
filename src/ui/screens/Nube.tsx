import { useEffect, useState } from 'react'

import {
  entrar,
  hayNube,
  pendientes as contarPendientes,
  restaurarDeLaNube,
  salir,
  type Sesion,
  sesion as sesionGuardada,
  subirPendientes,
} from '@/application/sincronia'
import type { ConteoPorTabla } from '@/data/ports/respaldo'
import { IconoAtras } from '@/ui/components/iconos'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { plural } from '@/ui/lib/plural'

/**
 * La copia en la nube: subir lo pendiente y restaurar todo.
 *
 * **El login vive aquí y en ningún otro lado** (D-023). Pasar lista, calificar y
 * anotar en la bitácora no piden nada a nadie; la cuenta se pide en el momento en
 * que los datos van a salir del iPad, que es el único momento en que hace falta.
 * Y se pide una vez: la sesión queda guardada en el dispositivo.
 *
 * Sin nube configurada la pantalla lo dice y no ofrece nada. Sin sesión, ofrece
 * entrar. Con sesión, las dos operaciones —y ninguna más: no hay merge (D-006)—.
 */
export function Nube({ alVolver }: { alVolver: () => void }) {
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [revisandoSesion, setRevisandoSesion] = useState(true)
  const [porSubir, setPorSubir] = useState<number | null>(null)

  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [entrando, setEntrando] = useState(false)

  const [trabajando, setTrabajando] = useState<'subir' | 'restaurar' | null>(null)
  const [confirmandoRestaurar, setConfirmandoRestaurar] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [conteo, setConteo] = useState<ConteoPorTabla | null>(null)

  // Al abrir: si hay sesión guardada y cuántos cambios esperan. Es lectura, no
  // sincronía —abrir esta pantalla no sube nada por su cuenta—.
  useEffect(() => {
    let vivo = true
    void (async () => {
      const [guardada, cuantos] = await Promise.all([sesionGuardada(), contarPendientes()])
      if (!vivo) return
      setSesion(guardada)
      setPorSubir(cuantos)
      setRevisandoSesion(false)
    })()
    return () => {
      vivo = false
    }
  }, [])

  async function conectar() {
    setEntrando(true)
    setError(null)
    try {
      setSesion(await entrar(correo, contrasena))
      // La contraseña no se queda en memoria más de lo necesario.
      setContrasena('')
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo entrar')
    } finally {
      setEntrando(false)
    }
  }

  async function subir() {
    setTrabajando('subir')
    setError(null)
    setAviso(null)
    try {
      const { subidos, pendientes } = await subirPendientes()
      setPorSubir(pendientes)
      setAviso(
        subidos === 0
          ? 'No había nada por subir.'
          : `Subidos ${subidos} ${plural(subidos, 'cambio', 'cambios')}.` +
            (pendientes > 0 ? ` Quedan ${pendientes}.` : ''),
      )
    } catch (fallo) {
      // La cola queda intacta: el siguiente intento empieza donde este se quedó.
      setError(
        `${fallo instanceof Error ? fallo.message : 'No se pudo subir'}. Nada se perdió: los cambios siguen en la cola.`,
      )
      setPorSubir(await contarPendientes())
    } finally {
      setTrabajando(null)
    }
  }

  async function restaurar() {
    setTrabajando('restaurar')
    setError(null)
    setAviso(null)
    setConfirmandoRestaurar(false)
    try {
      setConteo(await restaurarDeLaNube())
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo restaurar')
    } finally {
      setTrabajando(null)
    }
  }

  return (
    <section aria-labelledby="titulo-nube" className="flex flex-col gap-6">
      <header className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={alVolver} aria-label="Volver a Ajustes">
          <IconoAtras className="size-6" />
        </Button>
        <h1 id="titulo-nube" className="text-2xl font-bold text-tinta">
          Copia en la nube
        </h1>
      </header>

      {!hayNube() ? (
        <p className="text-base text-tinta-2">
          Este dispositivo no tiene configurada la copia en la nube. La aplicación funciona
          igual sin ella, y el respaldo en archivo sigue disponible en Grupo → Ajustes →
          Respaldo.
        </p>
      ) : revisandoSesion ? (
        <p className="text-base text-tinta-2" aria-live="polite">
          Cargando…
        </p>
      ) : sesion === null ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void conectar()
          }}
        >
          <p className="text-base text-tinta-2">
            La cuenta solo se necesita para subir o restaurar la información. Se pide una
            sola vez y queda guardada en este dispositivo. Todo lo demás de la aplicación
            funciona sin iniciar sesión.
          </p>
          <label htmlFor="correo" className="text-base font-medium text-tinta">
            Correo
          </label>
          <Input
            id="correo"
            type="email"
            inputMode="email"
            autoComplete="username"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
          <label htmlFor="contrasena" className="text-base font-medium text-tinta">
            Contraseña
          </label>
          <Input
            id="contrasena"
            type="password"
            autoComplete="current-password"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
          />
          <Button
            type="submit"
            className="self-start"
            disabled={entrando || correo.trim() === '' || contrasena === ''}
          >
            {entrando ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-base text-tinta">
              Sesión iniciada como <strong className="font-medium">{sesion.correo}</strong>
            </p>
            <Button
              variant="ghost"
              onClick={() => void salir().then(() => setSesion(null))}
              className="text-tinta-2"
            >
              Salir
            </Button>
          </div>

          <section aria-labelledby="titulo-subir" className="flex flex-col gap-2">
            <h2 id="titulo-subir" className="text-base font-medium text-tinta">
              Subir lo capturado
            </h2>
            <p className="cifra text-4xl font-semibold text-tinta" aria-live="polite">
              {porSubir ?? '—'}
            </p>
            {/* El renglón nombra la cifra de arriba, como el contador de presentes
                nombra la suya. Antes se leía «cambios en espera» —sin número, porque
                la cifra vive dos renglones más arriba— y encima explicaba por dónde
                viajan los datos, que no es asunto de quien mira. */}
            <p className="text-[13px] text-tinta-2">
              {porSubir === 0
                ? 'toda la información está respaldada en la nube'
                : `${plural(porSubir ?? 0, 'cambio', 'cambios')} sin respaldar`}
            </p>
            <Button
              className="self-start"
              disabled={trabajando !== null || porSubir === 0}
              onClick={() => void subir()}
            >
              {trabajando === 'subir' ? 'Subiendo…' : 'Subir pendientes'}
            </Button>
          </section>

          <section aria-labelledby="titulo-restaurar" className="flex flex-col gap-2">
            <h2 id="titulo-restaurar" className="text-base font-medium text-tinta">
              Restaurar de la nube
            </h2>
            <p className="text-base text-tinta-2">
              Trae toda la información guardada en la nube a este iPad. Está pensado para
              un dispositivo nuevo o una reinstalación, no para el uso diario: lo que esté aquí y no allá <strong className="font-medium">no</strong>{' '}
              se borra, pero lo que esté en las dos partes queda como diga la nube.
            </p>

            {confirmandoRestaurar ? (
              <div
                role="alertdialog"
                aria-label="Confirmar la restauración"
                className="flex flex-col gap-3 rounded-md border-l-[7px] border-rojo bg-rojo/5 px-4 py-3"
              >
                <p className="text-base text-tinta">
                  Si este iPad tiene información más reciente que la copia en la nube y
                  todavía no se ha subido, al restaurar se reemplazará. Conviene subir
                  primero.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="destructive" onClick={() => void restaurar()}>
                    Restaurar de todos modos
                  </Button>
                  <Button variant="outline" onClick={() => setConfirmandoRestaurar(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="self-start"
                disabled={trabajando !== null}
                onClick={() => setConfirmandoRestaurar(true)}
              >
                {trabajando === 'restaurar' ? 'Restaurando…' : 'Restaurar de la nube'}
              </Button>
            )}

            {conteo && <Restaurado conteo={conteo} />}
          </section>
        </>
      )}

      {aviso && (
        <p className="text-base text-verde" aria-live="polite">
          {aviso}
        </p>
      )}
      {error && (
        <p className="text-base text-rojo" aria-live="polite">
          {error}
        </p>
      )}
    </section>
  )
}

/** Qué llegó, tabla por tabla. Igual que en el respaldo: sin números no se cree. */
function Restaurado({ conteo }: { conteo: ConteoPorTabla }) {
  const conFilas = Object.entries(conteo).filter(([, cuantas]) => cuantas > 0)
  const total = conFilas.reduce((suma, [, cuantas]) => suma + cuantas, 0)

  return (
    <div className="flex flex-col gap-1" aria-live="polite">
      <p className="text-base text-verde">
        Restaurados <span className="cifra">{total}</span>{' '}
        {plural(total, 'registro', 'registros')}.
      </p>
      <ul className="text-[13px] text-tinta-2">
        {conFilas.map(([tabla, cuantas]) => (
          <li key={tabla}>
            {tabla}: <span className="cifra">{cuantas}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
