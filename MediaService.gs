function mediaFolder_() {
  var id=PropertiesService.getScriptProperties().getProperty(APP.PROPS.MEDIA_FOLDER_ID);
  if (!id) throw new Error('Media folder no configurado. Ejecutá setupFedesCms().');
  return DriveApp.getFolderById(id);
}

function mediaPublicImageUrl_(recordOrFileId) {
  var fileId='';
  if (recordOrFileId && typeof recordOrFileId==='object') {
    fileId=safeString_(recordOrFileId.file_id);
    if (!fileId) return safeString_(recordOrFileId.public_url)||safeString_(recordOrFileId.drive_url);
  } else {
    fileId=safeString_(recordOrFileId);
  }
  if (!fileId) return '';
  return 'https://lh3.googleusercontent.com/d/'+encodeURIComponent(fileId)+'=w2000';
}

function ensureMediaPublicSharing_(file) {
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
  } catch(err) {
    console.warn('[Media] No se pudo cambiar sharing de Drive',err);
  }

  var access=null;
  try { access=file.getSharingAccess(); } catch(err2) { console.warn('[Media] No se pudo leer sharing de Drive',err2); }
  var isPublic=access===DriveApp.Access.ANYONE_WITH_LINK||access===DriveApp.Access.ANYONE;
  if (!isPublic) {
    throw new Error('Google Drive guardó el archivo pero no permite publicarlo con enlace. Revisá la política de uso compartido del Workspace antes de usarlo en la web pública.');
  }
  return true;
}

function uploadMediaAdmin(token,payload) {
  var session=requireAdminSession_(token);
  payload=payload||{};
  var base64=safeString_(payload.base64).replace(/^data:[^;]+;base64,/, '');
  var bytes=Utilities.base64Decode(base64);
  if (!bytes.length) throw new Error('Archivo vacío');
  if (bytes.length>APP.MAX_MEDIA_BYTES) throw new Error('Archivo demasiado grande. Máximo '+Math.round(APP.MAX_MEDIA_BYTES/1024/1024)+' MB.');
  var mime=safeString_(payload.mimeType)||'application/octet-stream';
  if (!/^image\//.test(mime)) throw new Error('Por ahora el CMS acepta imágenes.');
  var name=safeString_(payload.fileName)||('media-'+Date.now());
  var blob=Utilities.newBlob(bytes,mime,name);
  var file=mediaFolder_().createFile(blob);
  ensureMediaPublicSharing_(file);
  var publicUrl=mediaPublicImageUrl_(file.getId());
  var rec=dbInsert_(APP.SHEETS.MEDIA,{
    file_id:file.getId(),file_name:name,mime_type:mime,file_size:bytes.length,drive_url:file.getUrl(),public_url:publicUrl,alt_text:safeString_(payload.altText),
    entity_type:safeString_(payload.entityType),entity_id:safeString_(payload.entityId),sort_order:safeNumber_(payload.sortOrder,0),status:'published',metadata_json:jsonStringify_({uploadedBy:session.actor,sharing:'anyone_with_link'})
  });
  audit_(session.actor,'admin',APP.SHEETS.MEDIA,rec.media_id,'upload',null,rec,'admin_panel');
  invalidatePublicCache_();
  return {success:true,media:rec};
}
