import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'

function App() {
  return (
    <main className="min-h-dvh p-6">
      <h1 className="text-2xl font-bold text-azul">Palomita</h1>
      <p className="mt-2 text-base text-tinta-2">
        Cimientos listos. La pantalla de asistencia llega en C6.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button>Presente</Button>
        <Button variant="destructive">Ausente</Button>
        <Button variant="outline">Retardo</Button>
      </div>

      <Input className="mt-6 max-w-sm" placeholder="Campo de prueba" />

      <p className="cifra mt-6 text-4xl font-medium text-tinta">28 / 30</p>
    </main>
  )
}

export default App
