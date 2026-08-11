function audit_(actor, actorType, entity, entityId, action, beforeObj, afterObj, source) {
  try {
    var sheet = getSpreadsheet_().getSheetByName(APP.SHEETS.AUDIT);
    if (!sheet) return;
    sheet.appendRow([
      uuid_(), safeString_(actor), safeString_(actorType), safeString_(entity), safeString_(entityId), safeString_(action),
      jsonStringify_(beforeObj), jsonStringify_(afterObj), safeString_(source), nowIso_()
    ]);
  } catch (err) {
    console.error('Audit failed', err);
  }
}
