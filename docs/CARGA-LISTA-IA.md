# Cargar la lista de alumnos desde un archivo, con IA

> **Estado: implementado el 2026-08-18.** Queda como registro del plan y de lo que se
> desvió de él. La decisión vive en `docs/DECISIONES.md` D-014 y los criterios de aceptación
> en `docs/COMMITS.md` C10c.
>
> Cambios respecto al plan, todos verificados sobre el proyecto real:
>
> - **No hizo falta la CLI de Supabase.** El proyecto ya existía (`mvqgzzngpdkhbdcsiaes`) y
>   la función se desplegó con el MCP. `supabase` no entra como devDependency.
> - **El modelo no es `gemini-2.5-flash`.** Se listó `v1beta/models` con la clave real:
>   sigue vivo, pero la serie vigente va en 3.7. Se fijó `gemini-3.5-flash`, con
>   `GEMINI_MODEL` como override por entorno.
> - **La variable del front se llama `VITE_SUPABASE_PUBLISHABLE_KEY`**, no `..._ANON_KEY`:
>   es la que ya estaba en `.env` y es el nombre nuevo de Supabase.
> - **C-d y C-e van en un solo commit.** Ajustes con una sola opción que no lleva a ningún
>   lado no tiene criterio de aceptación que escribir.
> - **`.env` nunca llegó al historial** (`git log -- .env` vacío), así que no hubo que
>   reescribir nada ni rotar la clave por esa vía.

## Decisiones tomadas

| Tema | Decidido |
|---|---|
| Clave de Gemini | **Backend en Supabase.** La clave es *secret* de una Edge Function y nunca llega al bundle. Adelanta la infraestructura que C16 ya contemplaba. |
| Fusión con lo existente | **Por `numero_lista`**, igual que `sembrar()` hoy: mismo número = mismo alumno, conserva el `id` (y con él su asistencia), nunca borra. |
| Campos a extraer | Nombre completo (`"Apellidos, Nombres"`), número de lista y fecha de nacimiento. **Sin CURP**: no existe en el modelo y obligaría a `db.version(2)`. |
| Alcance de la pantalla | **Pantalla de ajustes general**, pensada para que después quepan el respaldo JSON de C14 y la versión de la app. Hoy con una sola opción. |
| Revisión previa | **Obligatoria.** La IA falla con acentos y apellidos compuestos, y no hay edición de alumnos donde corregir después. |
| Semilla | **Sembrar solo si la base está vacía.** Si no, la semilla pisaría la lista importada en el siguiente arranque. |

## Contexto

Hoy la lista del grupo entra por `src/data/seed/grupo.ts` (ignorado por git) y se siembra en
cada arranque desde `main.tsx`. Eso lo decidió D-008 ("Sin CRUD de alumnos: ella no importa
nada"), y funciona mientras el desarrollador esté disponible cada ciclo escolar.

Se quiere que la maestra pueda cargar la lista ella misma: desde el tab **Grupo**, un botón de
ajustes lleva a una pantalla donde sube un PDF o una imagen —o toma una foto de la lista
oficial— y una IA extrae los alumnos. La clave de Gemini no puede vivir en el bundle, así que
la llamada pasa por una **Edge Function de Supabase** (adelanta la infraestructura que C16 ya
contemplaba). La extracción se **revisa antes de guardar**: la IA falla con acentos y apellidos
compuestos, y la app no tiene edición de alumnos donde corregir después.

Esto revoca parcialmente dos decisiones escritas (D-008 y "Cero configuración" de `docs/UX.md`
§4). Se registra como decisión nueva, no se hace en silencio.

---

## Antes de tocar código: la clave está expuesta

1. **`.gitignore` no ignora `.env`**, y `.env` ya contiene la clave real. Un `git add -A` la
   commitea. Primer paso, antes que nada: agregar `.env` y `.env.local` a `.gitignore`.
2. La variable se llama `GEMINI-API-KEY`: con guiones y sin prefijo `VITE_`, Vite nunca la
   expone — y **es correcto que así sea**. La clave de Gemini nunca va al front; se guarda como
   *secret* de la Edge Function. El `.env` del front solo lleva la URL y la *anon key* de
   Supabase, que son públicas por diseño.
3. Si la clave ya viajó a algún lado (historial, captura, chat), rotarla en Google AI Studio.

---

## Arquitectura: dónde vive Gemini

`docs/ARCHITECTURE.md` ya fijó el patrón con Supabase: **un servicio externo no pasa por el
repositorio**. Gemini sigue esa regla — no entra en `data/ports/` ni en `data/dexie/`:

```
UI (CargarLista)
  → application/importacion.ts   ← orquesta y normaliza (funciones puras testeables)
      → services/extraccion.ts   ← fetch a la Edge Function (única salida a red)
      → repos.alumnos.sembrar()  ← escritura, ya existente
```

`tests/arquitectura.test.ts` no necesita cambios: `src/services/` no toca `data/dexie` ni
`liveQuery`. Añadir una quinta aserción (que `domain/` y `data/` no importen `services/`) es
barato y sella la frontera nueva.

---

## Trabajo, en orden de commits

### C-a · `chore: proteger la clave de gemini y documentar el entorno`
- `.gitignore`: agregar `.env`, `.env.local`.
- Crear `.env.example` versionado con `VITE_SUPABASE_URL=` y `VITE_SUPABASE_ANON_KEY=` (sin
  valores) y un comentario de que `GEMINI_API_KEY` es secret de la función, no del front.
- Reescribir `.env` local con esas dos variables; la clave de Gemini sale de ahí.
- Verificar con `git status` que `.env` ya no aparece.

### C-b · `chore(sync): inicializar supabase y desplegar la función de extracción`
Setup completo, porque aún no hay proyecto:

1. Crear proyecto en supabase.com (región cercana, p. ej. `us-east-1`). Anotar Project URL y
   anon key → van a `.env`.
2. Instalar la CLI: `npm i -D supabase` (queda en devDependencies, no en el bundle).
3. `npx supabase init` → crea `supabase/config.toml`. Agregar `supabase/.temp/` a `.gitignore`.
4. `npx supabase login` y `npx supabase link --project-ref <ref>`.
5. `npx supabase functions new extraer-lista`.
6. `npx supabase secrets set GEMINI_API_KEY=<clave>` — aquí es donde vive la clave.
7. `npx supabase functions deploy extraer-lista`.

**`supabase/functions/extraer-lista/index.ts`** (Deno, sin dependencias):
- Responde `OPTIONS` con CORS (`access-control-allow-origin`, `-headers: authorization,
  content-type`). Sin esto el navegador no llega.
- Recibe `POST` con JSON `{ mimeType, datos }` donde `datos` es el archivo en base64.
- Valida `mimeType` contra una lista blanca (`application/pdf`, `image/jpeg`, `image/png`,
  `image/heic`, `image/webp`) y rechaza payloads > ~15 MB antes de gastar tokens.
- Llama a `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
  con header `x-goog-api-key`, `inlineData: { mimeType, data }` y un prompt en español que pida
  la lista oficial del grupo. **Confirmar que `gemini-2.5-flash` sigue siendo el id vigente
  antes de escribir el archivo** — es el punto más probable de que esto falle al primer intento.
- Fuerza salida estructurada: `generationConfig.responseMimeType: "application/json"` +
  `responseSchema` con
  `{ alumnos: [{ nombre: string, numero_lista: integer|null, fecha_nacimiento: string|null }] }`.
  El prompt debe pedir explícitamente `"Apellidos, Nombres"` y fecha en `YYYY-MM-DD`.
- Devuelve `{ alumnos }` o `{ error }` con status coherente. **Nunca** filtra la respuesta cruda
  de Google ni la clave en el cuerpo del error.
- La función queda con `verify_jwt` por defecto: el front manda `Authorization: Bearer <anon
  key>`, que es pública y sirve para que no la llame cualquiera desde fuera.

*Criterio de aceptación:* `curl` con un PDF de prueba (nombres inventados) devuelve un JSON con
la lista. Sin tocar la app.

### C-c · `feat(app): extraer una lista de alumnos de un archivo`
- **`src/services/extraccion.ts`** (nuevo, único módulo con `fetch` en `src/`): lee
  `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, convierte el `File` a base64
  con `FileReader`, hace el POST y devuelve el JSON tipado. Falla con mensajes en español y
  distingue *sin conexión* (`navigator.onLine === false`) de *error del servidor*: en una app
  offline-first, "no hay red" no es un bug y debe decirse así.
- **`src/application/importacion.ts`** (nuevo): tipo `FilaImportada { nombre, numero_lista,
  fecha_nacimiento, problema? }` y funciones **puras**:
  - `normalizarExtraccion(crudo): FilaImportada[]` — recorta espacios, colapsa dobles, asigna
    `numero_lista` por orden de aparición cuando venga `null`, y marca `problema` en: nombre
    vacío, `numero_lista` duplicado o `< 1`, y fecha que no sea `YYYY-MM-DD` válida (reutiliza
    los helpers de `src/domain/fechas.ts`).
  - `aDatosAlumno(filas): DatosAlumno[]` — la conversión final al tipo del dominio.
  - `importarLista(filas): Promise<void>` — la única impura: llama a `repos.alumnos.sembrar()`.
- **`src/application/importacion.test.ts`** — es aquí donde se concentra la prueba: entrada
  sucia típica de OCR (números repetidos, nombre vacío, fecha `12/03/2015`) → salida marcada
  correctamente. Entorno `node`, importando de `vitest`, sin `globals`.

Se **reutiliza `sembrar()` tal cual**: su fusión por `numero_lista` conservando el `id` es
exactamente el comportamiento elegido, y así la asistencia ya capturada no se pierde al
reimportar. Único cambio en `src/data/ports/alumnos.ts`: actualizar el comentario del contrato,
que hoy afirma que la lista solo entra por la semilla.

### C-d · `feat(grupo): abrir ajustes desde el tab grupo`
- `src/ui/components/iconos.tsx`: agregar `IconoEngrane` y `IconoAtras` (SVG en línea, como los
  cuatro existentes; no se instala `lucide-react`).
- `src/ui/screens/Grupo.tsx`: header `flex items-center justify-between` con el `<h1>` y un
  `Button size="icon" variant="ghost"` con `aria-label="Ajustes"`.
- `src/ui/screens/Ajustes.tsx` (nuevo): pantalla completa con botón de volver y una lista de
  opciones; hoy una sola fila, "Cargar lista de alumnos", pensada para que quepan después el
  respaldo JSON de C14 y la versión de la app.
- La subvista se maneja con `useState<'resumen' | 'ajustes' | 'cargar'>` **local en
  `Grupo.tsx`**, no en Zustand — mismo criterio que el calendario de `Asistencia.tsx`, y así no
  se rompe `src/ui/store/interfaz.test.ts`, que falla si aparece cualquier clave nueva en el
  store.

### C-e · `feat(grupo): cargar la lista de alumnos desde un archivo o una foto`
`src/ui/screens/CargarLista.tsx` (nuevo), una máquina de estados local
`'inicio' | 'leyendo' | 'revisando' | 'listo' | 'error'`:

- **inicio** — dos botones de 44 px, cada uno con su `<input type="file" className="sr-only">`:
  - *Elegir archivo* → `accept="application/pdf,image/*"`
  - *Tomar foto* → `accept="image/*" capture="environment"` (en iPadOS abre la cámara directo)
- **leyendo** — texto de progreso y botón de cancelar (`AbortController`). Advertir que este
  paso sí necesita conexión.
- **revisando** — la pantalla que evita 30 nombres mal escritos: una fila por alumno con su
  número y un `Input` de shadcn editable (ya está a 16 px, no hay zoom de Safari), las filas con
  `problema` resaltadas en el rojo del bicolor, y un botón de borrar fila. Encabezado con el
  conteo: "Se leyeron 30 alumnos. Revísalos antes de guardar." Confirmar está deshabilitado
  mientras quede algún `problema`.
- **listo** — "Se guardaron 30 alumnos", y vuelve a Ajustes.
- **error** — mensaje concreto (sin red / archivo muy grande / no se reconoció ninguna lista) y
  botón de reintentar, sin perder el archivo elegido.

### C-f · `fix(data): sembrar el grupo solo si la base está vacía`
`src/application/grupo.ts`: `sembrarGrupo()` consulta `repos.alumnos.lista()` y retorna sin
hacer nada si ya hay alumnos. Sin esto, la lista importada se pisa en el siguiente arranque —
la semilla fusiona por `numero_lista` igual que la importación, y el síntoma sería difícil de
diagnosticar. Actualizar el comentario de `src/main.tsx`, que hoy explica que la siembra corre
siempre por ser idempotente. Prueba en `grupo.test.ts`: con base poblada, `sembrar` no se llama.

### C-g · `docs: registrar la carga de lista con ia`
- `docs/DECISIONES.md` → **D-014**: la lista puede entrar por importación asistida por IA.
  Registrar qué revoca de D-008 (ya no es "el desarrollador una vez al año") y de "Cero
  configuración", y por qué la clave va en el servidor y no en el bundle.
- `docs/ARCHITECTURE.md` → sección de servicios externos: `src/services/` es la única salida a
  red del cliente, no pasa por el repositorio, mismo criterio que el motor de sincronía.
- `docs/DATA-MODEL.md` → la sección "Semilla" afirma que ella no importa nada; corregir.
- `docs/COMMITS.md` → agregar estos commits.
- `CLAUDE.md` → **está desactualizado hoy**: dice que no hay dominio, datos ni pantallas y que
  Dexie/Zustand/PWA no están instalados, cuando el repo va en C10b. Corregir de paso.

---

## Archivos críticos

| Nuevo | `supabase/functions/extraer-lista/index.ts`, `src/services/extraccion.ts`, `src/application/importacion.ts` (+ test), `src/ui/screens/Ajustes.tsx`, `src/ui/screens/CargarLista.tsx`, `.env.example` |
| Modificado | `.gitignore`, `src/ui/screens/Grupo.tsx`, `src/ui/components/iconos.tsx`, `src/application/grupo.ts`, `src/main.tsx`, `src/data/ports/alumnos.ts` (solo comentario), `tests/arquitectura.test.ts`, `docs/*`, `CLAUDE.md` |
| Reutilizado sin tocar | `DexieAlumnosRepo.sembrar()`, `Button`/`Input`/`Dialog` de shadcn, `src/domain/fechas.ts`, el patrón de subvista con estado local de `Asistencia.tsx` |

## Verificación

1. `npm run typecheck` y `npm test` en verde tras cada commit — incluye
   `tests/arquitectura.test.ts` (las fronteras de capas) y el test nuevo de normalización.
2. Función sola: `curl -X POST <url>/functions/v1/extraer-lista -H "Authorization: Bearer
   <anon>" -H "content-type: application/json" -d @payload.json` con un PDF de prueba de nombres
   **inventados**. Nunca subir a un servicio externo la lista real durante las pruebas.
3. `npm run dev` en escritorio: Grupo → engrane → Cargar lista → subir un PDF de prueba →
   confirmar que aparece la pantalla de revisión → editar un nombre → guardar → el tab
   Asistencia muestra los alumnos nuevos.
4. Reimportar el mismo archivo: no se duplican y la asistencia ya capturada sigue ahí.
5. Recargar la app: los alumnos importados siguen (verifica C-f).
6. Con las DevTools en *Offline*: el mensaje debe decir que hace falta conexión, no un error
   genérico.
7. En el iPad, sobre el deploy real (no `dev`): `crypto.randomUUID()` exige contexto seguro y el
   service worker no corre sobre HTTP salvo `localhost` — el botón *Tomar foto* solo se puede
   validar ahí. Repasar `docs/PWA-IOS.md`.
8. `git status` antes de cada commit: ni `.env` ni `src/data/seed/grupo.ts` ni ningún PDF de
   prueba con nombres reales.
