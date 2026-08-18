# Interfaz

## El único requisito que importa

**Cuántos toques cuesta registrar el día.** Si pasar asistencia de 30 alumnos
toma más de 15 segundos, el producto está muerto.

Todas las decisiones de abajo se derivan de eso. Cualquier función nueva que
agregue un toque al camino diario tiene que justificarse contra este criterio.

## Principios

### 1. El estado más probable es el estado por defecto

Nadie marca alumno por alumno. Al abrir el día **todos están presentes** y solo
se toca a los dos o tres que faltaron.

Un toque en la fila cicla el estado:

```
presente → ausente → retardo → justificada → presente
```

Cuatro estados en un ciclo es el límite. Un quinto vuelve el ciclo más lento que
un menú.

### 2. Nada de teclado donde se pueda evitar

Las calificaciones se capturan con **seis botones (5 a 10)**, no con un campo
numérico. Un `<input type="number">` en iPad abre el teclado, desplaza la
pantalla y arriesga zoom automático. Seis botones de 44 px no hacen nada de eso.

Tocar el número ya seleccionado lo borra. No hay botón de limpiar.

**Costo asumido:** solo permite enteros. Si ella usa 8.5, esta decisión se cae y
hay que rediseñar la captura. Ver `[POR VALIDAR]` en
[DATA-MODEL.md](./DATA-MODEL.md).

### 3. Un número, no un tablero

Arriba de la lista de asistencia va una sola cifra grande: **presentes / total**.
Es lo único que ella necesita ver de un vistazo. El desglose por estado va
debajo, en 13 px.

Nada de gráficas, tendencias ni tarjetas de métricas.

### 4. Cero configuración

No hay pantalla de ajustes en la v1. Cada opción configurable es una decisión
que el desarrollador no tomó y que el usuario tiene que tomar en su lugar.

### 5. Los errores no piden perdón

Un estado vacío es una invitación a actuar: *"Todavía no hay notas. La primera se
escribe arriba."* Un error dice qué pasó y qué hacer, en voz de la interfaz, no
de una persona.

## Identidad visual

El sistema de color viene del **lápiz bicolor rojo y azul** — el instrumento con
el que se marca una lista en una primaria mexicana. No es decorativo: es la
codificación semántica.

| Token | Hex | Uso |
|---|---|---|
| `--azul` | `#1B4F9C` | Presente, acentos, marca |
| `--rojo` | `#C3382E` | Ausente, valores fuera de rango |
| `--ambar` | `#C77A08` | Retardo |
| `--verde` | `#2F6F4E` | Justificada |
| `--papel` | `#FBFAF7` | Fondo |
| `--cuadro` | `#EDEFEA` | Cuadrícula de cuaderno |
| `--linea` | `#E2E5E1` | Bordes |
| `--tinta` | `#1E2124` | Texto primario |
| `--tinta-2` | `#6B7178` | Texto secundario |

**Tipografía:** Archivo para interfaz (variable, 400-700), DM Mono (400 y 500)
con `font-variant-numeric: tabular-nums` para toda cifra. Los números tabulares
importan: sin ellos las columnas de calificaciones y porcentajes bailan.

Las dos son **auto-hospedadas**, nunca desde `fonts.googleapis.com`: una fuente
remota se cae al fallback en la primera carga sin red. Ver
[DECISIONES.md](./DECISIONES.md) D-011. Toda cifra se marca con la utilidad
`cifra`, que aplica DM Mono y `tabular-nums` de una vez.

**Elemento distintivo:** cada fila de la lista lleva una barra de color de 7 px a
la izquierda. Convierte la lista en una columna bicolor que se escanea de un
vistazo — quién faltó se ve sin leer un solo nombre.

**El fondo es cuadrícula de cuaderno**, 28 px, dibujada con
`repeating-linear-gradient`. Es la referencia al artefacto que la app reemplaza.

## shadcn/ui

Los primitivos vienen de shadcn/ui, con el código copiado a
`src/ui/components/ui`. Ver [DECISIONES.md](./DECISIONES.md) D-010 para el
reparto completo entre shadcn y componentes propios.

**Al agregar cualquier componente, corregir de inmediato en su `cva`:**

```
h-9  → h-11    (36 px → 44 px)
h-10 → h-12
text-sm → text-base   en todo control editable
```

Esto se hace **una vez, en el componente**, nunca pasando `className` en cada
sitio de uso. Si se parchea por sitio, en tres semanas hay un botón de 36 px en
algún lado y nadie se acuerda.

Los tokens del bicolor viven en `@theme` y son la fuente de verdad. Las
variables semánticas de shadcn los consumen:

```css
:root {
  --primary: var(--color-azul);
  --destructive: var(--color-rojo);
  --background: var(--color-papel);
  --foreground: var(--color-tinta);
}
```

## Restricciones de tamaño

Estas son requisitos, no recomendaciones:

- **Objetivo táctil mínimo 44 × 44 px.** Ella toca rápido, de pie, a veces con el
  iPad en una mano.
- **`font-size` mínimo 16 px en cualquier campo editable.** Safari hace zoom
  automático por debajo de eso, y en una tabla de calificaciones es intolerable.
- **Espacio seguro inferior:** la barra de pestañas usa
  `env(safe-area-inset-bottom)` para no quedar bajo el indicador de home.

## Navegación

Cuatro pestañas al fondo, dentro del alcance del pulgar:

| Pestaña | Contenido |
|---|---|
| Asistencia | Tira de días + lista con ciclo de estados |
| Calificaciones | Selector de actividad + captura por botones |
| Notas | Anecdotario: alumno, texto, historial |
| Grupo | Resumen por alumno: % asistencia y promedio |

Sin router en la v1. Cuatro pantallas se manejan con estado en Zustand.

## Actualizaciones de la app

`registerType: 'prompt'` en `vite-plugin-pwa`, nunca `autoUpdate`.

Con actualización automática el service worker puede recargar la app a mitad de
una captura. Una recarga inesperada mientras pasa asistencia es exactamente el
tipo de cosa que hace que alguien abandone una herramienta para siempre.

Cuando haya versión nueva, se muestra un aviso y ella decide cuándo.

## Impresión

Sin librerías de PDF. Una vista con `@media print` y `window.print()`: Safari en
iPad ofrece *Guardar en Archivos* o AirPrint directo. Menos código y mejor
resultado que jsPDF.

Dos formatos: lista de asistencia del mes y calificaciones por actividad.

## Cumpleaños

Sin notificaciones push (ver [DECISIONES.md](./DECISIONES.md)). En su lugar, un
aviso en la pantalla de asistencia — que ella abre todos los días a primera hora:

```
🎂 Hoy cumple años Ana Sofía Hinojosa (9 años)
Esta semana: Bruno (jueves), Regina (viernes)
```

El aviso semanal es lo valioso. Si el objetivo es organizar algo o cantar Las
Mañanitas, saberlo el mismo día a las 7:40 llega tarde; saberlo el lunes sirve.
