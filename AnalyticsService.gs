function saveTracking_(data) {
  data=data||{};
  return dbInsert_(APP.SHEETS.ANALYTICS,{
    category:safeString_(data.category),label:safeString_(data.label),value:safeString_(data.value),page_path:safeString_(data.url||data.pagePath),
    session_id:safeString_(data.sessionId),source:safeString_(data.source)||'landing',metadata_json:jsonStringify_(data.extraData||data)
  });
}
