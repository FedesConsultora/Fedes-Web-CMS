function setSecretHash_(hashProp, saltProp, secret) {
  var props = PropertiesService.getScriptProperties();
  var salt = randomSecret_(24);
  props.setProperty(saltProp, salt);
  props.setProperty(hashProp, digestHex_(salt + ':' + secret));
}

function verifySecret_(hashProp, saltProp, secret) {
  var props = PropertiesService.getScriptProperties();
  var salt = props.getProperty(saltProp);
  var expected = props.getProperty(hashProp);
  if (!salt || !expected) return false;
  return constantTimeEquals_(expected, digestHex_(salt + ':' + safeString_(secret)));
}

function createAdminSession_(actor) {
  var token = randomSecret_(32);
  CacheService.getScriptCache().put('admin_session:' + token, jsonStringify_({actor: actor || 'admin', created_at: nowIso_()}), APP.ADMIN_SESSION_TTL_SECONDS);
  return token;
}

function requireAdminSession_(token) {
  var raw = CacheService.getScriptCache().get('admin_session:' + safeString_(token));
  if (!raw) throw new Error('Sesión vencida o inválida.');
  return jsonParse_(raw, {actor:'admin'});
}

function verifyVaddarApiKey_(apiKey) {
  return verifySecret_(APP.PROPS.VADDAR_API_KEY_HASH, APP.PROPS.VADDAR_API_KEY_SALT, apiKey);
}

function adminLogin(password) {
  if (!verifySecret_(APP.PROPS.ADMIN_PASSWORD_HASH, APP.PROPS.ADMIN_PASSWORD_SALT, password)) {
    return {success:false, error:'Clave incorrecta'};
  }
  var token = createAdminSession_('admin');
  audit_('admin','admin','auth','admin','login',null,{success:true},'admin_panel');
  return {success:true, token:token, expiresIn:APP.ADMIN_SESSION_TTL_SECONDS};
}

function adminLogout(token) {
  if (token) CacheService.getScriptCache().remove('admin_session:' + safeString_(token));
  return {success:true};
}

function resetAdminPassword_() {
  var password = randomSecret_(15);
  setSecretHash_(APP.PROPS.ADMIN_PASSWORD_HASH, APP.PROPS.ADMIN_PASSWORD_SALT, password);
  Logger.log('Nueva contraseña temporal del panel: ' + password);
  return 'Nueva contraseña generada. Revisá el registro de ejecución.';
}

// Wrapper público para poder ejecutar el reset desde el selector del editor de Apps Script.
// Las funciones cuyo nombre termina en "_" se mantienen como helpers internos.
function resetAdminPassword() {
  return resetAdminPassword_();
}

function rotateVaddarApiKey_() {
  var key = 'vdr_' + randomSecret_(32);
  setSecretHash_(APP.PROPS.VADDAR_API_KEY_HASH, APP.PROPS.VADDAR_API_KEY_SALT, key);
  Logger.log('Nueva API key para VADDAR: ' + key);
  return 'Nueva API key generada. Revisá el registro de ejecución.';
}

function adminChangePassword(token, newPassword) {
  var session = requireAdminSession_(token);
  var password = safeString_(newPassword);
  if (password.length < 10) throw new Error('La contraseña debe tener al menos 10 caracteres.');
  setSecretHash_(APP.PROPS.ADMIN_PASSWORD_HASH, APP.PROPS.ADMIN_PASSWORD_SALT, password);
  audit_(session.actor,'admin','security','admin_password','change_password',null,{changed:true},'admin_panel');
  return {success:true};
}

function adminRotateVaddarApiKey(token) {
  var session = requireAdminSession_(token);
  var key = 'vdr_' + randomSecret_(32);
  setSecretHash_(APP.PROPS.VADDAR_API_KEY_HASH, APP.PROPS.VADDAR_API_KEY_SALT, key);
  audit_(session.actor,'admin','security','vaddar_api_key','rotate',null,{rotated:true},'admin_panel');
  return {success:true, apiKey:key};
}
