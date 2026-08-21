# PWA en iPadOS

El dispositivo objetivo es un iPad. Estas son restricciones reales de Safari, no
preferencias. Varias no tienen solución alternativa.

Advertencia general: este documento refleja el comportamiento conocido hasta
**mayo de 2026**. Apple ha ido cambiando estas políticas versión por versión.
Verificar contra la documentación oficial antes de depender de cualquiera de
estos puntos.

## La regla que sostiene todo el proyecto

**La app tiene que estar instalada en la pantalla de inicio, no abierta como
pestaña de Safari.**

En Safari, los datos locales de un sitio web se pueden borrar tras **7 días sin
uso**. Las PWA instaladas en la pantalla de inicio están exentas de esa política.

Consecuencias operativas:

- El desarrollador instala la app en el iPad y le explica que se abre desde el
  ícono, nunca desde el navegador.
- Llamar `navigator.storage.persist()` al arrancar.
- Aun así: **tratar IndexedDB como caché, no como fuente de verdad última.** Si
  ella borra datos de Safari o el iPad se queda sin espacio, se puede perder. Por
  eso el respaldo importa desde temprano.

## Configuración mínima

`index.html`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

- `viewport-fit=cover` habilita `env(safe-area-inset-*)`, necesario para que la
  barra de pestañas no quede bajo el indicador de home.
- `apple-mobile-web-app-capable` está deprecado y Chrome lo avisa en consola,
  pero Safari sigue usándolo: van los dos metas hasta que Safari acepte solo el
  estándar.
- `apple-touch-icon` de 180 × 180 px en `/public`. Sin él, el ícono en la pantalla
  de inicio sale como una captura borrosa de la página. Safari históricamente ha
  ignorado partes del manifest, así que este link va aparte.

`vite.config.ts`:

```ts
VitePWA({
  registerType: 'prompt',
  includeAssets: ['apple-touch-icon.png'],
  manifest: {
    name: 'Palomita',
    short_name: 'Palomita',
    description: 'Control de grupo',
    theme_color: '#1B4F9C',
    background_color: '#FBFAF7',
    display: 'standalone',
    start_url: '/',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
})
```

## Lo que no existe en iOS

| Capacidad | Estado | Implicación |
|---|---|---|
| Background Sync API | No existe | Toda sincronía ocurre con la app abierta |
| Notification Triggers | No existe | No hay notificaciones locales agendadas |
| Web Push | Existe desde iOS 16.4, solo instalada | Requiere servidor. Ver DECISIONES |
| Fullscreen API | Limitada | No depender de ella |

**Background Sync** es la más consecuente: el motor de sincronía se diseña como
"al abrir y al cerrar", nunca como algo que pasa solo en segundo plano.

## Trampas concretas

### Zoom automático en inputs

Safari hace zoom al enfocar cualquier campo con `font-size` menor a 16 px.
En una tabla de calificaciones es intolerable. **16 px es piso, no sugerencia.**

### `crypto.randomUUID()` requiere contexto seguro

Funciona en HTTPS y `localhost`. **No funciona** en `http://192.168.x.x`.

Esto muerde exactamente cuando pruebas en el iPad por red local con
`npm run dev -- --host`: la app arranca y falla al crear el primer registro.
Si necesitas probar así, usa un fallback en desarrollo o un túnel HTTPS.

### El service worker no corre sobre HTTP

Salvo en `localhost`. Consecuencia práctica del flujo de trabajo:

- Desarrollo y depuración: navegador de escritorio, `localhost`
- Validación de instalación y comportamiento offline: solo en el deploy de Vercel

No se puede probar la instalación como PWA desde `npm run dev` en el iPad.

### Reinstalar borra todo

Si ella quita el ícono y lo vuelve a agregar, IndexedDB se va con él. Una razón
más para tener exportación de respaldo antes de que existan datos de un ciclo
completo.

## Antes de la primera sincronía (una vez, en Supabase)

- [x] **Aplicar la migración.** Hecha el 2026-08-21 en el proyecto
      `mvqgzzngpdkhbdcsiaes`, que estaba vacío:
      `supabase/migrations/20260821213419_esquema_sincronizable.sql`. Las dieciséis
      tablas tienen RLS activo y cuatro políticas cada una, y los avisos de
      seguridad y de rendimiento del proyecto salen limpios. Comprobado con la clave
      publicable —la que viaja en el bundle— que un `select` devuelve cero filas y un
      `insert` se rechaza con `42501`: sin sesión no se lee ni se escribe nada.
- [ ] **Crear su cuenta** en *Authentication → Users*, con correo y contraseña. Es la
      que se teclea una vez en Ajustes → Copia en la nube. Requiere el panel: no se
      puede hacer desde el repositorio.
- [ ] **Apagar los registros públicos** en *Authentication → Providers → Email*,
      quitando *Enable signups*. Con `signup` abierto cualquiera puede crear un
      usuario; no vería nada de ella —las políticas lo impiden— pero no hay razón
      para dejar la puerta.

Sin esos pasos la app funciona igual: la nube es un respaldo, no una dependencia
(docs/DECISIONES.md D-023). Y hasta que exista la cuenta, la subida y la
restauración **no se han probado contra Supabase de verdad**: lo que está probado es
el motor, contra una nube simulada.

## Lista de verificación antes de entregarle el iPad

- [ ] Instalada desde el ícono de la pantalla de inicio, no en pestaña
- [ ] `navigator.storage.persist()` devuelve `true`
- [ ] Se abre con el WiFi apagado y muestra los datos
- [ ] Se puede pasar asistencia completa sin red
- [ ] Al reconectar no se pierde nada de lo capturado offline
- [ ] Ningún input provoca zoom al enfocarlo
- [ ] La barra de pestañas no queda bajo el indicador de home
- [ ] El ícono se ve nítido en la pantalla de inicio
- [ ] Rotar el iPad no rompe el layout
- [ ] Existe una forma de exportar respaldo — hay pantalla (*Grupo → Ajustes →
      Respaldo*); falta ver en el iPad que la hoja de compartir ofrezca *Guardar en
      Archivos* y que el selector de archivos abra Archivos al restaurar
- [ ] La sesión de la nube sobrevive a cerrar y volver a abrir la PWA — se guarda en
      `localStorage`, y en la PWA instalada eso hay que verlo, no suponerlo
- [ ] Con el WiFi apagado, capturar y volver a abrir deja los cambios en la cola y la
      subida ocurre al reconectar y volver a entrar
- [ ] Restaurar en un iPad limpio reconstruye el ciclo completo
