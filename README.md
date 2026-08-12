# Fedes Landing CMS — Google Apps Script

Backend/CMS de `FedesConsultora/FedesConsultora_Landing`, basado en Google Apps Script + Google Sheets + Google Drive.

## Qué resuelve

- Google Sheets como base de datos específica de la landing.
- Setup idempotente: crea hojas y columnas sin borrar pestañas legacy.
- Migración inicial de datos legacy.
- CMS con estados `draft / published / hidden / archived`.
- Soft delete, restauración, duplicado y orden.
- Historial `_AuditLog`.
- Google Drive para imágenes.
- Panel administrativo con HtmlService + `google.script.run`.
- Password de administración hasheado en Script Properties.
- Cache pública y locks para escrituras.
- API pública JSON/JSONP y API interna autenticada.
- Funnel Galicia en dos pasos con persistencia temprana y scoring del lado servidor.
- Dedupe por campaña + email, autosave de respuestas y recuperación por token opaco.
- `CRM_LeadMailings` preparado para secuencias A/B/C/D.
- API interna preparada para futura integración con VADDAR.

## Instalación nueva

1. Abrí o creá el proyecto Apps Script asociado a la Sheet de Fedes.
2. Configurá `.clasp.json` localmente con el `scriptId`; no lo commitees.
3. Ejecutá `clasp push`.
4. Ejecutá `setupFedesCms()` una sola vez y autorizá Sheets/Drive.
5. Guardá de forma segura las credenciales iniciales generadas por el setup.
6. Desplegá como Web App con acceso público para la landing. Las operaciones administrativas siguen protegidas por sesión.
7. Panel: `WEB_APP_URL?page=admin`.
8. Health: `WEB_APP_URL?api=health`.

No ejecutes `setupFedesCms()` para upgrades de una base productiva ya inicializada salvo que el cambio haya sido diseñado específicamente para ello.

## CORS

Apps Script no permite agregar arbitrariamente `Access-Control-Allow-Origin` a `ContentService` de forma confiable. Por eso:

- las lecturas públicas desde React usan JSONP;
- las escrituras públicas usan POST `no-cors` y confirmación posterior por lectura;
- el panel usa `google.script.run`;
- VADDAR consumirá server-to-server mediante POST autenticado.

No usar helpers que intenten llamar `setHeader(...)` sobre `TextOutput`.

## Compatibilidad legacy

GET temporales:

- `?action=blog`
- `?action=galeria`
- `?action=getProgress&cuit=...`
- `?action=getAllOnboardings`
- `?action=getAllContacts`
- `?action=getAnalyticsTracking`

POST temporales:

- `contact`
- `onboardingStep0`
- `onboardingStep1`
- `saveProgress`
- `track`
- `addGaleriaFoto`
- `deleteGaleriaFoto`

Galicia:

- `galiciaStart`
- `galiciaProgress`
- `galiciaComplete`
- `galiciaMeetingClick`

## Seguridad de onboarding

La implementación nueva descarta campos de contraseña del onboarding antiguo y no los persiste en `ONB_Records.data_json`.

La reparación legacy realizada el 2026-08-12 fue validada con cero claves sensibles en las filas activas nuevas. El historial está documentado en `docs/MIGRATIONS.md`.

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
- `?api=galicia-resume&token=<opaque-token>`

Las lecturas públicas aceptan `callback=<fn>` cuando se consumen vía JSONP.

El token de recuperación en claro sólo se entrega al flujo que genera el enlace. En Sheets se persiste únicamente su hash y fecha de expiración.

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

La API key no debe exponerse en React ni almacenarse en la Sheet en claro.

## Migraciones

Las migraciones manuales ya ejecutadas y sus resultados están registradas en `docs/MIGRATIONS.md` y en el historial Git.

Los archivos temporales de repair/upgrade y las funciones `verify*` se eliminan del runtime una vez validados. El esquema vigente siempre debe quedar consolidado en `Schema.gs` y el comportamiento productivo en los servicios normales.

## Estado actual

- Schema CRM: v3.
- Backend: 2.2.0.
- Recuperación Galicia por token: implementada en backend.
- Autosave Galicia: implementado en backend; pendiente conectar la landing React.
- Mailings A/B/C/D: estructura de datos preparada; proveedor/envío automático pendiente.
- Integración PostgreSQL/VADDAR: pendiente.
