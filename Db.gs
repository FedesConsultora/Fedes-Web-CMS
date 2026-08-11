function getSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(APP.PROPS.SPREADSHEET_ID);
  if (id) return SpreadsheetApp.openById(id);

  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    props.setProperty(APP.PROPS.SPREADSHEET_ID, active.getId());
    return active;
  }

  var created = SpreadsheetApp.create('FEDES Landing CMS DB');
  props.setProperty(APP.PROPS.SPREADSHEET_ID, created.getId());
  return created;
}

function ensureSheet_(sheetName, headers) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);

  var existingCols = sheet.getLastColumn();
  var existingHeaders = existingCols ? sheet.getRange(1,1,1,existingCols).getValues()[0].map(String) : [];
  if (!existingHeaders.length || existingHeaders.every(function(v){ return !v; })) {
    sheet.clear();
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1,1,1,headers.length).setFontWeight('bold');
    return sheet;
  }

  var missing = headers.filter(function(h){ return existingHeaders.indexOf(h) === -1; });
  if (missing.length) {
    var start = existingHeaders.length + 1;
    sheet.getRange(1,start,1,missing.length).setValues([missing]);
  }
  sheet.setFrozenRows(1);
  return sheet;
}

function dbHeaders_(sheet) {
  var lastColumn = sheet.getLastColumn();
  if (!lastColumn) return [];
  return sheet.getRange(1,1,1,lastColumn).getValues()[0].map(function(v){ return String(v); });
}

function dbReadAll_(sheetName, options) {
  options = options || {};
  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var headers = dbHeaders_(sheet);
  var values = sheet.getRange(2,1,sheet.getLastRow()-1,headers.length).getValues();
  var rows = values.map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = normalizeCellValue_(row[i]); });
    return obj;
  });
  if (!options.includeArchived && headers.indexOf('archived_at') >= 0) {
    rows = rows.filter(function(r){ return !safeString_(r.archived_at); });
  }
  return rows;
}

function dbFindOne_(sheetName, predicate, options) {
  var rows = dbReadAll_(sheetName, options);
  for (var i=0; i<rows.length; i++) if (predicate(rows[i])) return rows[i];
  return null;
}

function dbFindById_(sheetName, id, options) {
  var pk = PRIMARY_KEYS[sheetName];
  if (!pk) throw new Error('No primary key configured for ' + sheetName);
  return dbFindOne_(sheetName, function(r){ return String(r[pk]) === String(id); }, options);
}

function dbWriteRow_(sheet, headers, record, rowNumber) {
  var values = headers.map(function(h) {
    var v = record[h];
    if (v === undefined || v === null) return '';
    if (typeof v === 'object' && !(v instanceof Date)) return JSON.stringify(v);
    return v;
  });
  sheet.getRange(rowNumber,1,1,headers.length).setValues([values]);
}

function dbInsert_(sheetName, record) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSpreadsheet_().getSheetByName(sheetName);
    if (!sheet) throw new Error('Missing sheet ' + sheetName);
    var headers = dbHeaders_(sheet);
    var pk = PRIMARY_KEYS[sheetName];
    var row = Object.assign({}, record || {});
    if (pk && !row[pk]) row[pk] = uuid_();
    if (headers.indexOf('created_at') >= 0 && !row.created_at) row.created_at = nowIso_();
    if (headers.indexOf('updated_at') >= 0 && !row.updated_at) row.updated_at = nowIso_();
    dbWriteRow_(sheet, headers, row, sheet.getLastRow()+1);
    return normalizeRecordForOutput_(row);
  } finally {
    lock.releaseLock();
  }
}

function dbUpdateById_(sheetName, id, patch) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSpreadsheet_().getSheetByName(sheetName);
    if (!sheet) throw new Error('Missing sheet ' + sheetName);
    var headers = dbHeaders_(sheet);
    var pk = PRIMARY_KEYS[sheetName];
    var pkIndex = headers.indexOf(pk);
    if (pkIndex < 0) throw new Error('Missing primary key header ' + pk);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;
    var ids = sheet.getRange(2, pkIndex+1, lastRow-1, 1).getValues();
    for (var i=0; i<ids.length; i++) {
      if (String(ids[i][0]) === String(id)) {
        var rowNum = i+2;
        var currentVals = sheet.getRange(rowNum,1,1,headers.length).getValues()[0];
        var current = {};
        headers.forEach(function(h,j){ current[h] = normalizeCellValue_(currentVals[j]); });
        var next = Object.assign({}, current, patch || {});
        next[pk] = current[pk];
        if (headers.indexOf('updated_at') >= 0) next.updated_at = nowIso_();
        dbWriteRow_(sheet, headers, next, rowNum);
        return normalizeRecordForOutput_(next);
      }
    }
    return null;
  } finally {
    lock.releaseLock();
  }
}

function dbUpsert_(sheetName, record, matchFn) {
  var existing = dbFindOne_(sheetName, matchFn, {includeArchived:true});
  if (existing) return dbUpdateById_(sheetName, existing[PRIMARY_KEYS[sheetName]], record);
  return dbInsert_(sheetName, record);
}

function dbArchiveById_(sheetName, id) {
  var patch = { archived_at: nowIso_() };
  if (SCHEMA[sheetName].indexOf('status') >= 0) patch.status = APP.STATUS.ARCHIVED;
  return dbUpdateById_(sheetName, id, patch);
}

function dbRestoreById_(sheetName, id) {
  var patch = { archived_at: '' };
  if (SCHEMA[sheetName].indexOf('status') >= 0) patch.status = APP.STATUS.DRAFT;
  return dbUpdateById_(sheetName, id, patch);
}

function dbDeleteWhere_(sheetName, predicate) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSpreadsheet_().getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return 0;
    var headers = dbHeaders_(sheet);
    var values = sheet.getRange(2,1,sheet.getLastRow()-1,headers.length).getValues();
    var deleteRows = [];
    values.forEach(function(row, idx) {
      var obj = {};
      headers.forEach(function(h,i){ obj[h] = normalizeCellValue_(row[i]); });
      if (predicate(obj)) deleteRows.push(idx+2);
    });
    deleteRows.sort(function(a,b){ return b-a; }).forEach(function(r){ sheet.deleteRow(r); });
    return deleteRows.length;
  } finally { lock.releaseLock(); }
}

function sortPublished_(rows) {
  return rows.sort(function(a,b){
    var sa = safeNumber_(a.sort_order, 9999), sb = safeNumber_(b.sort_order, 9999);
    if (sa !== sb) return sa - sb;
    return String(a.created_at || '').localeCompare(String(b.created_at || ''));
  });
}

function invalidatePublicCache_() {
  CacheService.getScriptCache().removeAll(['bootstrap','blog','gallery','modules','cases','team','testimonials','campaigns']);
}
