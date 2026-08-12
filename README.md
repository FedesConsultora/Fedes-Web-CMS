# Fedes Landing CMS — Google Apps Script

Backend de datos de `FedesConsultora/FedesConsultora_Landing`, basado en Google Apps Script + Google Sheets + Google Drive.

## Estado actual

- Backend: **4.0.0**.
- Schema: **v3**.
- Backoffice: **100% React** en `FedesConsultora_Landing/src/pages/Admin`.
- Apps Script ya no contiene ni renderiza HTML del panel administrativo.
- Fuente de verdad: `CMS_*`, `CRM_*`, `ONB_Records`, `AN_Events`, `_AuditLog` y `_System`.
- Banco Galicia 2026 es una campaña dentro de `CRM_Campaigns`; no tiene arquitectura separada.

## Arquitectura del admin

`fedes.ai/admin` renderiza componentes React nativos y consume Apps Script exclusivamente como backend API.

El navegador no usa `google.script.run` ni iframe. Las operaciones administrativas viajan mediante POST `no-cors` con un `requestId` y un secreto efímero; el resultado se recupera una sola vez por JSONP desde `?api=admin-result`. El token de sesión administrativo viaja dentro del body POST, no en la URL.

Archivos principales:

- `AdminHttpBridge.gs`: transporte HTTP para React.
- `AdminReactData.gs`: workspace, ABMC, filtros, dashboard, vistas 360° e insights.
- `Security.gs`: autenticación, sesiones y credenciales.
- `MediaService.gs`: subida de imágenes a Drive.

## Cobertura del backoffice

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

## ABMC y consulta

Las entidades operativas soportan según su naturaleza:

- Alta
- Modificación
- Consulta
- Baja lógica / archivo y restauración
- Baja definitiva en tablas de eventos sin `archived_at`
- Selección y acciones masivas
- Búsqueda libre
- Filtros por facetas reales
- Filtro de fechas
- Inclusión de bajas
- Orden ASC / DESC
- Paginación
- Exportación CSV
- Duplicación sólo donde no compromete integridad

`_AuditLog` y `_System` permanecen deliberadamente de solo lectura para preservar trazabilidad e integridad técnica.

## Vistas 360°

**Campaña 360°** funciona para cualquier `campaign_key` y muestra leads, conversión, fuentes, segmentos, etapas, mailings y actividad.

**Lead 360°** reúne perfil, atribución, scoring interno, revisión manual, respuestas, eventos, mailings, responsable, próxima acción y reunión. Las campañas que tengan recuperación implementada pueden emitir un enlace seguro desde esa vista.

**Onboarding 360°** reúne legajo normalizado, estado, paso y respuestas; `data_json` se vuelve a sanitizar defensivamente antes de exponerse al frontend.

## Seguridad

- Contraseña administrativa hasheada + salt en Script Properties.
- Sesiones temporales en `CacheService`.
- Cambio de contraseña desde el React Admin validando la contraseña actual.
- Rotación de API key VADDAR desde el panel; la nueva key se muestra una sola vez.
- El token de recuperación de leads se persiste sólo como hash.
- No guardar credenciales en React, `.env` versionado ni Google Sheets en claro.

## Instalación / actualización

En una instalación existente:

1. `git pull origin main`
2. `clasp push`
3. Actualizar la implementación existente del Web App a una nueva versión.

No ejecutar `setupFedesCms()` para actualizar una base productiva ya inicializada.

En una instalación nueva sí corresponde ejecutar `setupFedesCms()` una única vez después del primer `clasp push`.

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
- `?api=admin-result&requestId=<opaque>&clientSecret=<opaque>`

## Comandos administrativos React

POST al Web App con body JSON y `action: "adminCommand"`.

Operaciones soportadas:

- `login`
- `logout`
- `workspace`
- `dashboard`
- `insights`
- `queryTable`
- `create`
- `update`
- `archive`
- `restore`
- `delete`
- `duplicate`
- `bulk`
- `campaign360`
- `lead360`
- `onboarding360`
- `changePassword`
- `rotateVaddarApiKey`
- `uploadMedia`
- `issueResumeLink`

## Compatibilidad legacy

Los endpoints `?action=...` históricos se conservan temporalmente para no romper formularios existentes. Las tablas legacy no son fuente de verdad del backoffice.

## Migraciones

Las reparaciones y upgrades manuales ya ejecutados están documentados en `docs/MIGRATIONS.md`. El runtime productivo no debe acumular funciones `verify*` ni scripts temporales de repair.
