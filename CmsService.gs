var GALICIA_PRODUCTION_PATH = '/bonificacion-galicia';
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

function normalizePublicCampaign_(campaign, mediaMap) {
  var out=normalizeRecordForOutput_(campaign||{});
  mediaMap=mediaMap||publicMediaMap_();
  var metadata=jsonParse_(out.metadata_json,{});
  if (!metadata || typeof metadata!=='object' || Array.isArray(metadata)) metadata={};

  if (out.campaign_key==='galicia-2026') {
    out.landing_path=GALICIA_PRODUCTION_PATH;
    out.name=safeString_(out.name).replace(/Banco Galicia/g,'Galicia');
    metadata.event=GALICIA_EVENT_NAME;
    if (!safeNumber_(metadata.maxQualifiedSlots,0)) metadata.maxQualifiedSlots=10;
  }

  var banner=metadata.hero_banner;
  if (banner && typeof banner==='object' && !Array.isArray(banner)) {
    var desktopMedia=mediaMap[safeString_(banner.desktop_media_id)]||null;
    var mobileMedia=mediaMap[safeString_(banner.mobile_media_id)]||null;
    var desktopUrl=desktopMedia ? (desktopMedia.public_url || desktopMedia.drive_url || '') : '';
    var mobileUrl=mobileMedia ? (mobileMedia.public_url || mobileMedia.drive_url || '') : '';

    var defaultClickUrl='';
    var path=safeString_(out.landing_path)||'/';
    if (out.campaign_key==='galicia-2026') {
      defaultClickUrl='/bonificacion-galicia?source=home_banner&utm_source=fedesconsultora&utm_medium=website&utm_campaign=beneficio_galicia_2026';
    } else if (path && path!=='/') {
      var sep=path.indexOf('?')>=0?'&':'?';
      defaultClickUrl=path+sep+'source=home_banner&utm_source=fedesconsultora&utm_medium=website&utm_campaign='+encodeURIComponent(out.campaign_key||'campaign');
    }

    out.hero_banner={
      enabled: safeBoolean_(banner.enabled),
      desktop_media_id: safeString_(banner.desktop_media_id),
      mobile_media_id: safeString_(banner.mobile_media_id),
      desktop_url: desktopUrl,
      mobile_url: mobileUrl,
      alt: safeString_(banner.alt),
      display_seconds: safeNumber_(banner.display_seconds, 6),
      show_once_per_session: banner.show_once_per_session !== false,
      click_url: safeString_(banner.click_url) || defaultClickUrl,
      open_in_new_tab: safeBoolean_(banner.open_in_new_tab)
    };
  } else {
    out.hero_banner=null;
  }

  out.metadata_json=jsonStringify_(metadata);
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
    campaigns:publishedRows_(APP.SHEETS.CAMPAIGNS).map(function(c){ return normalizePublicCampaign_(c, media); }),
  };
  cache.put('bootstrap',JSON.stringify(payload),APP.CACHE_TTL_SECONDS);
  return payload;
}

function getCampaignsPublic_() {
  var media=publicMediaMap_();
  return publishedRows_(APP.SHEETS.CAMPAIGNS).map(function(c){
    c=ensureGaliciaCampaignPath_(c);
    return normalizePublicCampaign_(c, media);
  });
}

function getCampaignPublic_(key) {
  var campaign=dbFindOne_(APP.SHEETS.CAMPAIGNS,function(r){ return r.campaign_key===key && r.status==='published'; });
  if (!campaign) return null;
  campaign=ensureGaliciaCampaignPath_(campaign);
  return normalizePublicCampaign_(campaign, publicMediaMap_());
}

