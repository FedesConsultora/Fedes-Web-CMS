# Historial de migraciones manuales

Este archivo documenta operaciones manuales que ya fueron ejecutadas sobre la base productiva. El código ejecutable temporal fue retirado del runtime de Google Apps Script una vez validado, para mantener el proyecto productivo limpio.

## 2026-08-12 — Onboarding legacy v2

Se reparó la migración de `OnboardingProgress`, `OnboardingEmpresas_Step0` y `OnboardingEmpresas_Step1` hacia `ONB_Records`.

Resultado validado:

- 8 CUIT activos únicos.
- 1 duplicado archivado.
- 3 onboardings completados.
- 5 onboardings en progreso.
- 3 registros con respuestas estratégicas recuperadas.
- 0 filas activas con claves de contraseña dentro de `ONB_Records.data_json`.

La reparación corrigió nombres reales de encabezados legacy y eliminó del JSON nuevo copias de campos sensibles heredados. Las hojas legacy no fueron eliminadas durante la reparación.

## 2026-08-12 — CRM campañas v3

Se amplió `CRM_Leads` con estado de progreso, recuperación, revisión manual y reunión; además se creó `CRM_LeadMailings`.

Resultado validado:

- `schemaVersion`: 3.
- `appVersion` en la migración: 2.1.0.
- columnas requeridas de `CRM_Leads`: completas.
- `CRM_LeadMailings`: creada con esquema completo.
- 3 leads existentes normalizados: 2 incompletos en paso 1 y 1 completo en paso 2.

El schema definitivo quedó incorporado en `Schema.gs`; por eso una instalación nueva no depende de volver a ejecutar esta migración manual.

## 2026-08-12 — Recuperación Galicia

Se validó el backend de recuperación por token opaco:

- token resuelto correctamente;
- resolución al mismo lead;
- el token en claro no se persiste, sólo su hash;
- expiración soportada;
- recuperación de respuestas soportada.

La función temporal de verificación fue retirada luego de la prueba.

## Criterio de mantenimiento

Las migraciones manuales y funciones `verify*` no forman parte del runtime productivo. El historial detallado también permanece disponible en Git mediante los commits previos a su eliminación.
