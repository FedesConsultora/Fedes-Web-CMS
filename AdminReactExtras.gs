function adminGetWorkspaceReact_(token) {
  var workspace = adminGetWorkspace(token);
  var leads = workspace.tables && workspace.tables.leads;
  if (leads && leads.fields) {
    leads.fields.forEach(function(field){
      if (field.name === 'resume_expires_at' || field.name === 'resume_token_hash') field.readOnly = true;
    });
  }
  return workspace;
}

function adminQueryTableList_(token, tableKey, query) {
  requireAdminSession_(token);
  var def = adminRequireTable_(tableKey);
  var q = query || {};
  var all = dbReadAll_(def.sheet, {includeArchived:true}).map(function(row){ return adminSanitizeRowForUi_(def,row); });
  var base = all.slice();
  if (!safeBoolean_(q.includeArchived) && (SCHEMA[def.sheet] || []).indexOf('archived_at') >= 0) base = base.filter(function(row){ return !safeString_(row.archived_at); });
  var facets = {};
  (def.filters || []).forEach(function(field){var seen={};base.forEach(function(row){var value=String(row[field]===undefined?'':row[field]);if(value!=='')seen[value]=true;});facets[field]=Object.keys(seen).sort();});
  var rows = base;
  var search = safeString_(q.search).toLowerCase();
  if (search) rows=rows.filter(function(row){return(def.search||[]).some(function(field){return String(row[field]===undefined?'':row[field]).toLowerCase().indexOf(search)>=0;});});
  var filters=q.filters||{};
  Object.keys(filters).forEach(function(field){var wanted=filters[field];if(wanted===undefined||wanted===null||String(wanted)==='')return;var values=Array.isArray(wanted)?wanted:String(wanted).split('|');rows=rows.filter(function(row){return values.indexOf(String(row[field]===undefined?'':row[field]))>=0;});});
  var dateField=safeString_(q.dateField)||def.dateField,from=safeString_(q.dateFrom),to=safeString_(q.dateTo);
  if(dateField&&(from||to))rows=rows.filter(function(row){var t=Date.parse(row[dateField]||'');if(!isFinite(t))return false;if(from&&t<Date.parse(from))return false;if(to){var end=Date.parse(to);if(String(to).length<=10)end+=86399999;if(t>end)return false;}return true;});
  var sortBy=safeString_(q.sortBy)||def.dateField||def.pk,sortDir=safeString_(q.sortDir).toLowerCase()==='asc'?1:-1;
  rows.sort(function(a,b){var av=a[sortBy],bv=b[sortBy],ad=Date.parse(av||''),bd=Date.parse(bv||'');if(isFinite(ad)&&isFinite(bd))return(ad-bd)*sortDir;var an=Number(av),bn=Number(bv);if(isFinite(an)&&isFinite(bn)&&String(av)!==''&&String(bv)!=='')return(an-bn)*sortDir;return String(av===undefined?'':av).localeCompare(String(bv===undefined?'':bv))*sortDir;});
  var total=rows.length,page=Math.max(1,safeNumber_(q.page,1)),pageSize=Math.min(100,Math.max(10,safeNumber_(q.pageSize,50))),start=(page-1)*pageSize;
  return {success:true,tableKey:tableKey,total:total,page:page,pageSize:pageSize,pages:Math.max(1,Math.ceil(total/pageSize)),rows:rows.slice(start,start+pageSize).map(function(row){return adminListProjection_(def,row);}),facets:facets};
}

function adminListProjection_(def,row){var out={},fields=[def.pk].concat(def.list||[]);if((SCHEMA[def.sheet]||[]).indexOf('archived_at')>=0)fields.push('archived_at');fields.forEach(function(field){if(out[field]===undefined)out[field]=row[field];});return out;}
function adminGetRecord_(token,tableKey,id){requireAdminSession_(token);var def=adminRequireTable_(tableKey),target=safeString_(id),row=dbFindOne_(def.sheet,function(item){return String(item[def.pk])===target;},{includeArchived:true});if(!row)throw new Error('Registro no encontrado');return{success:true,record:adminSanitizeRowForUi_(def,row)};}
function adminCreateDataReact_(token,tableKey,record){return adminCreateData(token,tableKey,adminProtectTechnicalFields_(tableKey,record));}
function adminUpdateDataReact_(token,tableKey,id,record){return adminUpdateData(token,tableKey,id,adminProtectTechnicalFields_(tableKey,record));}
function adminProtectTechnicalFields_(tableKey,record){var clean=Object.assign({},record||{});if(safeString_(tableKey)==='leads'){delete clean.resume_token_hash;delete clean.resume_expires_at;}return clean;}
function adminRestoreDataReact_(token,tableKey,id){requireAdminSession_(token);var def=adminRequireTable_(tableKey);if(def.deleteMode!=='archive')throw new Error('Restauración no habilitada para '+def.label);var before=dbFindOne_(def.sheet,function(item){return String(item[def.pk])===String(id);},{includeArchived:true});if(!before)throw new Error('Registro no encontrado');if(!safeString_(before.archived_at))return{success:true,unchanged:true,record:adminSanitizeRowForUi_(def,before)};return adminRestoreDataSafe(token,tableKey,id);}
function adminBulkActionReact_(token,tableKey,ids,action){requireAdminSession_(token);ids=Array.isArray(ids)?ids:[];if(ids.length>100)throw new Error('Máximo 100 registros por operación');var results=[];ids.forEach(function(id){try{if(action==='archive')results.push(adminArchiveData(token,tableKey,id));else if(action==='restore')results.push(adminRestoreDataReact_(token,tableKey,id));else if(action==='delete')results.push(adminHardDeleteData(token,tableKey,id));else results.push({success:false,id:id,error:'Acción inválida'});}catch(err){results.push({success:false,id:id,error:err.message});}});return{success:true,results:results};}
