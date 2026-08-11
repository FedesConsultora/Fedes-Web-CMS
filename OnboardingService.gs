function getOnboardingByCuit_(cuit) {
  return dbFindOne_(APP.SHEETS.ONBOARDING,function(r){ return String(r.cuit)===String(cuit);},{includeArchived:true});
}

function saveOnboardingProgress_(data) {
  data=data||{};
  var cuit=safeString_(data.cuit);
  if (!cuit) throw new Error('CUIT obligatorio');
  var existing=getOnboardingByCuit_(cuit);
  var currentData=existing?jsonParse_(existing.data_json,{}):{};
  var incoming=omitSensitiveOnboardingFields_(data.formData||{});
  var merged=Object.assign({},currentData.formData||{},incoming);
  var rec={
    cuit:cuit,company_name:safeString_(merged.fantasyName),contact_name:safeString_(merged.mainContactName),email:sanitizeEmail_(merged.email),taxpayer_type:safeString_(merged.taxpayerType),
    current_step:safeNumber_(data.currentStep,1),status:safeBoolean_(data.isCompleted)?'completed':'in_progress',is_completed:safeBoolean_(data.isCompleted),
    data_json:jsonStringify_({formData:merged}),completed_at:safeBoolean_(data.isCompleted)?nowIso_():(existing?existing.completed_at:'')
  };
  var saved=existing?dbUpdateById_(APP.SHEETS.ONBOARDING,existing.onboarding_id,rec):dbInsert_(APP.SHEETS.ONBOARDING,rec);
  return saved;
}

function saveOnboardingStep0_(data) {
  var clean=omitSensitiveOnboardingFields_(data||{});
  return saveOnboardingProgress_({cuit:clean.cuit,formData:clean,currentStep:2,isCompleted:false});
}

function saveOnboardingStep1_(data) {
  var clean=omitSensitiveOnboardingFields_(data||{});
  var existing=getOnboardingByCuit_(clean.cuit);
  var current=existing?jsonParse_(existing.data_json,{}).formData||{}:{};
  return saveOnboardingProgress_({cuit:clean.cuit,formData:Object.assign({},current,clean),currentStep:2,isCompleted:true});
}

function getOnboardingProgressPublic_(cuit) {
  var row=getOnboardingByCuit_(cuit);
  if (!row) return null;
  var data=jsonParse_(row.data_json,{});
  return {cuit:row.cuit,formData:data.formData||{},currentStep:safeNumber_(row.current_step,1),lastUpdated:row.updated_at,isCompleted:safeBoolean_(row.is_completed)};
}

function getAllOnboardingsLegacy_() {
  return dbReadAll_(APP.SHEETS.ONBOARDING).map(function(row){
    var data=jsonParse_(row.data_json,{});
    return {cuit:row.cuit,formData:data.formData||{},currentStep:safeNumber_(row.current_step,1),lastUpdated:row.updated_at,isCompleted:safeBoolean_(row.is_completed)};
  });
}
