function handlePublicApi_(e) {
  var api=safeString_(e.parameter.api), callback=e.parameter.callback;
  try {
    var payload;
    switch(api){
      case 'health': payload={success:true,app:APP.NAME,version:APP.VERSION,schemaVersion:APP.SCHEMA_VERSION,time:nowIso_()};break;
      case 'bootstrap': payload=getBootstrapPayload_();break;
      case 'blog': payload=publishedRows_(APP.SHEETS.BLOG);break;
      case 'gallery': payload=publishedRows_(APP.SHEETS.GALLERY);break;
      case 'onboarding-modules': payload=publishedRows_(APP.SHEETS.MODULES);break;
      case 'case-studies': payload=publishedRows_(APP.SHEETS.CASES);break;
      case 'team': payload=publishedRows_(APP.SHEETS.TEAM);break;
      case 'testimonials': payload=publishedRows_(APP.SHEETS.TESTIMONIALS);break;
      case 'campaign': payload=getCampaignPublic_(safeString_(e.parameter.key))||null;break;
      case 'lead-status': payload=getLeadPublicStatus_(safeString_(e.parameter.leadId));break;
      default: payload=responseError_('API no válida','INVALID_API',404);
    }
    return responseJson_(payload,callback);
  } catch(err){ return responseJson_(responseError_(err.message,'API_ERROR',500),callback); }
}

function handleInternalApi_(data) {
  if (!verifyVaddarApiKey_(data.apiKey)) return responseError_('API key inválida','UNAUTHORIZED',401);
  var action=safeString_(data.action);
  if(action==='internalHealth') return {success:true,app:APP.NAME,version:APP.VERSION,time:nowIso_()};
  if(action==='internalBootstrap') return {success:true,data:getBootstrapPayload_()};
  if(action==='internalLeads') {
    var since=safeString_(data.since);
    var rows=dbReadAll_(APP.SHEETS.LEADS,{includeArchived:true});
    if(since) rows=rows.filter(function(r){return String(r.updated_at||r.created_at||'')>since;});
    return {success:true,data:rows};
  }
  if(action==='internalAudit') {
    var since2=safeString_(data.since),audit=dbReadAll_(APP.SHEETS.AUDIT,{includeArchived:true});
    if(since2) audit=audit.filter(function(r){return String(r.created_at||'')>since2;});
    return {success:true,data:audit.slice(-1000)};
  }
  return responseError_('Acción interna no válida','INVALID_INTERNAL_ACTION',404);
}
