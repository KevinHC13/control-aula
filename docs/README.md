# Palomita

App de control de grupo para una maestra de primaria. Un solo usuario, un solo
dispositivo (iPad), sin conexión garantizada.

## El problema

Una maestra de primaria lleva a mano la asistencia, las calificaciones y las
notas de su grupo. No le gusta hacerlo y no maneja Excel. El registro vive en un
cuaderno y se transcribe después a la plataforma oficial de la escuela.

## El criterio que gobierna todas las decisiones

**La competencia no es Excel ni Additio. Es el cuaderno.**

El cuaderno gana siempre porque no hay que desbloquear nada, esperar carga ni
pensar dónde va cada dato. Por eso el criterio de diseño no es cuántas funciones
tiene la app, sino **cuántos toques cuesta registrar el día**.

Si pasar asistencia de 30 alumnos toma más de 15 segundos, el producto está
muerto en dos semanas. Todo lo demás es secundario a eso.

## Alcance de la v1

Dentro:

- Asistencia diaria con cuatro estados
- Evaluación por trimestre: criterios con peso, rúbricas de cuatro niveles,
  entregas y aciertos de examen por campo formativo
- Anecdotario: notas libres por alumno
- Resumen por alumno: % de asistencia y calificación del trimestre
- Instalable en el iPad, funcional sin red

Fuera, a propósito:

- Login y usuarios
- Portal para padres
- Planeación didáctica
- Multi-grupo
- Notificaciones push
- Criterios automáticos de puntualidad, conducta y participación — pospuestos por
  decisión de la usuaria, no descartados

Cada una de esas ausencias es una decisión, no un pendiente. Ver
[DECISIONES.md](./DECISIONES.md).

El motor de rúbricas y ponderaciones y el multi-ciclo escolar **estaban** en esta
lista de exclusiones. Entraron después de la semana de uso real: así evalúa ella,
y una pantalla de calificaciones que no se parezca a eso no se usaría (D-015).

## Stack

| Pieza | Elección |
|---|---|
| Build | Vite |
| UI | React 19 + TypeScript |
| Estilos | Tailwind v4 (plugin de Vite) |
| Componentes | shadcn/ui — primitivos, código en el repo |
| Persistencia | Dexie sobre IndexedDB |
| Estado de UI | Zustand |
| PWA | vite-plugin-pwa |
| Hosting | Vercel |
| Respaldo remoto | Supabase — fase 2, no en la v1 |

## Documentos

| Archivo | Qué contiene |
|---|---|
| [ESTADO.md](./ESTADO.md) | **Empezar aquí.** Qué está hecho, qué sigue, qué está bloqueado |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Capas, puertos y adaptadores, reglas de dependencia |
| [DATA-MODEL.md](./DATA-MODEL.md) | Entidades, jerarquía de evaluación, cálculo, esquema de Dexie |
| [UX.md](./UX.md) | Principios de interacción y decisiones de interfaz |
| [PWA-IOS.md](./PWA-IOS.md) | Restricciones reales de Safari e iPadOS |
| [COMMITS.md](./COMMITS.md) | Convención de commits y plan con criterios de aceptación |
| [CARGA-LISTA-IA.md](./CARGA-LISTA-IA.md) | Extracción de la lista oficial con IA, de punta a punta |
| [DECISIONES.md](./DECISIONES.md) | Registro de decisiones técnicas y su justificación |

## Advertencia sobre el dominio

Los supuestos gruesos sobre evaluación **ya se validaron** con la usuaria después
de la semana de uso real, y la validación tiró el modelo que estaba planeado: la
escala 5–10 no existía en su práctica. Lo que hay hoy —rúbricas, pesos,
trimestres, campos formativos como agrupación de reporte— sale de sus artefactos
reales, no de la normativa en abstracto.

Quedan supuestos abiertos, todos marcados `[POR VALIDAR]` y listados con lo que
bloquea cada uno en [ESTADO.md](./ESTADO.md). Ninguno es estructural.

La lección se conserva porque va a volver a aplicar: diseñar desde la normativa en
abstracto es la vía rápida a que la app se vuelva trabajo extra y ella siga usando
el cuaderno en paralelo. Antes de construir una pantalla nueva de evaluación, se
mira lo que ella entrega, no lo que dice el plan de estudios.
