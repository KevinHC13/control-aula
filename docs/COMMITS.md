# Commits

## Convención

Conventional Commits, en español, imperativo, sin punto final.

```
<tipo>(<alcance>): <descripción>

[cuerpo opcional]
```

**Tipos:** `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`, `perf`

**Alcances:** `domain`, `data`, `app`, `ui`, `asistencia`, `calificaciones`,
`notas`, `grupo`, `pwa`, `sync`

```
feat(asistencia): ciclar estado con un toque en la fila
fix(pwa): corregir zoom de Safari en campos de texto
refactor(data): mover liveQuery al adaptador de Dexie
docs: registrar la decisión sobre notificaciones push
```

## Reglas del repositorio

1. **Un commit compila y pasa `npm run typecheck` (`tsc -b`) y `npm test`.** No se
   rompe `main`.
2. **Un commit es un incremento verificable**, no un archivo suelto. Si no se
   puede escribir un criterio de aceptación, el commit está mal cortado.
3. **Los criterios de aceptación se verifican corriéndolos**, no en la
   descripción del commit: los que son afirmaciones sobre funciones puras van a
   Vitest; los que son de pantalla o de dispositivo, en el navegador y en el
   iPad.
4. **Cero imports de `data/dexie` fuera de `data/`.** Verificar antes de cada
   commit que toque UI o casos de uso:
   ```bash
   grep -rn "from.*data/dexie" src/ui src/application
   ```
5. **Nada de datos reales del salón en el repositorio.** La lista de alumnos con
   nombres de menores va en un archivo ignorado por git, con un `grupo.example.ts`
   versionado.

---

# Plan de commits

Orden por incrementos verticales: cada bloque atraviesa todas las capas y llega a
pantalla. No se construye toda una capa antes de pasar a la siguiente.

## Fase 1 — Cimientos

### C1 · `chore: inicializar proyecto con vite, react y typescript`

Scaffold, Tailwind v4 como plugin de Vite, estructura de carpetas vacía según
[ARCHITECTURE.md](./ARCHITECTURE.md), `.gitignore` con la ruta de la semilla real.

**Aceptación**
- [ ] `npm run dev` arranca sin advertencias
- [ ] `npm run build` genera `dist/`
- [ ] `npm run typecheck` pasa en modo `strict`
- [ ] Una clase de Tailwind aplica estilo visible
- [ ] Existen `src/domain`, `src/data/ports`, `src/data/dexie`, `src/application`, `src/ui`

### C1b · `chore: configurar shadcn con los tokens del bicolor`

Alias `@/`, `components.json` apuntando a `src/ui/components/ui`, paleta en
`@theme` y variables semánticas de shadcn apuntadas a ella.

**Aceptación**
- [ ] `@/` resuelve tanto en `tsc` como en Vite
- [ ] Los componentes de shadcn caen en `src/ui/components/ui`, no en `src/components`
- [ ] `--primary` resuelve a `#1B4F9C`, no al zinc por defecto
- [ ] No existe ningún color de shadcn sin mapear a un token del bicolor
- [ ] Un `Button` de prueba mide 44 px de alto
- [ ] Un `Input` de prueba usa 16 px y no provoca zoom al enfocarlo en el iPad

### C2 · `feat(domain): definir entidades, valores y reglas de dominio`

`entities.ts`, `values.ts`, `rules.ts` según [DATA-MODEL.md](./DATA-MODEL.md).

**Aceptación**
- [ ] Ningún archivo de `domain/` importa librerías externas
- [ ] Toda entidad extiende `Sincronizable`
- [ ] `promedioDe([])` devuelve `null`, nunca `0`
- [ ] `cuentaComoAsistencia('retardo')` devuelve `true`
- [ ] `porcentajeAsistencia([])` devuelve `100`, no `NaN`

### C3 · `feat(data): crear esquema de dexie con outbox`

`db.ts` con las seis tablas, índices compuestos y helper `ahora()` para
`updated_at`.

**Aceptación**
- [ ] La base aparece en DevTools → Application → IndexedDB
- [ ] Existe el índice `[fecha+alumno_id]` en `asistencia`
- [ ] Existe la tabla `outbox` con clave `++seq`
- [ ] Ninguna tabla de dominio usa clave autoincremental

### C4 · `feat(data): definir puertos de alumnos y asistencia`

Interfaces en `ports/`, más `Suscribible<T>` en `domain/values.ts`.

**Aceptación**
- [ ] Todo método se nombra por caso de uso, no por consulta
- [ ] No existe `find()`, `query()` ni `where()` en ningún puerto
- [ ] No existe `BaseRepository<T>`
- [ ] `ports/` no importa nada de `dexie`

---

## Fase 2 — Asistencia, el vertical completo

Este es el corazón del producto. Si esto no queda bien, nada más importa.

### C5 · `feat(data): implementar adaptadores de alumnos y asistencia con dexie`

Incluye `observarDia` con `liveQuery` y la escritura transaccional que encola en
`outbox`.

**Aceptación**
- [ ] `liveQuery` aparece **solo** en `data/dexie/`
- [ ] Cada mutación escribe `updated_at`
- [ ] Escritura y encolado en `outbox` ocurren en la misma transacción
- [ ] Toda lectura filtra `deleted_at === null`
- [ ] Marcar dos veces el mismo alumno el mismo día actualiza el registro, no crea un segundo

### C6 · `feat(app): agregar casos de uso de asistencia`

`marcarEstado()` con la lógica de ciclo, `pasarLista()` para crear el día
completo en presente.

**Aceptación**
- [ ] `application/` no importa nada de `data/dexie`
- [ ] Ciclar desde `justificada` devuelve `presente`
- [ ] Abrir un día sin registros no falla y presenta a todos como presentes

### C7 · `feat(ui): construir shell con navegación de cuatro pestañas`

Store de Zustand, barra de pestañas, contenedor de pantallas.

**Aceptación**
- [ ] El store no contiene alumnos, asistencia, calificaciones ni notas
- [ ] Todo objetivo táctil mide al menos 44 × 44 px
- [ ] La barra respeta `env(safe-area-inset-bottom)`
- [ ] El foco de teclado es visible en cada pestaña

### C8 · `feat(asistencia): construir pantalla de lista con ciclo de estados`

Tira de días, contador, lista con barra de color, hook `useAsistenciaDelDia`.

**Aceptación**
- [ ] La pantalla no importa nada de `data/dexie`
- [ ] Al abrir un día nuevo, los 30 alumnos aparecen presentes
- [ ] Un toque en la fila avanza el estado y el color cambia de inmediato
- [ ] El contador de arriba se actualiza sin recargar
- [ ] Recargar la página conserva lo capturado
- [ ] **Pasar asistencia completa de 30 alumnos con 3 faltas toma menos de 15 segundos, medido con cronómetro**
- [ ] Cambiar de día y volver muestra los datos correctos
- [ ] Con el WiFi apagado funciona idéntico

El penúltimo criterio es el que define el producto. Si no se cumple, se rediseña
la pantalla antes de seguir.

### C9 · `feat(data): cargar lista real del grupo como semilla`

`grupo.example.ts` versionado, `grupo.ts` real ignorado por git.

**Aceptación**
- [ ] La semilla corre una sola vez y es idempotente
- [ ] `git status` no muestra el archivo con nombres reales
- [ ] Los alumnos aparecen en el orden de la lista oficial

### C10 · `chore(pwa): configurar manifest, service worker e iconos`

**Aceptación**
- [ ] Se instala en el iPad desde *Agregar a pantalla de inicio*
- [ ] El ícono se ve nítido, no como captura de la página
- [ ] Abre sin barra de navegador
- [ ] `navigator.storage.persist()` devuelve `true`
- [ ] Funciona completa en modo avión
- [ ] Al haber versión nueva aparece un aviso, sin recarga automática
- [ ] Se completa la lista de verificación de [PWA-IOS.md](./PWA-IOS.md)

---

## Hito · Entrega y pausa de una semana

Después de C10 se le instala en el iPad y **se detiene el desarrollo una semana
completa.**

No es una sugerencia de proceso: calificaciones es la parte que más depende del
formato exacto que ella entrega, y una semana de uso real va a revelar cosas del
flujo que ninguna planeación produce.

Durante la pausa, recolectar los tres artefactos pendientes:

- [ ] Su cuaderno actual, fotografiado
- [ ] El formato de informe que entrega al final del periodo
- [ ] La plataforma donde captura las calificaciones oficiales

Y resolver los `[POR VALIDAR]`:

- [ ] ¿Escala 5–10 entera, o con decimales?
- [ ] ¿Evaluación numérica o descriptiva por niveles de desempeño?
- [ ] ¿Los campos formativos le sirven de agrupación, o son ruido?
- [ ] ¿Cuál es el umbral real de riesgo por asistencia?

---

## Fase 3 — Después de la semana de uso

El alcance de esta fase se ajusta con lo aprendido. Los criterios de abajo son
provisionales.

### C11 · `feat(calificaciones): capturar por actividad con botones de 5 a 10`

Bloqueado por la validación de escala.

**Aceptación**
- [ ] Un toque asigna calificación; tocar el mismo número la borra
- [ ] Ningún control provoca zoom de Safari
- [ ] El contador de evaluados es correcto
- [ ] Los números usan `tabular-nums` y las columnas no bailan

### C12 · `feat(notas): agregar anecdotario por alumno`

**Aceptación**
- [ ] Guardar requiere alumno y texto no vacío
- [ ] El historial se ordena por fecha, más reciente primero
- [ ] El estado vacío invita a actuar en lugar de solo informar
- [ ] El campo de texto tiene al menos 16 px

### C13 · `feat(grupo): mostrar resumen de asistencia y promedio`

**Aceptación**
- [ ] Los valores coinciden con un conteo manual de la base
- [ ] Sin calificaciones, el promedio muestra `—`, no `0.0`
- [ ] El color de alerta usa el umbral validado con ella

### C14 · `feat: exportar e importar respaldo en json`

Cubre el riesgo de pérdida de datos antes de que exista el motor de sincronía.

**Aceptación**
- [ ] La exportación abre el diálogo de *Guardar en Archivos* en iPad
- [ ] Importar en una base vacía reconstruye todo, IDs incluidos
- [ ] Importar dos veces el mismo archivo no duplica registros

### C15 · `feat: avisar cumpleaños del día y de la semana`

**Aceptación**
- [ ] El aviso aparece en la pantalla de asistencia, no en un modal
- [ ] La edad calculada es correcta
- [ ] Sin cumpleaños en la semana, no se muestra nada
- [ ] Funciona sin red

### C16 · `feat(sync): subir cambios pendientes a supabase`

**Aceptación**
- [ ] La `outbox` se vacía solo tras confirmación del servidor
- [ ] Sin red, la app funciona idéntico y los cambios quedan encolados
- [ ] Se sincroniza al abrir y al cerrar, nunca en segundo plano
- [ ] Restaurar en un dispositivo limpio reconstruye todo
- [ ] Nada del motor de sincronía atraviesa el repositorio
