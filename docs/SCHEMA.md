# Esquema de datos — Fedes Landing CMS

## Principios

- IDs UUID estables: nunca se usa el número de fila como identidad.
- Google Sheets funciona como persistencia del CMS de esta landing, no como modelo del futuro módulo Web de VADDAR.
- `status` + `archived_at` implementan soft delete.
- `_AuditLog` conserva el historial básico de cambios administrativos y del funnel.
- Los secretos viven en `PropertiesService`; jamás en las hojas.
- `LockService` serializa escrituras.
- `CacheService` acelera `bootstrap` y colecciones públicas.

## Hojas

### Sistema
- `_System`
- `_AuditLog`

### CMS
- `CMS_Settings`
- `CMS_Content`
- `CMS_OnboardingModules`
- `CMS_CaseStudies`
- `CMS_Testimonials`
- `CMS_Team`
- `CMS_BlogPosts`
- `CMS_Gallery`
- `CMS_Media`

### CRM / Captación
- `CRM_Contacts`
- `CRM_Campaigns`
- `CRM_Leads`
- `CRM_LeadAnswers`
- `CRM_LeadEvents`

### Operación existente
- `ONB_Records`
- `AN_Events`

## Galicia

`CRM_Leads` contiene una fila por lead. El Paso 1 crea/actualiza la fila con `status=incomplete`. El Paso 2 escribe Q1-Q4 en `CRM_LeadAnswers`, recalcula el score en servidor y actualiza el lead.

Puntaje: A=0, B=15, C=25. Q2=A es KO. 80–100 = CALIFICADO; 55–75 = EN_EVALUACION; resto = NO_CALIFICADO.

## VADDAR futuro

VADDAR no debe leer la Sheet directamente. Debe registrar una integración por tenant y provider, por ejemplo:

- provider: `custom_web`
- config: `{ adapter: 'google_apps_script', baseUrl: '...', siteKey: 'fedes-main' }`

El backend de VADDAR consume por POST los endpoints internos de este Apps Script usando una API key rotatable. En una fase posterior conviene crear un módulo `web` de VADDAR que normalice contenido, leads y analytics de proveedores diferentes (custom web, WordPress, Shopify, Tiendanube) sin forzar a esos proveedores a compartir un mismo esquema físico.
