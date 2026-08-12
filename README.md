# Fedes Landing CMS — Google Apps Script

Backend, CMS y backoffice de `FedesConsultora/FedesConsultora_Landing`, basado en Google Apps Script + Google Sheets + Google Drive.

## Estado actual

- Backoffice: **3.0.0**.
- Schema: **v3**.
- Fuente de verdad: las tablas nuevas `CMS_*`, `CRM_*`, `ONB_Records`, `AN_Events`, `_AuditLog` y `_System`.
- Banco Galicia 2026 se gestiona como **una campaña dentro de `CRM_Campaigns`**, no como un sistema separado.
- Recuperación y autosave del funnel Galicia: implementados.
- `CRM_LeadMailings`: preparado para registrar secuencias y proveedor de mailing.
- Integración PostgreSQL/VADDAR: futura; no exponer credenciales en frontend.

## Backoffice 3.0

Panel: `WEB_APP_URL?page=admin`. La landing React lo monta en `/admin` mediante iframe sobre la misma Web App de Apps Script.

El panel usa autenticación real del backend: contraseña hasheada en Script Properties y token de sesión temporal en `CacheService`. No existe PIN de administración dentro del bundle React.

### Módulos

**CRM**

- Contactos
- Campañas
- Leads
- Respuestas de Leads
- Eventos de Leads
- Mailings

**Onboarding**

- Legajos de `ONB_Records`
- Vista 360° con datos normalizados y respuestas estratégicas

**Web / CMS**

- Configuración
- Contenido Web
- Módulos de Onboarding
- Casos de éxito
- Testimonios
- Equipo
- Blog y Recursos
- Galería
- Media / Drive

**Datos**

- Analítica
- Auditoría
- Sistema

### ABMC y consulta

Las tablas operativas tienen, según su naturaleza:

- Alta
- Baja lógica / archivo y restauración
- Baja definitiva solamente en tablas de eventos sin `archived_at`
- Modificación
- Consulta de todos los campos
- Duplicación sólo en entidades donde no rompe integridad
- Selección y acciones masivas
- Búsqueda libre
- Filtros por facetas reales de la base
- Filtro por fechas
- Inclusión de registros dados de baja
- Orden ascendente / descendente por campo
- Paginación
- Exportación CSV de la consulta filtrada

`_AuditLog` y `_System` son deliberadamente de **solo lectura**. Permitir ABM sobre auditoría o metadatos internos destruiría la trazabilidad del sistema.

### Vistas 360°

**Campaña 360°** funciona para cualquier `campaign_key` y muestra leads, conversión, completitud, fuentes, segmentos, mailings y actividad. Galicia usa la misma arquitectura que cualquier campaña futura.

**Lead 360°** reúne perfil, atribución, scoring interno, revisión manual, respuestas, eventos, mailings, responsable, próxima acción y estado de reunión.

**Onboarding 360°** reúne el legajo normalizado, estado, paso y respuestas. El panel vuelve a aplicar redacción defensiva sobre claves sensibles antes de mostrar `data_json`.

## Qué resuelve

- Google Sheets como base operativa y CMS específico de la web.
- Setup idempotente para instalaciones nuevas.
- CMS con estados `draft / published / hidden / archived`.
- Historial `_AuditLog` para escrituras administrativas.
- Google Drive para imágenes.
- Cache pública y locks para escrituras.
- API pública JSON/JSONP y API interna autenticada.
- Funnel de campañas con captura temprana, scoring, dedupe, autosave y recuperación.
- Base preparada para mailings y futura conexión con VADDAR.

## Instalación nueva

1. Abrí o creá el proyecto Apps Script asociado a la Sheet de Fedes.
2. Configurá `.clasp.json` localmente con el `scriptId`; no lo commitees.
3. Ejecutá `clasp push`.
4. Ejecutá `setupFedesCms()` una sola vez en una instalación nueva.
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

## Compatibilidad legacy

Los endpoints `?action=...` históricos se conservan temporalmente para no romper la landing mientras se completa la transición. Las tablas legacy no son la fuente de verdad del backoffice 3.0.

## Seguridad de onboarding

La implementación nueva descarta campos de contraseña del onboarding antiguo y no los persiste en `ONB_Records.data_json`.

La reparación legacy realizada el 2026-08-12 fue validada con cero claves sensibles en las filas activas nuevas. El backoffice además redacta recursivamente claves que parezcan contraseña, secreto o hash de recuperación antes de mostrarlas.

## API pública

- `?api=health`
- `?api=bootstrap`
- `?api=blog`
- `?api=gallery`
- `?api=onboarding-modules`
- `?api=case-studies`
- `?api=testimonials`
- `?api=team`
- `?api=campaign&key=<campaign-key>`
- `?api=lead-status&leadId=<uuid>`
- `?api=lead-progress&leadId=<uuid>`
- `?api=galicia-resume&token=<opaque-token>`

El token de recuperación en claro sólo se entrega al flujo que genera el enlace. En Sheets se persiste únicamente su hash y fecha de expiración.

## API interna / VADDAR

La API interna usa POST autenticado mediante API key hasheada en Script Properties. La API key no debe exponerse en React ni almacenarse en la Sheet en claro.

## Migraciones

Las migraciones manuales ya ejecutadas y sus resultados están registradas en `docs/MIGRATIONS.md` y en el historial Git. Los archivos temporales de repair/upgrade y las funciones `verify*` se eliminan del runtime una vez validados.
