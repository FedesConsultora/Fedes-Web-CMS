var GALICIA_PRODUCTION_PATH = '/regalo-galicia';
var GALICIA_EVENT_NAME = 'Pymes que venden más: cómo arrancar de cero con publicidad, automatización e IA.';

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

function normalizePublicCampaign_(campaign) {
  var out=normalizeRecordForOutput_(campaign||{});
  if (out.campaign_key==='galicia-2026') {
    out.landing_path=GALICIA_PRODUCTION_PATH;
    out.name=safeString_(out.name).replace(/Banco Galicia/g,'Galicia');
    var metadata=jsonParse_(out.metadata_json,{});
    if (!metadata || typeof metadata!=='object' || Array.isArray(metadata)) metadata={};
    metadata.event=GALICIA_EVENT_NAME;
    if (!safeNumber_(metadata.maxQualifiedSlots,0)) metadata.maxQualifiedSlots=10;
    out.metadata_json=jsonStringify_(metadata);
  }
  return out;
}

function ensureGaliciaCampaignPath_(campaign) {
  if (!campaign || campaign.campaign_key!=='galicia-2026') return campaign;
  if (!safeString_(campaign.campaign_id)) return campaign;

  var patch={};
  if (safeString_(campaign.landing_path)!==GALICIA_PRODUCTION_PATH) patch.landing_path=GALICIA_PRODUCTION_PATH;

  var currentName=safeString_(campaign.name);
  var normalizedName=currentName.replace(/Banco Galicia/g,'Galicia');
  if (normalizedName!==currentName) patch.name=normalizedName;

  var metadata=jsonParse_(campaign.metadata_json,{});
  if (!metadata || typeof metadata!=='object' || Array.isArray(metadata)) metadata={};
  var metadataChanged=false;
  if (safeString_(metadata.event)!==GALICIA_EVENT_NAME) { metadata.event=GALICIA_EVENT_NAME; metadataChanged=true; }
  if (!safeNumber_(metadata.maxQualifiedSlots,0)) { metadata.maxQualifiedSlots=10; metadataChanged=true; }
  if (metadataChanged) patch.metadata_json=jsonStringify_(metadata);

  if (!Object.keys(patch).length) return campaign;

  try {
    var saved=dbUpdateById_(APP.SHEETS.CAMPAIGNS,campaign.campaign_id,patch);
    if (saved) audit_('system','system',APP.SHEETS.CAMPAIGNS,campaign.campaign_id,'normalize_production_config',campaign,saved,'campaign_compat');
    invalidatePublicCache_();
    return saved||campaign;
  } catch (err) {
    console.warn('[Galicia] No se pudo normalizar configuración productiva',err);
    return campaign;
  }
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
    campaigns:publishedRows_(APP.SHEETS.CAMPAIGNS).map(normalizePublicCampaign_),
  };
  cache.put('bootstrap',JSON.stringify(payload),APP.CACHE_TTL_SECONDS);
  return payload;
}

function getCampaignPublic_(key) {
  var campaign=dbFindOne_(APP.SHEETS.CAMPAIGNS,function(r){ return r.campaign_key===key && r.status==='published'; });
  if (!campaign) return null;
  campaign=ensureGaliciaCampaignPath_(campaign);
  return normalizePublicCampaign_(campaign);
}
