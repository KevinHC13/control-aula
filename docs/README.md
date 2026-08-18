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
- Calificaciones por actividad, escala 5–10
- Anecdotario: notas libres por alumno
- Resumen por alumno: % de asistencia y promedio
- Instalable en el iPad, funcional sin red

Fuera, a propósito:

- Login y usuarios
- Portal para padres
- Planeación didáctica
- Motor de rúbricas y ponderaciones configurables
- Multi-grupo y multi-ciclo escolar
- Notificaciones push
- Pantalla de configuración

Cada una de esas ausencias es una decisión, no un pendiente. Ver
[DECISIONES.md](./DECISIONES.md).

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
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Capas, puertos y adaptadores, reglas de dependencia |
| [DATA-MODEL.md](./DATA-MODEL.md) | Entidades, esquema de Dexie, invariantes de sincronía |
| [UX.md](./UX.md) | Principios de interacción y decisiones de interfaz |
| [PWA-IOS.md](./PWA-IOS.md) | Restricciones reales de Safari e iPadOS |
| [COMMITS.md](./COMMITS.md) | Convención de commits y plan con criterios de aceptación |
| [DECISIONES.md](./DECISIONES.md) | Registro de decisiones técnicas y su justificación |

## Advertencia sobre el dominio

Este documento y los demás contienen supuestos sobre la evaluación en primaria
bajo la Nueva Escuela Mexicana (campos formativos, escala numérica, periodos)
que **no están validados con la usuaria ni con la normativa vigente de su
estado**.

Todo lo marcado con `[POR VALIDAR]` debe confirmarse contra tres artefactos
reales antes de construirse:

1. El cuaderno que usa hoy
2. El formato de informe que entrega al final del periodo
3. La plataforma donde captura las calificaciones oficiales

Diseñar desde la normativa en abstracto es la vía rápida a que la app se vuelva
trabajo extra y ella siga usando el cuaderno en paralelo.
