# Fedes Backoffice 3.0 — mapa funcional

El backoffice administra las tablas normalizadas del CMS/CRM. Las pestañas legacy quedan fuera del panel porque no son fuente de verdad y sólo se conservan para trazabilidad/migración.

## CRM

| Vista | Tabla | Alta | Consulta | Modificación | Baja |
|---|---|---:|---:|---:|---:|
| Contactos | `CRM_Contacts` | Sí | Sí | Sí | Lógica |
| Campañas | `CRM_Campaigns` | Sí | Sí + 360° | Sí | Lógica |
| Leads | `CRM_Leads` | Sí | Sí + 360° | Sí | Lógica |
| Respuestas | `CRM_LeadAnswers` | Sí | Sí | Sí | Lógica |
| Eventos de lead | `CRM_LeadEvents` | Sí | Sí | Sí | Definitiva |
| Mailings | `CRM_LeadMailings` | Sí | Sí | Sí | Lógica |

La vista 360° de campañas es genérica. `galicia-2026` es una fila de `CRM_Campaigns`; futuras campañas usan exactamente el mismo modelo.

## Onboarding

| Vista | Tabla | Alta | Consulta | Modificación | Baja |
|---|---|---:|---:|---:|---:|
| Onboarding | `ONB_Records` | Sí | Sí + legajo 360° | Sí | Lógica |

El JSON se muestra con redacción defensiva de claves sensibles.

## Web / CMS

| Vista | Tabla | Alta | Consulta | Modificación | Baja |
|---|---|---:|---:|---:|---:|
| Configuración | `CMS_Settings` | Sí | Sí | Sí | Lógica |
| Contenido Web | `CMS_Content` | Sí | Sí | Sí | Lógica |
| Módulos Onboarding | `CMS_OnboardingModules` | Sí | Sí | Sí | Lógica |
| Casos de éxito | `CMS_CaseStudies` | Sí | Sí | Sí | Lógica |
| Testimonios | `CMS_Testimonials` | Sí | Sí | Sí | Lógica |
| Equipo | `CMS_Team` | Sí | Sí | Sí | Lógica |
| Blog y Recursos | `CMS_BlogPosts` | Sí | Sí | Sí | Lógica |
| Galería | `CMS_Gallery` | Sí | Sí | Sí | Lógica |
| Media | `CMS_Media` | Upload | Sí | Sí | Lógica |

## Datos

| Vista | Tabla | Alta | Consulta | Modificación | Baja |
|---|---|---:|---:|---:|---:|
| Analítica | `AN_Events` | Sí | Sí | Sí | Definitiva |
| Auditoría | `_AuditLog` | No | Sí | No | No |
| Sistema | `_System` | No | Sí | No | No |

`_AuditLog` y `_System` son inmutables desde UI por diseño. Editar el historial desde el mismo panel que se audita anularía la trazabilidad; editar `_System` permitiría romper marcadores internos de migración/configuración.

## Consulta y filtros

Cada grilla soporta búsqueda textual, filtros por campos relevantes, rango de fechas, consulta de bajas, ordenamiento, paginación y exportación CSV de la selección filtrada. Los filtros se calculan con los valores reales presentes en la base.

## Políticas de integridad

- Las bajas son lógicas cuando existe `archived_at`.
- Al restaurar un lead/onboarding/contacto/mailing se aplica un estado válido para esa entidad; no se fuerza `draft` indiscriminadamente.
- No se permite duplicar entidades transaccionales como leads, respuestas, eventos, mailings u onboardings.
- Todas las escrituras del backoffice generan una entrada de auditoría.
- Los hashes/tokens de recuperación no se muestran en claro.
