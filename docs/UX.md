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

La tira de días de arriba responde al mismo criterio. Carga tres meses y se
recorre **deslizando**: nadie tiene que tocar los días que no le interesan para
llegar al que busca. El seleccionado se centra solo al cambiar, y la tira nunca
pasa de hoy —un día que no ha pasado no tiene asistencia que capturar.

En los extremos van `‹` y `›`, **fuera** del área que se desliza: no se van con el
desplazamiento y avanzan o retroceden **un día**, que es el movimiento de quien
corrige. `›` se apaga en hoy. Un separador los aparta del botón de calendario,
porque hacen cosas distintas: las flechas caminan de uno en uno, el calendario
salta a cualquier día.

Para esos saltos largos, y para ver el mes de un vistazo, en la posición 0 de la
tira va un botón de calendario. Abre el mes como mosaico: **hueco** si el día no se ha
capturado, **azul** si no faltó nadie, **rojo con la cifra** si hubo faltas.
Distinguir el hueco del azul es el punto —pintar igual "todavía no lo capturé" y
"ese día no faltó nadie" sería mentir. Tocar un día lo selecciona y cierra.

### 2. Nada de teclado donde se pueda evitar

Un `<input type="number">` en iPad abre el teclado, desplaza la pantalla y
arriesga zoom automático. Nada del camino de captura lo usa.

Las calificaciones se capturan **tocando un nivel de rúbrica** —Excelente, Bien,
Regular, Mal— con su descriptor a la vista. Cuatro botones de 44 px por criterio
de la rúbrica, un toque cada uno, y guarda de inmediato: no hay botón de Guardar.

Los seis botones de 5 a 10 del prototipo ya no existen: la evaluación resultó ser
por niveles, no por una escala numérica (D-015). La razón de la decisión original
sobrevivió intacta; la escala, no.

El único lugar donde hay cifras que teclear son los aciertos de examen, y usa un
**teclado numérico dentro de la app**, no el nativo. Es la misma razón de siempre,
resuelta sin `<input type="number">`.

### 3. Un número, no un tablero

Arriba de la lista de asistencia va una sola cifra grande: **presentes / total**.
Es lo único que ella necesita ver de un vistazo. El desglose por estado va
debajo, en 13 px.

Nada de gráficas, tendencias ni tarjetas de métricas.

### 4. Cero configuración

Nada que configurar para que la app funcione. Cada opción configurable es una
decisión que el desarrollador no tomó y que el usuario tiene que tomar en su
lugar.

Hay una pantalla de Ajustes, a dos toques del camino diario, y no contradice lo
anterior: no ajusta nada, guarda las cosas que se hacen una vez al año —cargar la
lista del grupo (D-014), y más adelante el respaldo en JSON—. La regla nunca fue
*ninguna pantalla*, era *ninguna pantalla en el camino diario*.

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
| Asistencia | Tira de días con calendario + lista con ciclo de estados |
| Calificaciones | Trimestre → criterio → actividad → captura por niveles |
| Notas | Anecdotario: alumno, texto, historial |
| Grupo | Resumen por alumno: % asistencia y calificación del trimestre |

La pestaña de Calificaciones es la única con jerarquía adentro, y es inevitable:
una actividad no existe fuera de un criterio de un trimestre. Lo que sí se evita
es que ella la recorra todos los días — el trimestre activo se deduce de la fecha
y el criterio se recuerda, así que entrar a calificar la actividad de hoy no
cuesta navegar cuatro niveles.

**Todo se muestra en base 10.** El porcentaje es representación interna y no
aparece en ninguna pantalla. Un criterio sin actividades calificadas se ve como
«sin calificar», nunca como 0 — la diferencia entre *no lo he calificado* y *sacó
cero* es la misma que entre el día hueco y el día azul del calendario.

Y la pantalla de consulta muestra el **desglose por criterio**, no solo el número
final. Cuando un resultado no cuadre con su intuición, el desglose es lo único
que dice si el error está en la fórmula o en la expectativa.

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

Dos formatos: lista de asistencia del mes y calificaciones del trimestre con su
desglose por criterio y campo formativo.

## Cumpleaños

Sin notificaciones push (ver [DECISIONES.md](./DECISIONES.md)). En su lugar, un
aviso en la pantalla de asistencia — que ella abre todos los días a primera hora:

```
🎂 Hoy cumple años Ana Sofía Hinojosa (9 años)
Esta semana: Bruno (jueves), Regina (viernes)
```

El aviso semanal es lo valioso. Si el objetivo es organizar algo o cantar Las
Mañanitas, saberlo el mismo día a las 7:40 llega tarde; saberlo el lunes sirve.
