# Fedes Landing CMS — Google Apps Script

Reemplazo evolutivo del Apps Script actual de `FedesConsultora/FedesConsultora_Landing`.

## Qué resuelve

- Google Sheets como base de datos específica de la landing.
- Setup idempotente: crea las hojas y columnas automáticamente sin borrar las pestañas legacy.
- Migración automática de las pestañas existentes cuando las encuentra.
- CMS con estados `draft / published / hidden / archived`.
- Soft delete, restauración, duplicado y orden.
- Historial `_AuditLog`.
- Google Drive para imágenes.
- Panel administrativo responsive con HtmlService + `google.script.run`.
- Password hasheado en Script Properties.
- Cache pública.
- Locks para escrituras.
- API pública con JSON/JSONP.
- Compatibilidad temporal con las actions de la landing actual.
- Funnel Galicia en dos pasos con persistencia temprana y scoring del lado servidor.
- API interna preparada para que VADDAR consuma el CMS/leads más adelante.

## Instalación

1. Abrí el proyecto Apps Script actual que administra la Sheet de Fedes.
2. Conservá una copia del código anterior antes de reemplazarlo.
3. Creá los archivos `.gs` y `.html` incluidos en este paquete y pegá sus contenidos.
4. Reemplazá `appsscript.json` por el incluido.
5. Ejecutá `setupFedesCms()` desde el editor y autorizá Sheets/Drive.
6. Abrí el registro de ejecución. Allí aparecen una contraseña temporal del panel y una API key VADDAR inicial. Guardalas de forma segura.
7. Desplegá como Web App. Para la landing pública, el deployment debe permitir acceso sin login. Las operaciones administrativas siguen protegidas por contraseña + sesión y no exponen secretos en Sheets.
8. Panel: `WEB_APP_URL?page=admin`.
9. API: `WEB_APP_URL?api=health` y `WEB_APP_URL?api=bootstrap`.

## Importante sobre CORS

Apps Script no ofrece un mecanismo confiable para agregar arbitrariamente `Access-Control-Allow-Origin` a `ContentService`. Por eso:

- lecturas públicas desde React usan JSONP;
- escrituras públicas críticas usan POST `no-cors` y luego confirman persistencia consultando `lead-status` con un UUID generado por el cliente;
- el panel usa `google.script.run` y no necesita CORS;
- VADDAR consumirá server-to-server mediante POST autenticado.

No vuelvas a usar un helper `setCorsHeaders(output)` que invoque `output.setHeader(...)`: `TextOutput` no expone ese método.

## Compatibilidad con la landing existente

Se mantienen temporalmente:

GET:
- `?action=blog`
- `?action=galeria`
- `?action=getProgress&cuit=...`
- `?action=getAllOnboardings`
- `?action=getAllContacts`
- `?action=getAnalyticsTracking`

POST:
- `contact`
- `onboardingStep0`
- `onboardingStep1`
- `saveProgress`
- `track`
- `addGaleriaFoto`
- `deleteGaleriaFoto`

Nuevos:
- `galiciaStart`
- `galiciaComplete`
- `galiciaMeetingClick`

## Seguridad de onboarding

La implementación nueva descarta campos de contraseña enviados por el onboarding antiguo. No guarda contraseñas de Instagram, TikTok, Facebook ni passwords genéricas en Sheets.

## API pública

- `?api=health`
- `?api=bootstrap`
- `?api=blog`
- `?api=gallery`
- `?api=onboarding-modules`
- `?api=case-studies`
- `?api=testimonials`
- `?api=team`
- `?api=campaign&key=galicia-2026`
- `?api=lead-status&leadId=<uuid>`

Todos aceptan `callback=<fn>` para JSONP.

## API interna / VADDAR

POST body JSON:

```json
{ "action": "internalHealth", "apiKey": "..." }
```

```json
{ "action": "internalBootstrap", "apiKey": "..." }
```

```json
{ "action": "internalLeads", "apiKey": "...", "since": "2026-08-11T00:00:00.000Z" }
```

```json
{ "action": "internalAudit", "apiKey": "...", "since": "2026-08-11T00:00:00.000Z" }
```

Rotación: desde el panel/cliente administrativo llamar `adminRotateVaddarApiKey(token)`; la función interna de bootstrap no queda expuesta a `google.script.run`.

## Integración React/Vite

Copiar `client/types.ts` y `client/cms.ts` al proyecto de la landing. Configurar el endpoint desde una variable de entorno, por ejemplo:

```env
VITE_CMS_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

Luego:

```ts
const cms = new FedesCmsClient(import.meta.env.VITE_CMS_SCRIPT_URL)
const bootstrap = await cms.getBootstrap()
```

## Migración legacy

`setupFedesCms()` busca las hojas existentes:

- Respuestas_Contacto
- Tracking_Clicks
- Publicaciones_Blog
- Galeria_Fotos
- OnboardingProgress
- OnboardingEmpresas_Step0
- OnboardingEmpresas_Step1

Las lee y migra a las nuevas tablas sin eliminarlas. La migración queda marcada en Script Properties para no repetirse.

## Qué NO hace todavía

- No modifica automáticamente la landing React.
- No dispara mailings A/B/C/D.
- No integra Meta Pixel.
- No sincroniza todavía con PostgreSQL/VADDAR.
- No pretende reemplazar VADDAR como fuente corporativa futura.

Esas son fases posteriores deliberadas.
