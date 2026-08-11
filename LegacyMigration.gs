function migrateLegacyData_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(APP.PROPS.LEGACY_MIGRATION_DONE) === 'true') return;
  var ss = getSpreadsheet_();
  migrateLegacyContacts_(ss.getSheetByName(APP.LEGACY_SHEETS.CONTACTS));
  migrateLegacyTracking_(ss.getSheetByName(APP.LEGACY_SHEETS.TRACKING));
  migrateLegacyBlog_(ss.getSheetByName(APP.LEGACY_SHEETS.BLOG));
  migrateLegacyGallery_(ss.getSheetByName(APP.LEGACY_SHEETS.GALLERY));
  migrateLegacyOnboarding_(ss);
  props.setProperty(APP.PROPS.LEGACY_MIGRATION_DONE, 'true');
  systemSet_('legacy_migration_v1_at', nowIso_());
}

function legacyRows_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  var headers = dbHeaders_(sheet);
  return sheet.getRange(2,1,sheet.getLastRow()-1,headers.length).getValues().map(function(row){
    var obj={}; headers.forEach(function(h,i){ obj[h]=normalizeCellValue_(row[i]); }); return obj;
  });
}

function migrateLegacyContacts_(sheet) {
  legacyRows_(sheet).forEach(function(r){
    var email=sanitizeEmail_(firstDefined_(r,['Email','email','Correo','Correo Electrónico'],''));
    var created=firstDefined_(r,['Timestamp','Fecha','created_at'],nowIso_());
    var marker=digestHex_(jsonStringify_([email,created,firstDefined_(r,['Mensaje','message'],'' )]));
    var exists=dbFindOne_(APP.SHEETS.CONTACTS,function(x){ return jsonParse_(x.metadata_json,{}).legacy_marker===marker;},{includeArchived:true});
    if (!exists) dbInsert_(APP.SHEETS.CONTACTS,{
      created_at:created,updated_at:created,
      full_name:firstDefined_(r,['Nombre','Nombre Completo','full_name'],''),
      email:email, phone:firstDefined_(r,['Teléfono','Telefono','phone'],''), company:firstDefined_(r,['Empresa','company'],''),
      message:firstDefined_(r,['Mensaje','message'],''), source:'legacy_contact', page_path:'', status:'new',
      metadata_json:jsonStringify_({legacy_marker:marker,legacy_row:r})
    });
  });
}

function migrateLegacyTracking_(sheet) {
  legacyRows_(sheet).forEach(function(r){
    var marker=digestHex_(jsonStringify_(r));
    var exists=dbFindOne_(APP.SHEETS.ANALYTICS,function(x){ return jsonParse_(x.metadata_json,{}).legacy_marker===marker;},{includeArchived:true});
    if (!exists) dbInsert_(APP.SHEETS.ANALYTICS,{
      category:firstDefined_(r,['Categoría','Categoria','category'],''), label:firstDefined_(r,['Label','label','Acción','Accion'],''),
      value:firstDefined_(r,['Value','value','Valor'],''), page_path:firstDefined_(r,['URL','url','Página','Pagina'],''),
      source:'legacy_tracking', metadata_json:jsonStringify_({legacy_marker:marker,legacy_row:r}),
      created_at:firstDefined_(r,['Timestamp','timestamp','Fecha'],nowIso_())
    });
  });
}

function migrateLegacyBlog_(sheet) {
  legacyRows_(sheet).forEach(function(r){
    var title=firstDefined_(r,['Título','Titulo','title'], '');
    if (!title) return;
    var slug=slugify_(firstDefined_(r,['Slug','slug'],title));
    seedIfMissing_(APP.SHEETS.BLOG,'slug',slug,{
      slug:slug,title:title,description:firstDefined_(r,['Descripción','Descripcion','description'],''),
      content:firstDefined_(r,['Contenido','Cuerpo','Content','content'],''),author:firstDefined_(r,['Autor','Author','author'],''),
      published_at:firstDefined_(r,['Fecha de Publicación','Fecha de Publicacion','date'],''),image_url:firstDefined_(r,['Imagen URL','image','image_url'],''),
      external_url:firstDefined_(r,['Enlace Interno/Externo','link','url'],''),sort_order:100,status:'published',metadata_json:jsonStringify_({legacy_row:r})
    });
  });
}

function migrateLegacyGallery_(sheet) {
  legacyRows_(sheet).forEach(function(r,idx){
    var url=firstDefined_(r,['Imagen URL','imageUrl','image_url','URL'], '');
    if (!url) return;
    var existing=dbFindOne_(APP.SHEETS.GALLERY,function(x){ return String(x.external_url)===String(url);},{includeArchived:true});
    if (!existing) dbInsert_(APP.SHEETS.GALLERY,{title:'',caption:'',external_url:url,alt_text:'',sort_order:(idx+1)*10,status:'published',metadata_json:jsonStringify_({legacy_row:r})});
  });
}

function migrateLegacyOnboarding_(ss) {
  var merged={};
  function mergeSheet(name, tag) {
    legacyRows_(ss.getSheetByName(name)).forEach(function(r){
      var cuit=safeString_(firstDefined_(r,['CUIT','cuit'],''));
      if (!cuit) return;
      merged[cuit]=merged[cuit]||{cuit:cuit,sources:{}};
      merged[cuit].sources[tag]=r;
    });
  }
  mergeSheet(APP.LEGACY_SHEETS.ONBOARDING_PROGRESS,'progress');
  mergeSheet(APP.LEGACY_SHEETS.ONBOARDING_STEP0,'step0');
  mergeSheet(APP.LEGACY_SHEETS.ONBOARDING_STEP1,'step1');
  Object.keys(merged).forEach(function(cuit){
    var m=merged[cuit], step0=m.sources.step0||{}, progress=m.sources.progress||{};
    var combined=omitSensitiveOnboardingFields_(Object.assign({},step0,m.sources.step1||{},jsonParse_(progress.formData||progress.FormData,{})));
    var exists=dbFindOne_(APP.SHEETS.ONBOARDING,function(x){ return String(x.cuit)===String(cuit);},{includeArchived:true});
    var rec={
      cuit:cuit,company_name:firstDefined_(combined,['fantasyName','Nombre de Fantasía / Marca','Empresa'],''),contact_name:firstDefined_(combined,['mainContactName','Contacto Principal','Nombre'],''),
      email:sanitizeEmail_(firstDefined_(combined,['email','Email Corporativo','Email'],'')),taxpayer_type:firstDefined_(combined,['taxpayerType','Condición frente al IVA'],''),
      current_step:safeNumber_(firstDefined_(progress,['currentStep','Paso Actual'],1),1),status:safeBoolean_(firstDefined_(progress,['isCompleted'],false))?'completed':'in_progress',
      is_completed:safeBoolean_(firstDefined_(progress,['isCompleted'],false)),data_json:jsonStringify_({formData:combined,legacySources:m.sources}),
      updated_at:firstDefined_(progress,['lastUpdated','Última Actualización'],nowIso_()),completed_at:safeBoolean_(firstDefined_(progress,['isCompleted'],false))?nowIso_():''
    };
    if (exists) dbUpdateById_(APP.SHEETS.ONBOARDING,exists.onboarding_id,rec); else dbInsert_(APP.SHEETS.ONBOARDING,rec);
  });
}
