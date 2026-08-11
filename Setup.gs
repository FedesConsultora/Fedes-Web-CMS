function setupFedesCms() {
  var ss = getSpreadsheet_();
  Object.keys(SCHEMA).forEach(function(sheetName){ ensureSheet_(sheetName, SCHEMA[sheetName]); });

  var props = PropertiesService.getScriptProperties();
  var mediaFolderId = props.getProperty(APP.PROPS.MEDIA_FOLDER_ID);
  if (!mediaFolderId) {
    var folder = DriveApp.createFolder('FEDES Landing CMS Media');
    props.setProperty(APP.PROPS.MEDIA_FOLDER_ID, folder.getId());
    mediaFolderId = folder.getId();
  }

  if (!props.getProperty(APP.PROPS.ADMIN_PASSWORD_HASH)) resetAdminPassword_();
  if (!props.getProperty(APP.PROPS.VADDAR_API_KEY_HASH)) rotateVaddarApiKey_();

  seedCurrentLanding_();
  migrateLegacyData_();

  systemSet_('schema_version', String(APP.SCHEMA_VERSION));
  systemSet_('app_version', APP.VERSION);
  systemSet_('spreadsheet_id', ss.getId());
  systemSet_('media_folder_id', mediaFolderId);
  systemSet_('setup_at', nowIso_());
  props.setProperty(APP.PROPS.SETUP_COMPLETE, 'true');

  Logger.log('Setup completo. Spreadsheet: ' + ss.getUrl());
  Logger.log('Panel: ' + (ScriptApp.getService().getUrl() || '[desplegá como Web App]') + '?page=admin');
  return {
    success:true,
    spreadsheetId:ss.getId(),
    spreadsheetUrl:ss.getUrl(),
    mediaFolderId:mediaFolderId,
    version:APP.VERSION,
  };
}

function systemSet_(key, value) {
  var sheet = getSpreadsheet_().getSheetByName(APP.SHEETS.SYSTEM);
  if (!sheet) return;
  var rows = dbReadAll_(APP.SHEETS.SYSTEM, {includeArchived:true});
  var found = rows.find(function(r){ return r.key === key; });
  if (found) {
    var values = sheet.getDataRange().getValues();
    for (var i=1;i<values.length;i++) {
      if (String(values[i][0]) === String(key)) {
        sheet.getRange(i+1,2,1,2).setValues([[value, nowIso_()]]); return;
      }
    }
  }
  sheet.appendRow([key,value,nowIso_()]);
}

function systemGet_(key) {
  var row = dbFindOne_(APP.SHEETS.SYSTEM, function(r){ return r.key === key; }, {includeArchived:true});
  return row ? row.value : '';
}
