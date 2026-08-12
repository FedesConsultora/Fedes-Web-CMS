var ADMIN_HTTP_RESULT_TTL_SECONDS = 90;
var ADMIN_HTTP_MAX_RESULT_CHARS = 90000;

function handleAdminHttpCommand_(data) {
  data = data || {};
  var requestId = safeString_(data.requestId);
  var clientSecret = safeString_(data.clientSecret);
  if (!adminHttpOpaqueId_(requestId) || !adminHttpOpaqueId_(clientSecret)) {
    return responseError_('Solicitud administrativa inválida', 'INVALID_ADMIN_REQUEST', 400);
  }

  var result;
  try {
    result = adminExecuteHttpCommand_(data);
  } catch (err) {
    console.error(err);
    result = responseError_(err.message || 'Error administrativo', 'ADMIN_COMMAND_ERROR', 500);
  }

  var raw = jsonStringify_(result);
  if (raw.length > ADMIN_HTTP_MAX_RESULT_CHARS) {
    raw = jsonStringify_(responseError_('La respuesta es demasiado grande. Ajustá filtros o paginación.', 'ADMIN_RESULT_TOO_LARGE', 413));
  }

  CacheService.getScriptCache().put(
    adminHttpResultKey_(requestId, clientSecret),
    raw,
    ADMIN_HTTP_RESULT_TTL_SECONDS
  );

  return {success:true, accepted:true, requestId:requestId};
}

function getAdminHttpResult_(requestId, clientSecret) {
  var rid = safeString_(requestId);
  var secret = safeString_(clientSecret);
  if (!adminHttpOpaqueId_(rid) || !adminHttpOpaqueId_(secret)) {
    return {success:false, pending:false, error:'Solicitud inválida', code:'INVALID_ADMIN_RESULT'};
  }

  var cache = CacheService.getScriptCache();
  var key = adminHttpResultKey_(rid, secret);
  var raw = cache.get(key);
  if (!raw) return {success:true, pending:true};
  cache.remove(key);
  return {success:true, pending:false, result:jsonParse_(raw, responseError_('Respuesta inválida','INVALID_ADMIN_RESULT',500))};
}

function adminExecuteHttpCommand_(data) {
  var op = safeString_(data.operation);
  var token = safeString_(data.token);
  var payload = data.payload && typeof data.payload === 'object' ? data.payload : {};

  switch (op) {
    case 'login':
      return adminLogin(safeString_(payload.password));
    case 'logout':
      return adminLogout(token);
    case 'workspace':
      return adminGetWorkspace(token);
    case 'dashboard':
      return adminGetDashboardV2(token);
    case 'insights':
      return adminGetInsights(token);
    case 'queryTable':
      return adminQueryTable(token, safeString_(payload.tableKey), payload.query || {});
    case 'create':
      return adminCreateData(token, safeString_(payload.tableKey), payload.record || {});
    case 'update':
      return adminUpdateData(token, safeString_(payload.tableKey), safeString_(payload.id), payload.record || {});
    case 'archive':
      return adminArchiveData(token, safeString_(payload.tableKey), safeString_(payload.id));
    case 'restore':
      return adminRestoreDataSafe(token, safeString_(payload.tableKey), safeString_(payload.id));
    case 'delete':
      return adminHardDeleteData(token, safeString_(payload.tableKey), safeString_(payload.id));
    case 'duplicate':
      return adminDuplicateDataSafe(token, safeString_(payload.tableKey), safeString_(payload.id));
    case 'bulk':
      return adminBulkActionSafe(token, safeString_(payload.tableKey), payload.ids || [], safeString_(payload.action));
    case 'campaign360':
      return adminGetCampaign360(token, safeString_(payload.campaignKey));
    case 'lead360':
      return adminGetLead360(token, safeString_(payload.leadId));
    case 'onboarding360':
      return adminGetOnboarding360(token, safeString_(payload.onboardingId));
    case 'changePassword':
      return adminChangePasswordSecure_(token, safeString_(payload.currentPassword), safeString_(payload.newPassword));
    case 'rotateVaddarApiKey':
      return adminRotateVaddarApiKey(token);
    case 'uploadMedia':
      return uploadMediaAdmin(token, payload);
    case 'issueResumeLink':
      return adminIssueResumeLink_(token, safeString_(payload.leadId), safeNumber_(payload.ttlHours, 168));
    default:
      return responseError_('Operación administrativa inválida', 'INVALID_ADMIN_OPERATION', 404);
  }
}

function adminChangePasswordSecure_(token, currentPassword, newPassword) {
  var session = requireAdminSession_(token);
  if (!verifySecret_(APP.PROPS.ADMIN_PASSWORD_HASH, APP.PROPS.ADMIN_PASSWORD_SALT, currentPassword)) {
    throw new Error('La contraseña actual no es correcta.');
  }
  var password = safeString_(newPassword);
  if (password.length < 10) throw new Error('La nueva contraseña debe tener al menos 10 caracteres.');
  setSecretHash_(APP.PROPS.ADMIN_PASSWORD_HASH, APP.PROPS.ADMIN_PASSWORD_SALT, password);
  audit_(session.actor,'admin','security','admin_password','change_password',null,{changed:true},'react_admin');
  return {success:true};
}

function adminIssueResumeLink_(token, leadId, ttlHours) {
  var session = requireAdminSession_(token);
  var lead = dbFindById_(APP.SHEETS.LEADS, leadId, {includeArchived:true});
  if (!lead) throw new Error('Lead no encontrado');
  if (safeString_(lead.campaign_key) !== GALICIA.CAMPAIGN_KEY) {
    throw new Error('La recuperación automática todavía no está configurada para esta campaña.');
  }
  var issued = issueGaliciaResumeToken_(leadId, ttlHours, true);
  audit_(session.actor,'admin',APP.SHEETS.LEADS,leadId,'issue_resume_link',null,{expiresAt:issued.expiresAt},'react_admin');
  return {
    success:true,
    leadId:issued.leadId,
    expiresAt:issued.expiresAt,
    relativeUrl:'/regalo-galicia?resume=' + encodeURIComponent(issued.token) + '&source=galicia_recovery_email'
  };
}

function adminHttpOpaqueId_(value) {
  return /^[A-Za-z0-9_-]{20,120}$/.test(safeString_(value));
}

function adminHttpResultKey_(requestId, clientSecret) {
  return 'admin_http:' + digestHex_(safeString_(requestId) + ':' + safeString_(clientSecret));
}
