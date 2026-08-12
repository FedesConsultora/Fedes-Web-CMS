function legacyBlog_(){ return publishedRows_(APP.SHEETS.BLOG).map(function(r){ return {'ID':r.post_id,'Fecha de Publicación':r.published_at,'Título':r.title,'Descripción':r.description,'Contenido':r.content,'Autor':r.author,'Imagen URL':r.media_id?(dbFindById_(APP.SHEETS.MEDIA,r.media_id)||{}).public_url:r.image_url,'Enlace Interno/Externo':r.external_url}; }); }
function legacyGallery_(){ return publishedRows_(APP.SHEETS.GALLERY).map(function(r){ return {'ID':r.gallery_id,'Imagen URL':r.media_id?(dbFindById_(APP.SHEETS.MEDIA,r.media_id)||{}).public_url:r.external_url}; }); }
function legacyContacts_(){ return dbReadAll_(APP.SHEETS.CONTACTS); }
function legacyAnalytics_(){ return dbReadAll_(APP.SHEETS.ANALYTICS); }

function handleLegacyGet_(e){
  var action=safeString_(e.parameter.action),result;
  if(action==='blog') result=legacyBlog_();
  else if(action==='galeria') result=legacyGallery_();
  else if(action==='getProgress') result=getOnboardingProgressPublic_(e.parameter.cuit);
  else if(action==='getAllOnboardings') result=getAllOnboardingsLegacy_();
  else if(action==='getAllContacts') result=legacyContacts_();
  else if(action==='getAnalyticsTracking') result=legacyAnalytics_();
  else result=responseError_('Acción no válida','INVALID_ACTION',404);
  return responseJson_(result,e.parameter.callback);
}

function handleLegacyPost_(action,data){
  if(action==='contact') return {success:true,data:saveContact_(data)};
  if(action==='onboardingStep0') return {success:true,data:saveOnboardingStep0_(data)};
  if(action==='onboardingStep1') return {success:true,data:saveOnboardingStep1_(data)};
  if(action==='saveProgress') return {success:true,data:saveOnboardingProgress_(data)};
  if(action==='track') return {success:true,data:saveTracking_(data)};
  if(action==='galiciaStart') return saveGaliciaLead_(data);
  if(action==='galiciaProgress') return saveGaliciaProgressSafe_(data);
  if(action==='galiciaComplete') return completeGaliciaLead_(data);
  if(action==='galiciaMeetingClick') return markGaliciaMeetingClick_(data);
  if(action==='addGaleriaFoto') {
    var rec=dbInsert_(APP.SHEETS.GALLERY,{external_url:safeString_(data.imageUrl),sort_order:999,status:'published'});invalidatePublicCache_();return {success:true,data:rec};
  }
  if(action==='deleteGaleriaFoto') {
    var existing=dbFindById_(APP.SHEETS.GALLERY,safeString_(data.id),{includeArchived:true});if(existing){dbArchiveById_(APP.SHEETS.GALLERY,existing.gallery_id);invalidatePublicCache_();}return {success:true};
  }
  return responseError_('Acción no válida','INVALID_ACTION',404);
}
