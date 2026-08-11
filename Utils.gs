function nowIso_() {
  return new Date().toISOString();
}

function uuid_() {
  return Utilities.getUuid();
}

function safeString_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function safeNumber_(value, fallback) {
  var n = Number(value);
  return isFinite(n) ? n : (fallback === undefined ? 0 : fallback);
}

function safeBoolean_(value) {
  if (value === true || value === 1) return true;
  var s = safeString_(value).toLowerCase();
  return ['true','1','yes','si','sí','on'].indexOf(s) >= 0;
}

function jsonStringify_(value) {
  try { return JSON.stringify(value === undefined ? null : value); }
  catch (err) { return '{}'; }
}

function jsonParse_(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch (err) { return fallback; }
}

function normalizeCellValue_(value) {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function normalizeRecordForOutput_(record) {
  var out = {};
  Object.keys(record || {}).forEach(function(key) {
    out[key] = normalizeCellValue_(record[key]);
  });
  return out;
}

function slugify_(value) {
  return safeString_(value)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sanitizeEmail_(email) {
  return safeString_(email).toLowerCase();
}

function sanitizeUrl_(url) {
  var value = safeString_(url);
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return 'https://' + value;
}

function firstDefined_(obj, keys, fallback) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  return fallback;
}

function omitSensitiveOnboardingFields_(data) {
  var copy = Object.assign({}, data || {});
  [
    'instagramPassword','instagram_password','Instagram - Contraseña',
    'tiktokPassword','tiktok_password','TikTok - Contraseña',
    'facebookPassword','facebook_password',
    'password','contraseña','contrasena'
  ].forEach(function(key) { if (key in copy) delete copy[key]; });
  return copy;
}

function randomSecret_(bytes) {
  var target = Math.max(16, safeNumber_(bytes, 32));
  var material = '';
  while (material.length < target * 2) material += Utilities.getUuid().replace(/-/g, '');
  return digestHex_(material + ':' + new Date().getTime()).slice(0, target * 2);
}

function digestHex_(value) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
  return bytes.map(function(b) {
    var n = b < 0 ? b + 256 : b;
    return ('0' + n.toString(16)).slice(-2);
  }).join('');
}

function constantTimeEquals_(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function validateJsonpCallback_(callback) {
  var cb = safeString_(callback);
  return /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(cb) ? cb : '';
}

function getRequestData_(e) {
  var data = {};
  try {
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      data = Object.assign({}, e.parameter);
    }
  } catch (err) {
    data = e && e.parameter ? Object.assign({}, e.parameter) : {};
  }
  return data || {};
}

function responseJson_(payload, callback) {
  var body = JSON.stringify(payload);
  var cb = validateJsonpCallback_(callback);
  if (cb) {
    return ContentService.createTextOutput(cb + '(' + body + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function responseError_(message, code, statusLike) {
  return { success: false, error: safeString_(message), code: code || 'ERROR', status: statusLike || 400 };
}
