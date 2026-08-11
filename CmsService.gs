function publishedRows_(sheetName) {
  return sortPublished_(dbReadAll_(sheetName).filter(function(r){ return safeString_(r.status) === APP.STATUS.PUBLISHED; }));
}

function settingsObject_() {
  var out={};
  publishedRows_(APP.SHEETS.SETTINGS).forEach(function(r){
    var value=r.setting_value;
    if (r.value_type==='boolean') value=safeBoolean_(value);
    else if (r.value_type==='number') value=safeNumber_(value,0);
    else if (r.value_type==='json') value=jsonParse_(value,null);
    out[r.setting_key]=value;
  });
  return out;
}

function contentObject_() {
  var out={};
  publishedRows_(APP.SHEETS.CONTENT).forEach(function(r){
    out[r.content_key]=normalizeRecordForOutput_(r);
  });
  return out;
}

function publicMediaMap_() {
  var out={};
  publishedRows_(APP.SHEETS.MEDIA).forEach(function(r){ out[r.media_id]=normalizeRecordForOutput_(r); });
  return out;
}

function enrichMedia_(rows, mediaMap, fieldName) {
  fieldName=fieldName||'media_id';
  return rows.map(function(r){
    var copy=normalizeRecordForOutput_(r);
    var id=copy[fieldName];
    if (id && mediaMap[id]) copy.media=mediaMap[id];
    return copy;
  });
}

function getBootstrapPayload_() {
  var cache=CacheService.getScriptCache();
  var cached=cache.get('bootstrap');
  if (cached) return jsonParse_(cached,{});
  var media=publicMediaMap_();
  var payload={
    meta:{app:APP.NAME,version:APP.VERSION,schemaVersion:APP.SCHEMA_VERSION,generatedAt:nowIso_()},
    settings:settingsObject_(),
    content:contentObject_(),
    onboardingModules:enrichMedia_(publishedRows_(APP.SHEETS.MODULES),media),
    caseStudies:enrichMedia_(publishedRows_(APP.SHEETS.CASES),media),
    testimonials:enrichMedia_(publishedRows_(APP.SHEETS.TESTIMONIALS),media,'logo_media_id'),
    team:enrichMedia_(publishedRows_(APP.SHEETS.TEAM),media),
    blog:enrichMedia_(publishedRows_(APP.SHEETS.BLOG),media),
    gallery:enrichMedia_(publishedRows_(APP.SHEETS.GALLERY),media),
    campaigns:publishedRows_(APP.SHEETS.CAMPAIGNS),
  };
  cache.put('bootstrap',JSON.stringify(payload),APP.CACHE_TTL_SECONDS);
  return payload;
}

function getCampaignPublic_(key) {
  return dbFindOne_(APP.SHEETS.CAMPAIGNS,function(r){ return r.campaign_key===key && r.status==='published'; });
}
