# Estado del proyecto

Actualizado el **2026-08-21**, con la **Fase 4 terminada** —C18 a C29— más los
fixes C19b y C21c. Ese mismo día la usuaria **retomó los tres criterios
automáticos** con reglas propias (D-020): dejaron de estar pospuestos y son ahora
`C12`, `C25`, `C25b` y `C26`. Este es el documento que se lee primero para saber
dónde va el proyecto y qué sigue. El plan detallado, con criterios de aceptación
por commit, está en [COMMITS.md](./COMMITS.md).

Regla: **antes de afirmar que algo existe, verificarlo en `src/`.** Este archivo
se queda viejo; el código no.

---

## En una línea

Asistencia está terminada y entregada en el iPad. La semana de uso real ya pasó y
la validación con la usuaria tiró el modelo de calificaciones que estaba planeado.
La Fase 4 va en marcha: **C18 a C21 están hechos** —dominio de evaluación,
`db.version(2)`, el ciclo escolar con sus trimestres, los criterios con sus pesos y
las rúbricas, las actividades, las dos capturas de entregable y el examen por
aciertos—, con una corrección de modelo encima: la rúbrica cuelga de la actividad, no
del criterio (D-016). **Toda la captura de la Fase 4 está construida, y también el
cálculo** (C28), **el cierre con su snapshot** (C27) **y la pantalla donde ella lee
los números** (C29). **La Fase 4 está terminada.** Encima de eso entró alcance
nuevo: puntualidad, conducta y participación vuelven, con las reglas que dictó ella.
Aun así, el pendiente más urgente no es ninguna de esas tres: es que **el único
ejemplar de los datos reales vive en un iPad**.

## Fases

| Fase | Alcance | Estado |
|---|---|---|
| 1 · Cimientos | Scaffold, shadcn, dominio, Dexie, puertos | ✅ Terminada |
| 2 · Asistencia | El vertical completo hasta el iPad | ✅ Terminada |
| Hito | Entrega, pausa de una semana, validación | ✅ Cumplido |
| 3 · Resto de la v1 | Bitácora, resumen, respaldo, cumpleaños, sincronía | ▶ Pendiente |
| 5 · Criterios automáticos | Puntualidad, conducta y participación | ⬜ Alcance nuevo: C12, C25, C25b, C26 |
| 6 · Herramientas de aula | Sorteo de participación y formar equipos | ⬜ Alcance nuevo: C30, C31 |
| 4 · Evaluación | Ciclo, trimestres, criterios, rúbricas, cálculo | ✅ Terminada: C18–C24 y C27–C29 |

## Lo que existe y funciona

Verificado en `src/` a esta fecha:

| Capa | Contenido |
|---|---|
| `domain/` | `entities.ts` con la jerarquía de evaluación completa, `values.ts`, `fechas.ts`, `rules.ts`, `evaluacion.ts` (estructura) y `calculo.ts` (los números), con pruebas |
| `data/dexie/` | `db.ts` en `version(2)`, adaptadores de alumnos y asistencia, `outbox`, semilla |
| `data/ports/` | `alumnos.ts`, `asistencia.ts`, `evaluacion.ts` (ciclo, trimestres, criterios, pesos, rúbricas y actividades) |
| `application/` | `asistencia.ts`, `grupo.ts`, `importacion.ts`, `evaluacion.ts`, `entregas.ts`, `calificacion.ts`, `examen.ts`, `calificaciones.ts` (reporte y cierre) |
| `services/` | `extraccion.ts` — única salida a red del cliente |
| `ui/` | Cuatro pestañas, Asistencia completa (con la etiqueta del trimestre), Calificaciones con sus actividades, las tres capturas —entregas, rúbrica y examen, esta última con teclado propio— y el reporte del trimestre por alumno y por campo, Ajustes, CargarLista, CicloEscolar, CriteriosYPesos (con el cierre del trimestre), Rubricas |
| `tests/` | `arquitectura.test.ts` — verifica las reglas de dependencia en cada `npm test` |
| Infra | PWA con `vite-plugin-pwa` y aviso de actualización; Edge Function `extraer-lista` desplegada |

Pantalla de asistencia: tira de días de tres meses que se desliza, calendario del
mes como mosaico, contador de presentes, filas con ciclo de estados y barra
bicolor.

## Lo que es placeholder

`ui/screens/Notas.tsx` —que pasa a llamarse **Bitácora** (D-020)— y el resumen de
`ui/screens/Grupo.tsx`. Existen, navegan y no hacen nada. Son los dos únicos
placeholders que quedan: `Calificaciones` está completa —lista las actividades, las
captura de las tres formas y muestra el reporte del trimestre por alumno y por
campo—.

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
más. Era la única migración de la Fase 4 y ya está hecha, en C18.

Sobre el riesgo de esa migración: resultó no existir. La verificación que este
documento pedía hacer en el iPad —contar filas de `actividades` y
`calificaciones`— no hizo falta, porque **ninguna ruta de código escribió nunca en
esas tablas**: no hubo adaptador, puerto ni caso de uso que las tocara. Estaban
vacías por construcción. La migración se ensayó igual en
`src/data/dexie/migracion.test.ts`, sobre una base con el esquema viejo y
asistencia capturada.

## Con qué continuar

**Siguiente commit: `C14 · feat: exportar e importar respaldo en json`.** No es lo
más vistoso que queda, es lo más urgente: con la Fase 4 terminada, el iPad ya
acumula asistencia, actividades, rúbricas, calificaciones y cortes de trimestre, y
**no existe ninguna forma de recuperar el año si se pierde**. No hay sincronía, no
hay respaldo y no hay copia. Todo lo demás que falta puede esperar; esto no.

Ya se puede tomar sin volver a tocar nada: `version(2)` está en su lugar y
`TABLAS_SINCRONIZABLES` enumera exactamente las quince tablas que hay que exportar.

Ojo con el orden: si se toma antes de `version(3)` —que traen `C12` y `C25`— hay que
volver a él. Lo más limpio es hacer `version(3)` y el respaldo en el mismo tramo.

Después, el **alcance nuevo del 2026-08-21** (D-020 y D-021), en este orden:

1. `C12` · **bitácora** — la pestaña *Notas* pasa a llamarse así y cambia de
   significado: todo lo que se anota es un reporte y de ahí sale conducta. Trae
   `version(3)`.
2. `C25b` · **configurar los criterios automáticos** — los tres tipos en el selector
   de pesos, con `retardos_por_falta` y la meta de participación.
3. `C25` · **captura de participación** — el modo en la pantalla de asistencia y la
   tabla `participaciones`.
4. `C26` · **cálculo** de puntualidad, conducta y participación. Al entrar, los tres
   aparecen solos en el reporte de C29 y en el snapshot de C27.
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

- **`C14` · respaldo en JSON.** El mayor riesgo abierto del proyecto: el iPad guarda
  un trimestre entero de calificaciones y no hay copia. Ojo con el orden: exporta
  `TABLAS_SINCRONIZABLES`, así que tomarlo antes de `version(3)` obliga a volver a
  él —el mismo tropiezo que ya se anotó con `version(2)`—.
- **Los tres criterios automáticos**, en este orden: `C12` (bitácora, que también
  trae `version(3)`), `C25b` (configuración), `C25` (captura de participación) y
  `C26` (cálculo). El cálculo va al final porque hasta entonces no tiene de dónde
  leer, y cuando entre aparece solo en el reporte de C29 y en el snapshot de C27,
  sin tocar ninguna de las dos pantallas.
- **Las dos herramientas de aula:** `C30` (sortear quién participa, que escribe en
  `participaciones` y por eso va después de `C25`) y `C31` (formar equipos, que no
  depende de nada y no guarda nada). Son las dos únicas funciones del proyecto que se
  usan **con los niños mirando la pantalla**, así que se diseñan para leerse de
  lejos y para no hacer esperar.
- **`C13` · resumen del grupo.** Ya se puede completo: la asistencia siempre fue
  posible y el promedio sale de `reporteDeTrimestre`.
- **`C15` · cumpleaños.** Independiente por completo.
- **`C16` · sincronía.** El que cierra la v1.

Si se toma `C14` primero —recomendado— conviene hacer `version(3)` en el mismo
tramo, para no exportar un esquema que va a cambiar la semana siguiente.

## Alcance nuevo: los tres criterios automáticos

Estuvieron pospuestos por decisión de la usuaria y **el 2026-08-21 los retomó ella
misma, con reglas propias** (docs/DECISIONES.md D-020). Ya no son diseño de
referencia: son trabajo pendiente, y el detalle está en
[DATA-MODEL.md](./DATA-MODEL.md#criterios-automáticos) y en los commits `C12`,
`C25`, `C25b` y `C26`.

En corto, para no tener que abrir los otros dos documentos:

- **Puntualidad.** Configurable en dos niveles: si el criterio existe, se califica; y
  `retardos_por_falta` dice cuántos retardos hacen una falta, o que un retardo no
  penaliza. La calificación es `(días − faltas − retardos convertidos) ÷ días`.
- **Conducta.** Sale de la **bitácora** —la pantalla que se llamaba *Notas*—, donde
  todo lo que se anota es un reporte y todos los reportes son negativos. 0 o 1
  reportes → 10.0; 2 → 5.0; 3 o más → 0.0. El primero se deja pasar a propósito.
  Desaparece el `signo` que el diseño viejo iba a agregarle a cada nota.
- **Participación.** Se marca desde la pantalla de asistencia con un **modo**: con el
  interruptor prendido, tocar a un alumno le suma una participación en vez de ciclar
  su asistencia. Se califica **proporcional con tope contra una meta que nace en 5**
  (D-021): cinco participaciones o más valen 10.0, una vale 2.0.

Los tres se configuran como cualquier otro criterio: se usan si tienen fila en el
trimestre y pesan lo que diga su peso. Y ninguno aporta a un campo formativo —un
retardo no es de Lenguajes—, así que solo cuentan para el general.

**Lo que cuesta, escrito para no descubrirlo tarde:** la bitácora deja de ser un
lugar sin consecuencias para apuntar cosas, así que la pantalla tiene que decir que un
reporte afecta la conducta; y el modo de participación hace que el mismo toque
signifique dos cosas, así que tiene que verse imposible de ignorar, apagarse solo y
poder deshacerse.

## Supuestos que siguen abiertos

Lo que todavía está marcado `[POR VALIDAR]` y qué bloquea cada uno:

| Pregunta | Bloquea |
|---|---|
| ¿Cuál es el umbral real de riesgo por asistencia? | Solo el color de alerta de C13 |
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

- De las once tablas nuevas, tienen puerto y adaptador `ciclos`, `trimestres`,
  `criterios`, `criterios_trimestre`, `rubricas`, `rubrica_criterios`,
  `actividades`, `entregas` y `eval_rubrica`. `examen_config`, `resultados_examen`
  y `cierres` no se tocan todavía.
- **La regla de D-019 —una captura a medias no produce calificación— la decidí yo,
  no la usuaria.** Es coherente con lo que la pantalla ya llamaba «sin calificar» y
  con excluir una actividad sin registros, y nada de la boleta depende de ella
  todavía porque C29 no existe. Conviene confirmarla antes de que sí dependa.
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
- Un alumno a medias se ve como pendiente y nada avisa cuántos quedaron así al
  salir: el contador dice «12 de 30», no «hay tres a medias».
- El criterio de los 15 segundos de C22 está medido en el navegador (73 ms para
  cuatro toques, incluyendo el viaje a IndexedDB), **no en el iPad con cronómetro**.
  Falta confirmarlo en el dispositivo, como se hizo con C8.
- `CriterioTrimestre.meta_participacion` se escribe siempre en `null`: la copia de
  esquema lo arrastra, pero nada lo pone. Pertenece a participación, que está
  pospuesta.
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
- El respaldo no existe y la sincronía tampoco: el único ejemplar de los datos
  reales vive en un iPad.
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
