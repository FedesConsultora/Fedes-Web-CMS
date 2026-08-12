function repairLegacyOnboardingV2() {
  var ss = getSpreadsheet_();
  var progressRows = legacyRows_(ss.getSheetByName(APP.LEGACY_SHEETS.ONBOARDING_PROGRESS));
  var step0Rows = legacyRows_(ss.getSheetByName(APP.LEGACY_SHEETS.ONBOARDING_STEP0));
  var step1Rows = legacyRows_(ss.getSheetByName(APP.LEGACY_SHEETS.ONBOARDING_STEP1));

  var progressByCuit = {};
  var step0ByCuit = {};
  var step1ByEmail = {};

  progressRows.forEach(function(row) {
    var cuit = repairNormalizeCuit_(row.CUIT || row.cuit);
    if (!cuit) return;
    progressByCuit[cuit] = repairPickLatest_(progressByCuit[cuit], row, 'Ultima_Actualizacion');
  });

  step0Rows.forEach(function(row) {
    var cuit = repairNormalizeCuit_(row.CUIT || row.cuit);
    if (!cuit) return;
    step0ByCuit[cuit] = repairPickLatest_(step0ByCuit[cuit], row, 'ID');
  });

  step1Rows.forEach(function(row) {
    var email = sanitizeEmail_(row['Correo electrónico'] || row.Email || row.email);
    if (!email) return;
    step1ByEmail[email] = repairPickLatest_(step1ByEmail[email], row, 'ID');
  });

  var allCuits = {};
  Object.keys(progressByCuit).forEach(function(c) { allCuits[c] = true; });
  Object.keys(step0ByCuit).forEach(function(c) { allCuits[c] = true; });

  var existingRows = dbReadAll_(APP.SHEETS.ONBOARDING, { includeArchived: true });
  var existingByCuit = {};
  existingRows.forEach(function(row) {
    var cuit = repairNormalizeCuit_(row.cuit);
    if (!cuit) return;
    existingByCuit[cuit] = existingByCuit[cuit] || [];
    existingByCuit[cuit].push(row);
  });

  var summary = {
    sourceCuits: Object.keys(allCuits).length,
    repaired: 0,
    inserted: 0,
    duplicatesArchived: 0,
    orphanRowsSanitized: 0,
    step1Matched: 0,
    completed: 0,
    inProgress: 0
  };

  Object.keys(allCuits).sort().forEach(function(cuit) {
    var progress = progressByCuit[cuit] || {};
    var step0 = step0ByCuit[cuit] || {};
    var progressData = repairParseProgressData_(progress);
    var step0Data = repairMapStep0_(step0, cuit);

    var email = sanitizeEmail_(
      repairFirstNonEmpty_([
        progressData.email,
        step0Data.email,
        step0['Correo electrónico']
      ])
    );

    var step1 = email ? (step1ByEmail[email] || {}) : {};
    var hasStep1 = Object.keys(step1).length > 0;
    if (hasStep1) summary.step1Matched++;
    var step1Data = repairMapStep1_(step1);

    var formData = {};
    repairMergeNonEmpty_(formData, step0Data);
    repairMergeNonEmpty_(formData, progressData);
    repairMergeNonEmpty_(formData, step1Data);
    formData.cuit = cuit;
    formData = repairSanitizeDeep_(formData);

    // La hoja Step1 es evidencia más fuerte que OnboardingProgress: si existe una
    // respuesta enviada de Step1, el proceso llegó al final aunque el tracking de
    // progreso haya quedado obsoleto en Paso 1.
    var completed = safeBoolean_(progress.Completado) || hasStep1;
    var currentStep = safeNumber_(progress.Paso_Actual, hasStep1 ? 2 : 1);
    if (hasStep1 && currentStep < 2) currentStep = 2;
    if (completed && currentStep < 2) currentStep = 2;

    var updatedSource = repairFirstNonEmpty_([
      progress.Ultima_Actualizacion,
      step1.Fecha,
      step0.Fecha
    ]);

    var rec = {
      cuit: cuit,
      company_name: safeString_(formData.fantasyName),
      contact_name: safeString_(formData.mainContactName),
      email: sanitizeEmail_(formData.email),
      taxpayer_type: safeString_(formData.taxpayerType),
      current_step: currentStep,
      status: completed ? 'completed' : 'in_progress',
      is_completed: completed,
      data_json: jsonStringify_({
        formData: formData,
        migration: {
          source: 'legacy_onboarding',
          version: 2,
          repaired_at: nowIso_()
        }
      }),
      completed_at: completed ? safeString_(step1.Fecha || progress.Ultima_Actualizacion || updatedSource || nowIso_()) : ''
    };

    var matches = existingByCuit[cuit] || [];
    var keeper = repairChooseKeeper_(matches, cuit);

    if (keeper) {
      dbUpdateById_(APP.SHEETS.ONBOARDING, keeper.onboarding_id, rec);
      summary.repaired++;
    } else {
      keeper = dbInsert_(APP.SHEETS.ONBOARDING, rec);
      summary.inserted++;
    }

    matches.forEach(function(row) {
      if (String(row.onboarding_id) === String(keeper.onboarding_id)) return;
      var sanitizedExisting = repairSanitizeExistingOnboardingRow_(row);
      dbUpdateById_(APP.SHEETS.ONBOARDING, row.onboarding_id, {
        cuit: repairNormalizeCuit_(row.cuit) || cuit,
        data_json: sanitizedExisting
      });
      if (!safeString_(row.archived_at)) {
        dbArchiveById_(APP.SHEETS.ONBOARDING, row.onboarding_id);
        summary.duplicatesArchived++;
      }
    });

    if (completed) summary.completed++; else summary.inProgress++;
  });

  // También elimina secretos de cualquier fila moderna/orfandad que no provenga
  // de las tres hojas legacy, sin cambiar sus campos operativos.
  dbReadAll_(APP.SHEETS.ONBOARDING, { includeArchived: true }).forEach(function(row) {
    var cuit = repairNormalizeCuit_(row.cuit);
    if (cuit && allCuits[cuit]) return;
    var sanitized = repairSanitizeExistingOnboardingRow_(row);
    if (sanitized !== safeString_(row.data_json)) {
      dbUpdateById_(APP.SHEETS.ONBOARDING, row.onboarding_id, { data_json: sanitized });
      summary.orphanRowsSanitized++;
    }
  });

  systemSet_('legacy_onboarding_repair_v2_at', nowIso_());
  audit_('system', 'system', APP.SHEETS.ONBOARDING, 'legacy-v2', 'repair', null, summary, 'manual_repair');
  Logger.log('Repair onboarding v2: ' + JSON.stringify(summary));
  return summary;
}

function verifyOnboardingRepairV2() {
  var rows = dbReadAll_(APP.SHEETS.ONBOARDING, { includeArchived: true });
  var active = rows.filter(function(row) { return !safeString_(row.archived_at); });
  var seen = {};
  var duplicateActiveCuits = [];
  var result = {
    totalRows: rows.length,
    activeRows: active.length,
    archivedRows: rows.length - active.length,
    uniqueActiveCuits: 0,
    duplicateActiveCuits: 0,
    completed: 0,
    inProgress: 0,
    withCompany: 0,
    withContact: 0,
    withEmail: 0,
    withStrategicAnswers: 0,
    sensitiveDataJsonRows: 0
  };

  active.forEach(function(row) {
    var cuit = repairNormalizeCuit_(row.cuit);
    if (cuit) {
      if (seen[cuit]) duplicateActiveCuits.push(cuit);
      seen[cuit] = true;
    }
    if (safeBoolean_(row.is_completed) || safeString_(row.status) === 'completed') result.completed++;
    else result.inProgress++;
    if (safeString_(row.company_name)) result.withCompany++;
    if (safeString_(row.contact_name)) result.withContact++;
    if (sanitizeEmail_(row.email)) result.withEmail++;

    var parsed = jsonParse_(row.data_json, {});
    var formData = parsed.formData || {};
    var hasAnswer = false;
    for (var i = 1; i <= 20; i++) {
      if (safeString_(formData['q' + i])) { hasAnswer = true; break; }
    }
    if (hasAnswer) result.withStrategicAnswers++;
    if (repairContainsSensitiveKey_(parsed)) result.sensitiveDataJsonRows++;
  });

  result.uniqueActiveCuits = Object.keys(seen).length;
  result.duplicateActiveCuits = duplicateActiveCuits.length;
  Logger.log('Verify onboarding v2: ' + JSON.stringify(result));
  return result;
}

function repairNormalizeCuit_(value) {
  var digits = safeString_(value).replace(/\D/g, '');
  return digits.length === 11 ? digits : digits;
}

function repairPickLatest_(current, candidate, field) {
  if (!current) return candidate;
  var a = current[field];
  var b = candidate[field];
  if (field === 'ID') return safeNumber_(b, 0) >= safeNumber_(a, 0) ? candidate : current;
  return String(b || '') >= String(a || '') ? candidate : current;
}

function repairParseProgressData_(row) {
  if (!row) return {};
  var raw = row.Datos_JSON || row.formData || row.FormData || '{}';
  return repairSanitizeDeep_(jsonParse_(raw, {}));
}

function repairMapStep0_(row, cuit) {
  if (!row || !Object.keys(row).length) return {};
  return repairSanitizeDeep_({
    fantasyName: row['Nombre de fantasía'],
    cuit: cuit,
    mainContactName: row['Nombre del contacto principal'],
    address: row['Domicilio'],
    email: row['Correo electrónico'],
    taxpayerType: row['Tipo de contribuyente'],
    facebookUrl: row['Facebook - URL'],
    facebookAdminUser: row['Facebook - Usuario administrador'],
    facebookGrantPermission: row['Facebook - Permisos otorgados'],
    facebookBMId: row['Facebook - Business Manager ID'],
    instagramUser: row['Instagram - Usuario'],
    instagramFollowers: row['Instagram - Seguidores'],
    tiktokUser: row['TikTok - Usuario'],
    tiktokFollowers: row['TikTok - Seguidores'],
    youtubeUrl: row['YouTube - URL'],
    youtubeAddAdmin: row['YouTube - ¿Agregar admin?'],
    linkedinUrl: row['LinkedIn - URL'],
    linkedinAddFede: row['LinkedIn - ¿Agregar a Fede?'],
    usesOtherChannels: row['Otros canales - ¿Usa otros canales?'],
    otherChannelsDetail: row['Otros canales - Detalle'],
    driveBrandFolderUrl: row['Carpeta Drive - Marca'],
    driveRawContentFolderUrl: row['Carpeta Drive - Contenido crudo']
  });
}

function repairMapStep1_(row) {
  if (!row || !Object.keys(row).length) return {};
  var out = {
    fantasyName: row['Nombre de fantasía'],
    email: row['Correo electrónico']
  };
  for (var i = 1; i <= 20; i++) out['q' + i] = row['Pregunta ' + i];
  return repairSanitizeDeep_(out);
}

function repairMergeNonEmpty_(target, source) {
  Object.keys(source || {}).forEach(function(key) {
    var value = source[key];
    if (value === null || value === undefined) return;
    if (typeof value === 'string' && value.trim() === '') return;
    target[key] = value;
  });
  return target;
}

function repairFirstNonEmpty_(values) {
  for (var i = 0; i < values.length; i++) {
    var value = values[i];
    if (value !== null && value !== undefined && safeString_(value) !== '') return value;
  }
  return '';
}

function repairSanitizeDeep_(value) {
  if (Array.isArray(value)) return value.map(repairSanitizeDeep_);
  if (!value || typeof value !== 'object') return value;
  var out = {};
  Object.keys(value).forEach(function(key) {
    var normalized = safeString_(key).toLowerCase();
    var sensitive = normalized.indexOf('password') >= 0 ||
      normalized.indexOf('contraseña') >= 0 ||
      normalized.indexOf('contrasena') >= 0;
    if (!sensitive) out[key] = repairSanitizeDeep_(value[key]);
  });
  return out;
}

function repairContainsSensitiveKey_(value) {
  if (Array.isArray(value)) {
    for (var i = 0; i < value.length; i++) if (repairContainsSensitiveKey_(value[i])) return true;
    return false;
  }
  if (!value || typeof value !== 'object') return false;
  var keys = Object.keys(value);
  for (var j = 0; j < keys.length; j++) {
    var normalized = safeString_(keys[j]).toLowerCase();
    if (normalized.indexOf('password') >= 0 || normalized.indexOf('contraseña') >= 0 || normalized.indexOf('contrasena') >= 0) return true;
    if (repairContainsSensitiveKey_(value[keys[j]])) return true;
  }
  return false;
}

function repairChooseKeeper_(rows, canonicalCuit) {
  if (!rows || !rows.length) return null;
  var active = rows.filter(function(row) { return !safeString_(row.archived_at); });
  var pool = active.length ? active : rows;
  for (var i = 0; i < pool.length; i++) {
    if (safeString_(pool[i].cuit).replace(/\D/g, '') === canonicalCuit && safeString_(pool[i].cuit) === canonicalCuit) return pool[i];
  }
  return pool[0];
}

function repairSanitizeExistingOnboardingRow_(row) {
  var parsed = jsonParse_(row.data_json, {});
  var formData = parsed.formData || parsed;
  formData = repairSanitizeDeep_(formData || {});
  return jsonStringify_({
    formData: formData,
    migration: {
      source: 'sanitized_existing',
      version: 2,
      repaired_at: nowIso_()
    }
  });
}
