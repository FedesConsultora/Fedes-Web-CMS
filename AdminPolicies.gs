const ADMIN_DUPLICABLE_TABLES = Object.freeze([
  'settings','content','modules','cases','testimonials','team','blog','gallery','campaigns'
]);

function adminRestoreDataSafe(token, tableKey, id) {
  var session = requireAdminSession_(token);
  var def = adminRequireTable_(tableKey);
  if (def.deleteMode !== 'archive') throw new Error('Restauración no habilitada para ' + def.label);

  var before = dbFindById_(def.sheet, id, {includeArchived:true});
  if (!before) throw new Error('Registro no encontrado');

  var patch = {archived_at:''};
  if ((SCHEMA[def.sheet] || []).indexOf('status') >= 0) {
    patch.status = adminRestoreStatus_(def.sheet, before);
  }

  var saved = dbUpdateById_(def.sheet, id, patch);
  audit_(session.actor,'admin',def.sheet,id,'restore',before,saved,'admin_full');
  invalidatePublicCache_();
  return {success:true,record:adminSanitizeRowForUi_(def,saved)};
}

function adminRestoreStatus_(sheetName, record) {
  if (sheetName === APP.SHEETS.LEADS) return safeBoolean_(record.completed_at) || safeString_(record.completed_at) ? 'complete' : 'incomplete';
  if (sheetName === APP.SHEETS.ONBOARDING) return safeBoolean_(record.is_completed) ? 'completed' : 'in_progress';
  if (sheetName === APP.SHEETS.CONTACTS) return 'new';
  if (sheetName === APP.SHEETS.LEAD_MAILINGS) return safeString_(record.sent_at) ? 'sent' : (safeString_(record.scheduled_at) ? 'scheduled' : 'pending');
  return 'draft';
}

function adminDuplicateDataSafe(token, tableKey, id) {
  if (ADMIN_DUPLICABLE_TABLES.indexOf(safeString_(tableKey)) < 0) {
    throw new Error('Duplicación deshabilitada para preservar integridad y evitar registros comerciales repetidos.');
  }
  return adminDuplicateData(token, tableKey, id);
}

function adminBulkActionSafe(token, tableKey, ids, action) {
  requireAdminSession_(token);
  ids = Array.isArray(ids) ? ids : [];
  if (ids.length > 100) throw new Error('Máximo 100 registros por operación');

  var results = [];
  ids.forEach(function(id) {
    try {
      if (action === 'archive') results.push(adminArchiveData(token, tableKey, id));
      else if (action === 'restore') results.push(adminRestoreDataSafe(token, tableKey, id));
      else if (action === 'delete') results.push(adminHardDeleteData(token, tableKey, id));
      else results.push({success:false,id:id,error:'Acción masiva inválida'});
    } catch (err) {
      results.push({success:false,id:id,error:err.message});
    }
  });

  return {success:true,results:results};
}
