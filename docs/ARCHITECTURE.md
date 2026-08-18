# Arquitectura

Cuatro capas con dependencias en una sola dirección. El objetivo no es la pureza
académica: es que la fuente de datos sea reemplazable sin tocar pantallas, y que
el patrón se pueda reutilizar en proyectos más grandes.

## Estructura

```
src/
├─ domain/                 Tipos y reglas puras
│   ├─ entities.ts             Alumno, RegistroAsistencia, Calificacion, Nota
│   ├─ values.ts               Fecha, Id, EstadoAsistencia
│   └─ rules.ts                promedioDe(), porcentajeAsistencia(), enRiesgo()
│
├─ data/
│   ├─ ports/                  Interfaces (contratos)
│   │   ├─ alumnos.ts
│   │   ├─ asistencia.ts
│   │   ├─ calificaciones.ts
│   │   └─ notas.ts
│   ├─ dexie/                  Implementación actual
│   │   ├─ db.ts                   Esquema y versiones
│   │   ├─ alumnos.adapter.ts
│   │   ├─ asistencia.adapter.ts
│   │   ├─ calificaciones.adapter.ts
│   │   └─ notas.adapter.ts
│   └─ index.ts                Contenedor: única línea que elige adaptadores
│
├─ application/              Casos de uso
│   ├─ asistencia.ts
│   ├─ calificaciones.ts
│   └─ notas.ts
│
└─ ui/
    ├─ hooks/                  Único lugar donde vive la reactividad
    ├─ store/                  Zustand: estado de interfaz
    ├─ components/
    └─ screens/
```

## Reglas de dependencia

Estas cuatro reglas son el contrato. Si una se rompe, la arquitectura no está
comprando nada.

1. `domain/` no importa nada. Ni React, ni Dexie, ni librerías.
2. `application/` importa `domain/` y `data/ports/`. **Nunca** `data/dexie/`.
3. `ui/` importa `application/`, `domain/` y `ui/hooks/`. **Nunca** `data/dexie/`.
4. Solo `data/index.ts` conoce qué adaptador concreto se usa.

Verificación rápida en cualquier momento:

```bash
grep -rn "from.*data/dexie" src/ui src/application
# Debe devolver cero resultados.
```

## Dónde vive la reactividad

Este fue el punto de diseño más discutido. El problema: si los componentes
importan `useLiveQuery` de `dexie-react-hooks`, quedan amarrados a Dexie y
migrar significa reescribir todas las pantallas.

La solución no es renunciar a la reactividad — sin ella hay que invalidar cachés
a mano en cada caso de uso, y olvidar una invalidación produce una UI que miente
en silencio.

La solución es **declarar la suscripción como parte del contrato del puerto**:

```ts
// data/ports/asistencia.ts
import type { Observable } from 'dexie'  // ver nota abajo

export interface AsistenciaRepo {
  porDia(fecha: Fecha): Promise<RegistroAsistencia[]>
  marcar(alumnoId: Id, fecha: Fecha, estado: EstadoAsistencia): Promise<void>
  resumen(desde: Fecha, hasta: Fecha): Promise<ResumenAlumno[]>
  observarDia(fecha: Fecha): Observable<RegistroAsistencia[]>
}
```

Cada implementación resuelve `observarDia` a su manera:

| Adaptador | Cómo |
|---|---|
| Dexie | `liveQuery(() => db.asistencia.where(...).toArray())` |
| Supabase | Suscripción de Realtime |
| SQLite / API | Emisor propio invalidado tras cada escritura |

Nota sobre el tipo `Observable`: Dexie exporta uno compatible con la propuesta
TC39. Para no importar tipos de Dexie en `ports/`, define una interfaz mínima
propia en `domain/values.ts`:

```ts
export interface Suscribible<T> {
  subscribe(next: (valor: T) => void): { unsubscribe(): void }
}
```

El observable de Dexie la satisface sin adaptación.

## Forma de los puertos

Los métodos se nombran por **caso de uso**, no por consulta. Esto importa más
que evitar cualquier import concreto.

```ts
// Bien — el puerto habla del dominio
porDia(fecha: Fecha): Promise<RegistroAsistencia[]>
resumen(desde: Fecha, hasta: Fecha): Promise<ResumenAlumno[]>

// Mal — la semántica de consulta de Dexie se filtra al contrato
find(where: object): Promise<RegistroAsistencia[]>
query(filtro: Filtro): Promise<unknown[]>
```

Con la segunda forma, escribir un adaptador de SQL se vuelve un traductor de
consultas, y la interfaz limpia no habrá servido de nada.

Corolario: **no crear `BaseRepository<T>` ni genéricos especulativos.** Cada
puerto declara exactamente los métodos que alguna pantalla usa hoy.

## El contenedor

```ts
// data/index.ts
import { DexieAlumnosRepo } from './dexie/alumnos.adapter'
import { DexieAsistenciaRepo } from './dexie/asistencia.adapter'

export const repos = {
  alumnos: new DexieAlumnosRepo(),
  asistencia: new DexieAsistenciaRepo(),
} as const
```

Cambiar de fuente de datos = cambiar estas líneas. Nada más.

## Los hooks

Un hook por consulta. Es la única frontera entre React y el mundo reactivo.

```ts
// ui/hooks/useAsistenciaDelDia.ts
export function useAsistenciaDelDia(fecha: Fecha) {
  const [datos, setDatos] = useState<RegistroAsistencia[]>([])

  useEffect(() => {
    const sub = repos.asistencia.observarDia(fecha).subscribe(setDatos)
    return () => sub.unsubscribe()
  }, [fecha])

  return datos
}
```

El componente escribe `useAsistenciaDelDia(dia)` y no sabe qué hay debajo.

## Estado de UI (Zustand)

Zustand es **hermano** de React, no una capa por la que pasen los datos. Si un
dato vive en IndexedDB, no se copia al store.

Contenido permitido:

- `diaSeleccionado`
- `actividadActiva`
- `pestanaActiva`
- `aviso` (mensajes efímeros de confirmación)

Contenido prohibido: alumnos, registros de asistencia, calificaciones, notas.

## Sincronía (fase 2)

El motor de sincronía es un servicio aparte. **No pasa por el repositorio.**

```
Repositorio → Dexie (única fuente de verdad)
                 ↓  outbox
            Motor de sincronía → Supabase (respaldo remoto)
```

Reglas:

- El repositorio **siempre** escribe en Dexie, con red o sin ella. Supabase
  nunca es una implementación alternativa del puerto: eso produciría dos fuentes
  de verdad y condiciones de carrera según el estado de la conexión.
- Un usuario, un dispositivo ⇒ **no hay sincronía bidireccional**. Solo dos
  operaciones: *subir pendientes* y *restaurar todo*. Sin last-write-wins, sin
  vectores de versión, sin resolución de conflictos.
- Se ejecuta al abrir y al cerrar la app. iOS no tiene Background Sync.

## Lo que no está en la arquitectura, y por qué

**TanStack Query.** Con `observarDia` en el puerto no hay invalidación manual, y
una caché en memoria sobre IndexedDB no compra nada. Es la opción correcta
cuando haya red real y latencia real — no aquí.

**Inyección de dependencias formal.** El contenedor es un objeto literal. Un
usuario, sin tests de integración que necesiten mocks distintos por escenario.

**Capa de servicios además de casos de uso.** Sería una indirección sin
contenido.
