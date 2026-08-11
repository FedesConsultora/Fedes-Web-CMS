function adminGetUiSchema(token) {
  requireAdminSession_(token);
  return {
    entities:ENTITY_DEFS,
    fields:{
      content:{content_key:'text',section:'text',title:'text',subtitle:'textarea',body:'textarea',cta_label:'text',cta_url:'url',media_id:'mediaRef',sort_order:'number',featured:'boolean',status:'status',metadata_json:'json'},
      onboardingModules:{module_key:'text',title:'text',description:'textarea',deliverable:'textarea',value_text:'textarea',media_id:'mediaRef',accent_color:'text',sort_order:'number',featured:'boolean',status:'status',metadata_json:'json'},
      caseStudies:{case_key:'text',tag:'text',stat:'text',result_text:'textarea',media_id:'mediaRef',poster_url:'text',video_mp4_url:'text',video_webm_url:'text',sort_order:'number',featured:'boolean',status:'status',metadata_json:'json'},
      testimonials:{testimonial_key:'text',company:'text',person_name:'text',person_role:'text',quote:'textarea',logo_media_id:'mediaRef',sort_order:'number',featured:'boolean',status:'status',metadata_json:'json'},
      team:{team_key:'text',name:'text',role:'text',bio:'textarea',linkedin_url:'url',media_id:'mediaRef',sort_order:'number',featured:'boolean',status:'status',metadata_json:'json'},
      blogPosts:{slug:'text',title:'text',description:'textarea',content:'textarea',author:'text',published_at:'datetime',media_id:'mediaRef',image_url:'url',external_url:'url',sort_order:'number',featured:'boolean',status:'status',metadata_json:'json'},
      gallery:{title:'text',caption:'textarea',media_id:'mediaRef',external_url:'url',alt_text:'text',sort_order:'number',featured:'boolean',status:'status',metadata_json:'json'},
      campaigns:{campaign_key:'text',name:'text',landing_path:'text',benefit_label:'textarea',meeting_url:'url',starts_at:'datetime',ends_at:'datetime',sort_order:'number',featured:'boolean',status:'status',metadata_json:'json'},
      settings:{setting_key:'text',setting_value:'textarea',value_type:'text',group_name:'text',description:'textarea',status:'status'},
    },
    statusOptions:['draft','published','hidden','archived']
  };
}

function adminList(token,entity) {
  requireAdminSession_(token);
  var def=ENTITY_DEFS[entity]; if(!def) throw new Error('Entidad inválida');
  return sortPublishedForAdmin_(dbReadAll_(def.sheet,{includeArchived:true}));
}

function sortPublishedForAdmin_(rows){ return rows.sort(function(a,b){ return safeNumber_(a.sort_order,9999)-safeNumber_(b.sort_order,9999); }); }

function adminSave(token,entity,record) {
  var session=requireAdminSession_(token), def=ENTITY_DEFS[entity]; if(!def) throw new Error('Entidad inválida');
  record=record||{};
  var clean={}; def.fields.forEach(function(f){ if(record[f]!==undefined) clean[f]=record[f]; });
  if ('featured' in clean) clean.featured=safeBoolean_(clean.featured);
  if ('sort_order' in clean) clean.sort_order=safeNumber_(clean.sort_order,0);
  if (!clean.status && SCHEMA[def.sheet].indexOf('status')>=0) clean.status='draft';
  var id=safeString_(record[def.pk]);
  var before=id?dbFindById_(def.sheet,id,{includeArchived:true}):null;
  var saved=id?dbUpdateById_(def.sheet,id,clean):dbInsert_(def.sheet,clean);
  audit_(session.actor,'admin',def.sheet,saved[def.pk],id?'update':'create',before,saved,'admin_panel');
  invalidatePublicCache_();
  return {success:true,record:saved};
}

function adminArchive(token,entity,id){
  var session=requireAdminSession_(token),def=ENTITY_DEFS[entity]; if(!def) throw new Error('Entidad inválida');
  var before=dbFindById_(def.sheet,id,{includeArchived:true}),saved=dbArchiveById_(def.sheet,id);
  audit_(session.actor,'admin',def.sheet,id,'archive',before,saved,'admin_panel');invalidatePublicCache_();return {success:true,record:saved};
}
function adminRestore(token,entity,id){
  var session=requireAdminSession_(token),def=ENTITY_DEFS[entity]; if(!def) throw new Error('Entidad inválida');
  var before=dbFindById_(def.sheet,id,{includeArchived:true}),saved=dbRestoreById_(def.sheet,id);
  audit_(session.actor,'admin',def.sheet,id,'restore',before,saved,'admin_panel');invalidatePublicCache_();return {success:true,record:saved};
}
function adminDuplicate(token,entity,id){
  var session=requireAdminSession_(token),def=ENTITY_DEFS[entity]; if(!def) throw new Error('Entidad inválida');
  var original=dbFindById_(def.sheet,id,{includeArchived:true});if(!original) throw new Error('Registro no encontrado');
  var copy={};def.fields.forEach(function(f){copy[f]=original[f];});copy.status='draft';copy.sort_order=safeNumber_(original.sort_order,0)+1;
  if(copy.content_key) copy.content_key=copy.content_key+'-copy-'+Date.now();
  if(copy.module_key) copy.module_key=copy.module_key+'-copy-'+Date.now();
  if(copy.case_key) copy.case_key=copy.case_key+'-copy-'+Date.now();
  if(copy.testimonial_key) copy.testimonial_key=copy.testimonial_key+'-copy-'+Date.now();
  if(copy.team_key) copy.team_key=copy.team_key+'-copy-'+Date.now();
  if(copy.slug) copy.slug=copy.slug+'-copy-'+Date.now();
  if(copy.campaign_key) copy.campaign_key=copy.campaign_key+'-copy-'+Date.now();
  if(copy.setting_key) copy.setting_key=copy.setting_key+'-copy-'+Date.now();
  var saved=dbInsert_(def.sheet,copy);audit_(session.actor,'admin',def.sheet,saved[def.pk],'duplicate',original,saved,'admin_panel');invalidatePublicCache_();return {success:true,record:saved};
}

function adminGetDashboard(token){
  requireAdminSession_(token);
  var leads=dbReadAll_(APP.SHEETS.LEADS), contacts=dbReadAll_(APP.SHEETS.CONTACTS), onboarding=dbReadAll_(APP.SHEETS.ONBOARDING);
  return {success:true,stats:{leads:leads.length,qualified:leads.filter(function(x){return x.classification==='CALIFICADO';}).length,incomplete:leads.filter(function(x){return x.status==='incomplete';}).length,contacts:contacts.length,onboardings:onboarding.length},recentLeads:leads.slice(-20).reverse()};
}

function adminListMedia(token){ requireAdminSession_(token);return dbReadAll_(APP.SHEETS.MEDIA,{includeArchived:true}); }
function adminListLeads(token){ requireAdminSession_(token);return dbReadAll_(APP.SHEETS.LEADS,{includeArchived:true}).slice().reverse(); }
function adminListAudit(token){ requireAdminSession_(token);return dbReadAll_(APP.SHEETS.AUDIT,{includeArchived:true}).slice(-200).reverse(); }
