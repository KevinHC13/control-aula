# Estado del proyecto

Actualizado el **2026-09-07**, con **sesenta y tres commits escritos**. Los cinco
últimos son el orden alfabético del grupo y el primer reporte semanal (D-030), abajo.

Lo anterior, del 2026-09-02, con cincuenta y ocho commits: los treinta
y uno del plan, la Fase 7 —el alcance que trajo el uso real—, `C37`, la **Fase 9** —la
lista de verdad: Excel, CURP y varias hojas—, la **Fase 10**, la pasada de interfaz que
trajo la auditoría de UX, y la **Fase 11** —el sexo del alumno (D-029), que trajo el uso
real de la asistencia—.

De la Fase 11 falta un paso que **no es código**: los treinta y ocho alumnos que ya
están en el iPad no tienen ni sexo ni CURP, y se arreglan con un `UPDATE` en Supabase y
un *Restaurar de la nube*. El orden y sus seguros están abajo, en «Alcance nuevo: el
sexo del alumno».

Lo anterior, del 2026-08-21:
la Fase 4 completa —C18 a C29, más los fixes C19b y C21c—, el alcance nuevo que la
usuaria pidió ese mismo día —los tres criterios automáticos (D-020) y las dos
herramientas de aula (D-021)— y lo que faltaba de la Fase 3: bitácora, respaldo,
resumen del grupo, cumpleaños y el motor de sincronía. Este es el documento que se
lee primero para saber dónde va el proyecto y qué sigue. El plan detallado, con
criterios de aceptación por commit, está en [COMMITS.md](./COMMITS.md).

Regla: **antes de afirmar que algo existe, verificarlo en `src/`.** Este archivo
se queda viejo; el código no.

---

## En una línea

**La v1 está escrita completa y no está usada.** Asistencia lleva una semana de uso
real en el iPad; todo lo demás —la evaluación con sus rúbricas y su examen, el cierre
de trimestre con snapshot, la bitácora, los tres criterios automáticos, el sorteo, los
equipos, el resumen del grupo, los cumpleaños, el respaldo en archivo y la copia en la
nube— existe, tiene pruebas y **solo se ha visto en el navegador de escritorio**.

Lo que separa esto de estar en uso no es código: son los tres pasos de Supabase, una
pasada con el iPad en la mano y dos preguntas a la usuaria. Están abajo, en «Con qué
continuar».

## Qué está verificado, y con qué

Vale la pena separarlo, porque «tiene pruebas» y «alguien lo usó» no son lo mismo y
este proyecto tiene mucho de lo primero.

| Cómo | Qué cubre |
|---|---|
| **958 pruebas** (`npm test`) | El dominio y los casos de uso completos, los adaptadores sobre `fake-indexeddb`, y las reglas de dependencia de la arquitectura |
| **Navegador de escritorio** | Todas las pantallas, incluidas las de esta sesión: el cálculo de los tres criterios automáticos con los números comprobados a mano, el sorteo, el modo participación con su pulsación larga, los equipos, el resumen, los cumpleaños, el respaldo y la pantalla de la nube |
| **Supabase real** | Que las dieciséis tablas existen con RLS, que con la clave publicable no se lee ni se escribe nada, que los registros están cerrados y que el login funciona |
| **Nada** | La **subida y la restauración contra Supabase** —falta hacerlas una vez—, y **todo el comportamiento en el iPad**: instalación, gestos con el dedo, teclado, tiempos |

Del cálculo conviene saber con qué se comprobó, porque es la cadena más larga: con
los pesos en 40/30/30 y un alumno con una falta y una participación, el desglose dio
`10.0 · 0.0 · 2.0` y final `4.6`, que es exactamente
`(40×1 + 30×0 + 30×0.2) ÷ 100`. Los tres criterios automáticos aparecieron en el
reporte **sin tocar ninguna pantalla**, que era lo que `C26` tenía que demostrar.

Una pasada de seguridad sobre lo que sale del dispositivo, hecha el 2026-08-21:
`.env` nunca se commiteó y ninguna clave está en el historial; el front solo conoce la
URL y la clave publicable —la de servicio no aparece en el repositorio—; no hay
`innerHTML` ni `eval` en ninguna parte; ningún `console` imprime datos del salón; la
contraseña vive en el estado del componente y se borra al entrar; y las políticas de
RLS impiden insertar filas a nombre de otro o cambiarle el dueño a las propias.

Dos riesgos **aceptados a sabiendas**, no hallazgos: la sesión se guarda en
`localStorage` —es lo que evita el login diario (D-023)— y restaurar no tiene
deshacer (D-022).

## Fases

| Fase | Alcance | Estado |
|---|---|---|
| 1 · Cimientos | Scaffold, shadcn, dominio, Dexie, puertos | ✅ Terminada |
| 2 · Asistencia | El vertical completo hasta el iPad | ✅ Terminada |
| Hito | Entrega, pausa de una semana, validación | ✅ Cumplido |
| 3 · Resto de la v1 | Bitácora, resumen, respaldo, cumpleaños, sincronía | ✅ Terminada: C12, C13, C14, C15, C16 |
| 5 · Criterios automáticos | Puntualidad, conducta y participación | ✅ Terminada: C12, C25b, C25, C26 |
| 6 · Herramientas de aula | Sorteo de participación y formar equipos | ✅ Terminada: C30 y C31 |
| 4 · Evaluación | Ciclo, trimestres, criterios, rúbricas, cálculo | ✅ Terminada: C18–C24 y C27–C29 |
| 7 · Datos reales | Fuera la semilla, y varios ciclos guardados | ✅ Terminada: C32–C36 |
| 8 · Administrar el grupo | Alta, corrección y baja de alumnos | ✅ Terminada: C37 |
| 9 · La lista real | Excel, CURP y varias hojas | ✅ Terminada: C38–C42 |
| 10 · Auditoría de interfaz | Defectos, sistema de diseño, textos y personalización | ✅ Terminada: C43–C51 |
| 12 · Orden y reportes | El grupo por apellido y el primer reporte semanal | ✅ Terminada: C50–C54 |

## Lo que existe y funciona

Verificado en `src/` a esta fecha:

| Capa | Contenido |
|---|---|
| `domain/` | `entities.ts` con la jerarquía de evaluación completa, `values.ts`, `fechas.ts`, `rules.ts`, `evaluacion.ts` (estructura), `calculo.ts` (los números, incluidas las tres fórmulas automáticas), `sorteo.ts` (el sorteo ponderado), `equipos.ts` (el reparto) y `cumpleanos.ts`, con pruebas |
| `data/dexie/` | `db.ts` en `version(3)`, adaptadores de alumnos, asistencia, evaluación, bitácora, participaciones, respaldo y sincronía, `outbox`, semilla |
| `data/ports/` | `alumnos.ts`, `asistencia.ts`, `evaluacion.ts` (ciclo, trimestres, criterios, pesos, rúbricas y actividades), `bitacora.ts`, `participaciones.ts`, `respaldo.ts` |
| `application/` | `asistencia.ts`, `grupo.ts`, `importacion.ts`, `evaluacion.ts`, `entregas.ts`, `calificacion.ts`, `examen.ts`, `calificaciones.ts` (reporte y cierre), `bitacora.ts`, `participacion.ts`, `sorteo.ts`, `equipos.ts`, `resumen.ts`, `cumpleanos.ts`, `respaldo.ts`, `sincronia.ts` |
| `services/` | `extraccion.ts` y `sincronia.ts` + `supabase.ts` — la única salida a red del cliente |
| `ui/` | Cuatro pestañas, Asistencia completa (con la etiqueta del trimestre), Calificaciones con sus actividades, las tres capturas —entregas, rúbrica y examen, esta última con teclado propio— y el reporte del trimestre por alumno y por campo, Bitácora con el conteo por alumno y su historial, Ajustes, CargarLista, CicloEscolar, CriteriosYPesos (con el cierre del trimestre), Rubricas, Respaldo |
| `tests/` | `arquitectura.test.ts` — verifica las reglas de dependencia en cada `npm test` |
| Infra | PWA con `vite-plugin-pwa` y aviso de actualización; Edge Function `extraer-lista` desplegada; las dieciséis tablas de la nube **aplicadas** en Supabase, con RLS y políticas |

Pantalla de asistencia: tira de días de tres meses que se desliza, calendario del
mes como mosaico, contador de presentes, filas con ciclo de estados y barra
bicolor, el **modo participación** (`C25`), que cambia lo que hace el toque y cómo se
ve la pantalla, el **sorteo de quién pasa** (`C30`), en un diálogo, y el **aviso de
cumpleaños** (`C15`), que solo aparece cuando hay alguno.

## Lo que es placeholder

**Ninguno.** `Grupo` era el último y con `C13` muestra el resumen del trimestre
—asistencia y promedio, del grupo y por alumno—, más el acceso a los equipos y a
Ajustes. `Notas.tsx` ya no existe: se volvió
`ui/screens/Bitacora.tsx` en `C12`, y `Calificaciones` está completa —lista las
actividades, las captura de las tres formas y muestra el reporte del trimestre por
alumno y por campo—.

## Lo que cambió con la validación

La semana de uso real hizo exactamente lo que se esperaba: tiró el plan de
calificaciones. Lo que cayó y lo que entró:

| Se planeó | Es en realidad |
|---|---|
| Escala entera 5–10, seis botones | Rúbricas de cuatro niveles; base 1 al calcular, base 10 al presentar, **sin piso** |
| `Calificacion` con un `valor` numérico | `Entrega`, `EvaluacionRubrica` y `ResultadoExamen`, según el tipo de criterio |
| `Actividad` suelta con fecha y campo | `Actividad` colgada de un `CriterioTrimestre` |
| Sin ponderaciones configurables | Pesos por criterio y por trimestre, que deben sumar 100 para cerrar |
| Sin multi-ciclo | `Ciclo` → `Trimestre`, con cierre que congela y deja snapshot |
| Campos formativos `[POR VALIDAR]` | Validados: son la agrupación con la que ella reporta |

Detalle del modelo en [DATA-MODEL.md](./DATA-MODEL.md), justificación en
[DECISIONES.md](./DECISIONES.md) D-015.

Consecuencia sobre el esquema: las tablas `actividades` y `calificaciones` de
`version(1)` **se descartaron**. `version(2)` las reemplazó y agregó once tablas
más. Era la única migración de la Fase 4 y ya está hecha, en C18. Encima,
`version(3)` (C12) renombró `notas` a `bitacora`, agregó `participaciones` y le dio
`retardos_por_falta` a `criterios_trimestre`: **son dieciséis tablas
sincronizables** y el esquema ya no tiene cambios pendientes a la vista.

Sobre el riesgo de esa migración: resultó no existir. La verificación que este
documento pedía hacer en el iPad —contar filas de `actividades` y
`calificaciones`— no hizo falta, porque **ninguna ruta de código escribió nunca en
esas tablas**: no hubo adaptador, puerto ni caso de uso que las tocara. Estaban
vacías por construcción. La migración se ensayó igual en
`src/data/dexie/migracion.test.ts`, sobre una base con el esquema viejo y
asistencia capturada.

## Con qué continuar

**El riesgo que dominaba esta sección ya está cubierto: `C14` está hecho**, y los
criterios automáticos **también**: bitácora (`C12`), configuración (`C25b`), captura
de participación (`C25`) y las tres fórmulas (`C26`). La Fase 5 está terminada. Hay
una pantalla en *Grupo → Ajustes → Respaldo* que escribe un archivo con las
dieciséis tablas —borrados incluidos— y lo restaura por upsert, así que el mismo
archivo dos veces no duplica nada. Queda **una verificación que necesita el
dispositivo**: que la hoja de compartir del iPad ofrezca *Guardar en Archivos*. En
el escritorio la exportación cae a una descarga normal, que es lo que se probó.

**Están escritos los treinta y un commits del plan.** `C16`, el motor de sincronía,
cerró la lista: sube la `outbox` por lotes —vaciándola solo cuando el servidor
confirma—, restaura todo por el mismo camino del respaldo en JSON, y se ejecuta al
abrir y al cerrar la app, nunca en segundo plano. El acceso es una cuenta con sesión
guardada, y el login se pide solo al subir o restaurar (D-023).

Lo que queda **no es código**, y es lo único que separa esto de estar en uso:

1. **La primera sincronía de verdad.** Los tres pasos de Supabase ya están hechos
   —migración aplicada con RLS, cuenta creada, registros cerrados—, así que lo que
   falta es entrar desde *Grupo → Ajustes → Copia en la nube*, subir, y ver las filas
   en las tablas. Hasta entonces subir y restaurar solo están probados contra una nube
   simulada. Detalle y verificaciones en [PWA-IOS.md](./PWA-IOS.md).
2. **Una pasada con el iPad en la mano.** De la Fase 2 en adelante **nada se ha usado
   en el dispositivo**: todo se ha visto en el navegador de escritorio, que no dice
   nada de los gestos con el dedo, del teclado de Safari ni de los tiempos reales. La
   lista está en `PWA-IOS.md`, y lo que más urge medir con cronómetro es la captura
   con rúbrica y la del examen. Dos cosas que solo se comprueban ahí: que **sostener
   el dedo** en el modo participación reste sin abrir el menú de selección de iPadOS,
   y que la hoja de compartir del respaldo ofrezca *Guardar en Archivos*.
3. **Validar con la usuaria** los dos supuestos que siguen abiertos: el umbral de
   riesgo del resumen —hoy 90 % y 6.0, escritos en la pantalla— y si la captura a
   medias debería dar calificación, que se resolvió excluyéndola (D-019) sin
   preguntárselo.

Después de eso, lo que venga sale del uso real, no de esta lista.

Las dos herramientas de aula ya están: `C30` —el sorteo, en la pantalla de
asistencia, que pondera a favor de quien menos ha pasado y no registra nada por sí
solo— y `C31` —formar equipos, en Grupo, que no guarda nada—.

Y sigue pendiente algo que no es un commit: **la Fase 4 y todo el alcance nuevo nunca
se han usado en el iPad.** Solo en el navegador de escritorio.

Y una consecuencia de `C26` que conviene mirar en la pantalla: con conducta
configurada, **todo el grupo tiene calificación desde el primer día** —10.0—, así que
el reporte dejó de mostrar `—` y ahora muestra «10.0 sobre 15». Es correcto, y es
justo donde el aviso de «sobre cuánto» de C29 pasa de útil a indispensable.

Los cuatro commits del **alcance nuevo del 2026-08-21** (D-020 y D-021) quedaron
así:

1. ~~`C12` · bitácora~~ — **hecho**: la pestaña se llama *Bitácora*, todo lo que se
   anota es un reporte con su conteo por alumno, y trajo `version(3)` completa.
   ~~`C14` · respaldo~~ — **hecho** también, y ya no condiciona a nadie.
2. ~~`C25b` · configurar los criterios automáticos~~ — **hecho**: los tres tipos se
   agregan al trimestre y traen sus parámetros debajo de la fila. Puntualidad nace en
   «los retardos no cuentan» y participación con la meta en 5.
3. ~~`C25` · captura de participación~~ — **hecho**: el interruptor *Marcar
   participación* en la pantalla de asistencia, con barras verdes, el contador
   contando participaciones y sostener el dedo para restar.
4. ~~`C26` · cálculo~~ — **hecho**: las tres fórmulas en `domain/calculo.ts` y su
   composición en `application/calificaciones.ts`. Los tres aparecieron solos en el
   reporte de C29 y en el snapshot de C27, sin tocar ninguna de las dos pantallas.
5. `C30` · **sortear quién participa** y `C31` · **formar equipos**. `C30` va después
   de `C25` porque escribe en `participaciones`; `C31` no depende de nada.

Y lo que queda de la Fase 3: `C13` (resumen del grupo, que ya tiene de dónde sacar el
promedio), `C15` (cumpleaños) y `C16` (el motor de sincronía, el que cierra la v1).
`C17` no existe como pendiente: se adelantó como C10c.

Y una cosa que no es un commit: **la Fase 4 nunca se ha usado en el iPad.** Se
construyó completa entre dos sesiones y solo se ha visto en el navegador. Antes de
seguir agregando, conviene una pasada con el dispositivo en la mano y la lista de
`docs/PWA-IOS.md`, sobre todo para medir con cronómetro la captura con rúbrica y la
del examen, que es lo único que sigue sin medir.

La Fase 4 quedó así, completa:

```
C18 ─ C19 ─ C20 ─ C21 ─ C21b ─┬─ C22 ─┐
 ✅    ✅    ✅    ✅    ✅     ├─ C23 ─┼─ C28 ─┬─ C29
                              └─ C24 ─┘       └─ C27
```

Todos hechos. Lo que cuelga de esta fase y **no** está hecho son los criterios
automáticos —`C12`, `C25b`, `C25`, `C26`—, que dejaron de estar pospuestos el
2026-08-21, más las dos herramientas de aula de la Fase 6 —`C30`, `C31`—.

### Lo que queda, y de qué depende

La Fase 4 está cerrada, así que nada de lo que falta depende de ella. En orden de
valor por unidad de trabajo:

- **Nada de código.** Quedan los tres pasos de Supabase, la pasada con el iPad y las
  dos validaciones con la usuaria, arriba.
- **Las dos herramientas de aula:** `C30` (sortear quién participa, que escribe en
  `participaciones` y por eso va después de `C25`) y `C31` (formar equipos, que no
  depende de nada y no guarda nada). Son las dos únicas funciones del proyecto que se
  usan **con los niños mirando la pantalla**, así que se diseñan para leerse de
  lejos y para no hacer esperar.
- **`C13` · resumen del grupo.** Ya se puede completo: la asistencia siempre fue
  posible y el promedio sale de `reporteDeTrimestre`.
- **`C15` · cumpleaños.** Independiente por completo.
- **`C16` · sincronía.** El que cierra la v1.

`version(3)` y `C14` ya están, así que nada de lo que queda depende del esquema ni
del respaldo.

## Alcance nuevo: los tres criterios automáticos

Estuvieron pospuestos por decisión de la usuaria y **el 2026-08-21 los retomó ella
misma, con reglas propias** (docs/DECISIONES.md D-020). Ya no son diseño de
referencia: son trabajo pendiente, y el detalle está en
[DATA-MODEL.md](./DATA-MODEL.md#criterios-automáticos) y en los commits `C12`,
`C25`, `C25b` y `C26`.

Los cuatro commits están hechos: `C12` —la bitácora escribe reportes y cuenta los del
trimestre por alumno—, `C25b` —los tres se agregan al trimestre con sus parámetros—,
`C25` —el modo de participación en la asistencia— y `C26` —las tres fórmulas—. **Los
tres criterios ya califican.**

En corto, para no tener que abrir los otros dos documentos:

- **Puntualidad.** Configurable en dos niveles: si el criterio existe, se califica; y
  `retardos_por_falta` dice cuántos retardos hacen una falta, o que un retardo no
  penaliza. **Nace en «no cuentan»**, no en 3: esa convención no está validada. La calificación es `(días − faltas − retardos convertidos) ÷ días`.
- **Conducta.** Sale de la **bitácora** —la pantalla que ya existe, `C12`—, donde
  todo lo que se anota es un reporte y todos los reportes son negativos. 0 o 1
  reportes → 10.0; 2 → 5.0; 3 o más → 0.0. El primero se deja pasar a propósito.
  Desaparece el `signo` que el diseño viejo iba a agregarle a cada nota.
- **Participación.** Se marca desde la pantalla de asistencia con un **modo**, ya
  construido (`C25`): con el interruptor prendido, tocar a un alumno le suma una
  participación en vez de ciclar su asistencia, y sostener el dedo resta una. Se califica **proporcional con tope contra una meta que nace en 5**
  (D-021): cinco participaciones o más valen 10.0, una vale 2.0.

Los tres se configuran como cualquier otro criterio: se usan si tienen fila en el
trimestre y pesan lo que diga su peso. Y ninguno aporta a un campo formativo —un
retardo no es de Lenguajes—, así que solo cuentan para el general.

**Lo que cuesta, escrito para no descubrirlo tarde:** la bitácora deja de ser un
lugar sin consecuencias para apuntar cosas, así que la pantalla tiene que decir que un
reporte afecta la conducta; y el modo de participación hace que el mismo toque
signifique dos cosas, así que tiene que verse imposible de ignorar, apagarse solo y
poder deshacerse.

## Alcance nuevo: empezar con datos reales (2026-08-24)

Lo pidió el usuario al ir a usar la app de verdad: **quitar el grupo de ejemplo**. Al
tirar de ese hilo apareció lo de fondo, que la app **no soportaba un ciclo nuevo**
(D-025). Está todo hecho, C32 a C36.

- **La semilla ya no existe.** `src/data/seed/` entera fuera, junto con `sembrarGrupo()`
  y la llamada del arranque. La app arranca en cero alumnos y la lista entra por la
  carga con IA o por un respaldo. El repositorio ya no versiona ninguna lista, ni
  siquiera inventada.
- **Los alumnos cuelgan de un ciclo**, con `version(4)` y el índice
  `[ciclo_id+numero_lista]`. Es la corrección de un fallo que no se veía: `sembrar()`
  fusiona por número de lista conservando el `id`, así que cargar la lista del año nuevo
  le habría colgado al alumno 1 de este año la historia del alumno 1 del anterior.
- **Se puede cerrar el ciclo y abrir el siguiente.** Hasta ahora `'cerrado'` era un
  valor inalcanzable para la tabla `ciclos`. Cerrar exige todos sus trimestres cerrados
  y **no borra nada**: las cuatro pestañas amanecen limpias y el año pasado sigue entero.
- **Los ciclos anteriores se consultan** en *Ajustes → Ciclos anteriores*: el reporte por
  trimestre desde el snapshot, con los nombres de entonces. Ninguna pestaña diaria se
  tocó.

Verificado en el navegador de escritorio, paso por paso: la migración con el ciclo ya
configurado, la adopción de los alumnos sueltos al abrir el ciclo, el cierre del ciclo
dejando las pantallas vacías con los datos intactos debajo, y el reporte histórico.
**En el iPad, nada de esto se ha visto todavía** — como el resto de la Fase 4.

La migración `20260824190000_alumnos_por_ciclo.sql` **ya está aplicada** en el proyecto
de Supabase (2026-08-24): `public.alumnos` tiene su columna `ciclo_id` y las políticas
de RLS quedaron intactas. Se aplicó con las dieciséis tablas vacías, así que no tocó
ningún dato.

**Pendiente de quitar:** *Ajustes → Respaldo → Borrar toda la información*. Se retiró en
`C36` y volvió a entrar a petición del usuario, para dejar la base del iPad limpia una
vez. Cerrar el ciclo ya hace lo que hacía falta de verdad, así que en cuanto la base
esté como debe, este botón se va —está marcado con `TEMPORAL` en los seis archivos que
toca—.

## Alcance nuevo: administrar el grupo (2026-08-24)

Lo pidió el usuario: poder agregar, corregir y dar de baja alumnos. Revierte a
sabiendas la regla de que «no hay CRUD de alumnos en la v1» (D-026), porque un grupo
real se mueve durante el año y volver a cargar la lista entera no sabe dar de baja a
nadie.

Está en *Ajustes → Alumnos*, fuera del camino diario. La baja es suave y reversible, y
**un dado de baja sigue apareciendo en los trimestres ya cerrados**: darlo de baja en
noviembre no puede cambiar la boleta de octubre que ya se entregó.

Verificado en el navegador: alta con el número propuesto, aviso de número repetido
mientras se escribe, corrección conservando el `id`, baja que desaparece de la pantalla
de asistencia sin borrar la fila, y reactivar.

**Lo que conviene saber:** volver a cargar la lista con IA **revive** a un alumno dado
de baja si viene en el archivo nuevo. Es correcto —si la escuela lo trae en la lista
oficial, está inscrito— pero sorprende si no se espera.

## Alcance nuevo: la lista real (2026-08-29)

Lo pidió el usuario al ir a cargar la lista de verdad, y llegó con dos archivos reales
que tiraron tres supuestos de `C10c` a la vez (D-027). Está todo hecho, C38 a C42.

- **La lista puede ser un Excel**, y se abre **en el dispositivo, sin red y al
  instante**: `services/xlsx.ts` descomprime el zip con `DecompressionStream` y lee el
  XML con `DOMParser` —cero dependencias nuevas, contra los cuatrocientos kilobytes de
  SheetJS—, y `application/hoja.ts` reconoce las columnas. Solo si no las reconoce se
  manda la hoja como texto a la IA.
- **El CURP entra al modelo**, porque la lista oficial **no imprime la fecha de
  nacimiento** y la trae dentro. Con eso el aviso de cumpleaños (`C15`) funciona sin
  teclear una sola fecha. Y sus cuatro primeras letras dicen dónde acaban los apellidos
  en un nombre impreso sin coma, que es donde un modelo se equivoca.
- **La lista se carga en varias hojas**, sumando en vez de reemplazar: treinta y siete
  alumnos vienen en dos páginas. Una hoja que falla ya no tira las que sí se leyeron.

Verificado con `npm test` (958 pruebas) y, para la parte que las pruebas puras no
alcanzan, corriendo `leerHoja` **contra el archivo real**: 38 alumnos, encabezados en la
fila 8, datos desde la 11 y el nombre bien partido.

**Lo que falta de esto, y necesita el dispositivo o la nube:**

1. La migración `20260829000000_alumnos_curp.sql` **no está aplicada** en Supabase. Hasta
   que lo esté, subir alumnos con CURP lo rechazaría PostgREST.
2. La pantalla de carga **no se ha visto en el iPad**: elegir varias fotos de la galería,
   abrir un `.xlsx` desde Archivos, y comprobar que `DecompressionStream` está en ese
   Safari —existe desde iPadOS 16.4—.
3. Una foto real por la IA con el CURP: el esquema y las instrucciones cambiaron y solo
   se han probado contra la nube simulada.

## Alcance nuevo: la pasada de interfaz (2026-08-29)

Lo pidió el usuario: una auditoría de UX/UI de la aplicación entera, la corrección de
lo encontrado, personalización para la usuaria y una revisión de todos los textos.
Está todo hecho, C43 a C51.

La auditoría, sobre las veintidós pantallas, encontró tres clases de cosa:

- **Defectos que engañaban** (`C43`): el aviso de versión nueva era `fixed` y tapaba
  la tira de días; el contador decía «0 / 0 · Todos presentes» sin lista cargada; el
  estado vacío de Asistencia esperaba debajo de dos cosas que sin alumnos no dicen
  nada; una confirmación describía la acción equivocada; y que una rúbrica en uso no
  se pueda borrar se explicaba en un `title`, que **en el iPad no existe**.
- **Erosión del sistema de diseño**: la cabecera copiada doce veces, el selector de
  trimestre cuatro, `text-[13px]` ciento una, el anillo de foco diecisiete. Y dos
  elementos de identidad que `docs/UX.md` describía **sin estar implementados**: la
  cuadrícula de cuaderno y el aviso con Sonner —el primero ya está; el segundo sigue
  sin hacer falta, porque cada pantalla dice lo suyo en su sitio—.
- **Textos que delataban la máquina**: nombres de tabla impresos al usuario, la
  mecánica de la cola de sincronía en una línea de estado, fechas `AAAA-MM-DD` en
  ocho sitios, errores de Postgres en inglés, tuteo mezclado con usted, y una nota del
  cuaderno de desarrollo a la vista.

**La personalización** (D-028) obligó a la decisión de fondo: `--color-azul` hacía dos
trabajos —identidad y «presente»— y hubo que partirlo. Lo que la usuaria elige pinta la
identidad; el bicolor no se toca, y la pantalla lo **enseña** con una muestra de las
cuatro filas en vez de prometerlo por escrito.

Verificado en el navegador: los seis colores, los tres modos y los tres tamaños
comprobando en cada combinación que los cuatro estados siguen distinguiéndose; que la
apariencia sobrevive a recargar; y que con `localStorage` lleno de basura la aplicación
arranca con el tema de siempre en vez de romperse. **En el iPad, nada de esto se ha
visto todavía** —como el resto de la Fase 4 en adelante—: falta comprobar los tres
tamaños de texto con el dispositivo en la mano y que el modo oscuro no pelee con la
barra de estado.

## Alcance nuevo: el sexo del alumno (2026-09-02)

Lo trajo el uso real: la hoja oficial pide al pie de cada día «H: __  M: __  T: __» y
la maestra lo contaba a mano sobre la pantalla. El dato ya estaba escrito en dos sitios
que la aplicación leía y tiraba —la columna SEXO del Excel y el carácter 11 del CURP—
(D-029). Son los commits `C43` a `C49`, más el fix `C47b`.

**El código está escrito y verificado en el navegador.** Con el Excel real de la
escuela: 38 alumnos, **18 niños y 20 niñas**, ninguno sin asignar, leídos de la columna
sin pasar por la IA. El contador dice «Faltaron 1 niño · 1 niña · 1 sin asignar», y al
pasar esa falta a retardo sale de la cuenta. En *Ajustes → Alumnos*, teclear el CURP
llena el sexo y la fecha a la vez, y no pisa lo que ya estuviera puesto.

### Lo que falta, y no es código

El grupo que ya está cargado en el iPad no tiene sexo ni CURP: entró por el Excel de la
escuela, que **no trae columna CURP**, así que en la nube había cero CURP guardados y el
carácter 11 no tenía de dónde salir. Se arregla con una operación de datos, en este
orden:

| | Paso | Quién | El seguro |
|---|---|---|---|
| 1 | Aplicar la migración `20260902000000_alumnos_sexo.sql` | Desarrollo | Independiente: puede ir días antes y no rompe la app en uso |
| 2 | *Grupo → Ajustes → Nube → Subir pendientes* | La maestra | **No seguir si no dice 0 pendientes** |
| 3 | `UPDATE` de los 38 con su CURP y su sexo | Desarrollo | Solo `curp`, `sexo` y `updated_at`; un `SELECT` antes y después |
| 4 | *Nube → Restaurar de la nube* | La maestra | Baja las 16 tablas y escribe encima: por eso el paso 2 |
| 5 | Desplegar el front y `supabase functions deploy extraer-lista` | Desarrollo | Puede ir antes o después del 4 |

**Los pasos 2, 3 y 4 van pegados, sin que ella use el iPad en medio.** Es el riesgo que
no se ve: el cliente viejo **sí conoce `curp`** —existe desde el 2026-08-29— y su copia
local lo tiene vacío, así que si sincroniza entre el `UPDATE` y el restaurar, sube
`curp: null` y borra lo recién escrito. El `sexo` no corre ese riesgo, porque el cliente
viejo no manda esa clave y PostgREST la conserva.

Los CURP salen de la lista de Control Escolar, que está en `.gitignore` y ahí se queda.
El mapeo por `numero_lista` está comprobado dos veces: los nombres coinciden uno a uno
con los de la nube, y la `fecha_nacimiento` ya guardada coincide con la que codifica cada
CURP, incluidos los tres alumnos que no nacieron en 2016.

Falta el CURP de **uno solo, el 38** —Zermeño Cruz, Luis Santiago—, que queda sin asignar
hasta que llegue; se le puede poner a mano en *Ajustes → Alumnos* mientras tanto.

## Alcance nuevo: el orden alfabético y los reportes (2026-09-07)

Lo pidió el usuario, dos cosas sin relación entre sí (docs/DECISIONES.md D-030).
**Está hecho y verificado en el navegador.**

- **El grupo se lee por apellido**, no por número de alta. El orden lo pone el
  adaptador de alumnos en sus métodos de lectura, así que ordena las once pantallas
  que listan alumnos sin tocar ninguna: `application/` y `ui/` ya conservaban el
  orden que les llega. El `numero_lista` no cambia —sigue siendo la identidad y se
  sigue mostrando—, pero **deja de ir 1, 2, 3… en cuanto haya un alta tardía**, que
  es justamente lo que se pedía.
- **Hay una pantalla *Reportes*** en Grupo, con un solo renglón hoy y hecha para
  crecer: agregar el segundo es agregar un objeto a un arreglo.
- **El primer reporte es *Faltas de la semana***: el total con su corte por sexo y el
  día a día, que suma exactamente ese total. Cuenta faltas y no alumnos, falta es
  solo `ausente`, y un día sin registrar no sale en cero.

Verificado en el navegador con ocho alumnos sembrados a mano: el 39 y el 40 salen
entre el 1 y el 2 en Asistencia y en *Ajustes → Alumnos*, «Ávila» cae entre
«Aguirre» y «Barrera», el reporte da 4 faltas —2 niños · 1 niña · 1 sin asignar—
con el retardo y la justificada fuera de la cuenta, el miércoles sin capturar no
aparece y la semana anterior muestra el estado vacío. **En el iPad, nada de esto se
ha visto** —como el resto de la Fase 4 en adelante—.

Lo que trajo de paso: `ListaDeOpciones` y `frasePorSexo`, extraídos de `Ajustes` y
del contador diario antes de tener una segunda copia; y `comoRango` dejó de repetir
el mes —«del 7 al 11 de septiembre de 2026»—, que es la forma que toma una semana.

## Supuestos que siguen abiertos

Lo que todavía está marcado `[POR VALIDAR]` y qué bloquea cada uno:

| Pregunta | Bloquea |
|---|---|
| ¿Cuál es el umbral real de riesgo por asistencia y de promedio? | Ya no bloquea nada: `C13` usa 90 % y 6.0 y **los escribe en la pantalla** |
| ¿Cuántos retardos hacen una falta, por omisión? | El valor de arranque de C25b. 3 es una convención, no un dato |
| ¿El sorteo debe ser al azar puro en vez de ponderado? | C30. Hoy el plan pondera a favor de quien menos ha participado; cambiarlo es una función |
| ¿Los equipos se guardan de un día para otro? | C31. Hoy el plan dice que no: viven mientras la pantalla está abierta |
| ¿La conversión de retardos también cambia el **porcentaje de asistencia** del resumen? | C13. Recomendación: no —la escuela pide presencia, no puntualidad— |
| Sin ninguna participación capturada, ¿un alumno callado saca 0 o `—`? | C26. Hoy el plan dice `—` para todos si nadie tiene marcas, y 0 en cuanto alguien las tiene |
| ¿Una captura a medias debería dar calificación? | Se resolvió en C28 excluyéndola (D-019). Si ella espera lo contrario, es una línea de `valorDeEvaluacion` |
| Si se retoma participación: ¿premiar volumen? | C25, que está pospuesto |

Ya **no** están abiertos: la escala, la forma de evaluación y la utilidad de los
campos formativos —resueltos en la validación—; cuántos exámenes hay por trimestre y
con cuánta precisión se presenta una calificación, que quedaron en D-018 —**uno** y
**un decimal**—; y la meta de participación, que quedó en **5** con reparto
proporcional (D-021).

## Deuda conocida

- **La regla de D-019 —una captura a medias no produce calificación— la decidí yo,
  no la usuaria**, y ya **no es inocua**: con `C29` construido, es la regla que decide
  el «10.0 sobre 40» del reporte y el snapshot del cierre. Sigue siendo una de las dos
  preguntas que faltan por hacerle.
- El examen **no tiene forma de decir cuántas preguntas trae por fuera de su propia
  pantalla**, y esa pantalla vive dentro de Calificaciones. Es una configuración
  —una vez por trimestre— viviendo en el camino de captura; funciona, pero no es
  donde vive el resto de lo que se configura.
- **Nada compara los aciertos con las preguntas después de bajar un total.** Se
  rechaza el cambio, que es lo correcto, pero la pantalla no dice *quién* está
  fuera de rango: hay que buscarlo en la lista.
- La captura con rúbrica **no está medida con cronómetro**, ni en el navegador ni
  en el iPad. No tiene el presupuesto de 15 segundos de la asistencia —son tantos
  toques como renglones por alumno— pero cuánto cuesta de verdad un grupo de 30
  solo se sabe con el iPad en la mano.
- **Sostener el dedo para restar una participación solo se ha probado con eventos
  sintéticos.** Funciona —el `click` que llega después no vuelve a sumar, comprobado
  en el navegador— pero en iPadOS la pulsación larga pelea con el menú de selección.
  Lleva `select-none`, `touch-manipulation` y `preventDefault`, y eso quiere un dedo
  de verdad.
- Un alumno a medias se ve como pendiente y nada avisa cuántos quedaron así al
  salir: el contador dice «12 de 30», no «hay tres a medias».
- El criterio de los 15 segundos de C22 está medido en el navegador (73 ms para
  cuatro toques, incluyendo el viaje a IndexedDB), **no en el iPad con cronómetro**.
  Falta confirmarlo en el dispositivo, como se hizo con C8.
- No hay forma de reordenar los renglones de una rúbrica desde la pantalla. El
  `orden` se guarda y se respeta, y el adaptador ya sabe reordenar si le llegan en
  otro orden; falta el gesto en la interfaz.
- No hay forma de **reordenar** las actividades de un criterio ni de moverlas a
  otro. Se ordenan por fecha, que es como ella las busca.
- Un ciclo puede quedarse con uno o dos trimestres indefinidamente si ella no abre
  los que faltan. Es un estado válido —y la asistencia lo dice en la etiqueta— pero
  nada le recuerda que los abra.
- Las filas de `criterios_trimestre` creadas antes del fix conservan un
  `rubrica_id` que ya nadie lee. Solo existe en bases de desarrollo —`version(2)`
  no se ha desplegado— y es una propiedad de sobra, no un dato que mienta.
- No hay forma de reordenar los criterios de un trimestre. El campo `orden`
  existe y se respeta al leer, pero solo lo fija el orden de alta.
- **Reabrir un trimestre no queda registrado más que por la huella de
  `cerrado_en`**: no hay bitácora, así que no se sabe cuándo se reabrió ni cuántas
  veces. El snapshot anterior se borra en suave, así que tampoco queda a la vista
  qué decía antes.
- **El respaldo y la sincronía existen, pero el iPad real todavía no los ha usado.**
  Mientras no se haga una copia —a archivo o a la nube— desde el dispositivo, el
  único ejemplar de los datos reales sigue viviendo ahí. Es el riesgo más viejo del
  proyecto y ya no es por falta de código.
- Los criterios de aceptación de C10 y C10c que dependen del dispositivo se
  marcaron al momento de la entrega. No se han vuelto a correr desde entonces.

## Bitácora de la documentación

`docs/actualizacion/` traía el modelo de evaluación validado con la usuaria. Su
contenido ya está absorbido en [DATA-MODEL.md](./DATA-MODEL.md) y
[COMMITS.md](./COMMITS.md), con dos ajustes respecto a lo que traía:

- Su `C17` (cargar lista desde imagen) ya estaba construido como `C10c`,
  que esa copia no conocía. No se reintrodujo.
- Su decisión de evaluación se citaba como `D-012`, número que en este repositorio
  ya lo ocupa la decisión sobre Vitest. Quedó como **D-015**.

La carpeta se puede borrar.
