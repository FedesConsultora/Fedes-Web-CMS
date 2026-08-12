function adminQueryTableList_(token, tableKey, query) {
  requireAdminSession_(token);
  var def = adminRequireTable_(tableKey);
  var q = query || {};
  var all = dbReadAll_(def.sheet, {includeArchived:true}).map(function(row){ return adminSanitizeRowForUi_(def,row); });
  var base = all.slice();

  if (!safeBoolean_(q.includeArchived) && (SCHEMA[def.sheet] || []).indexOf('archived_at') >= 0) {
    base = base.filter(function(row){ return !safeString_(row.archived_at); });
  }

  var facets = {};
  (def.filters || []).forEach(function(field){
    var seen = {};
    base.forEach(function(row){
      var value = String(row[field] === undefined ? '' : row[field]);
      if (value !== '') seen[value] = true;
    });
    facets[field] = Object.keys(seen).sort();
  });

  var rows = base;
  var search = safeString_(q.search).toLowerCase();
  if (search) {
    rows = rows.filter(function(row){
      return (def.search || []).some(function(field){
        return String(row[field] === undefined ? '' : row[field]).toLowerCase().indexOf(search) >= 0;
      });
    });
  }

  var filters = q.filters || {};
  Object.keys(filters).forEach(function(field){
    var wanted = filters[field];
    if (wanted === undefined || wanted === null || String(wanted) === '') return;
    var values = Array.isArray(wanted) ? wanted : String(wanted).split('|');
    rows = rows.filter(function(row){ return values.indexOf(String(row[field] === undefined ? '' : row[field])) >= 0; });
  });

  var dateField = safeString_(q.dateField) || def.dateField;
  var from = safeString_(q.dateFrom);
  var to = safeString_(q.dateTo);
  if (dateField && (from || to)) {
    rows = rows.filter(function(row){
      var t = Date.parse(row[dateField] || '');
      if (!isFinite(t)) return false;
      if (from && t < Date.parse(from)) return false;
      if (to) {
        var end = Date.parse(to);
        if (String(to).length <= 10) end += 86399999;
        if (t > end) return false;
      }
      return true;
    });
  }

  var sortBy = safeString_(q.sortBy) || def.dateField || def.pk;
  var sortDir = safeString_(q.sortDir).toLowerCase() === 'asc' ? 1 : -1;
  rows.sort(function(a,b){
    var av=a[sortBy], bv=b[sortBy], ad=Date.parse(av||''), bd=Date.parse(bv||'');
    if (isFinite(ad) && isFinite(bd)) return (ad-bd)*sortDir;
    var an=Number(av), bn=Number(bv);
    if (isFinite(an) && isFinite(bn) && String(av)!=='' && String(bv)!=='') return (an-bn)*sortDir;
    return String(av===undefined?'':av).localeCompare(String(bv===undefined?'':bv))*sortDir;
  });

  var total = rows.length;
  var page = Math.max(1, safeNumber_(q.page,1));
  var pageSize = Math.min(100, Math.max(10, safeNumber_(q.pageSize,50)));
  var start = (page-1)*pageSize;
  var pageRows = rows.slice(start,start+pageSize).map(function(row){ return adminListProjection_(def,row); });

  return {
    success:true,
    tableKey:tableKey,
    total:total,
    page:page,
    pageSize:pageSize,
    pages:Math.max(1,Math.ceil(total/pageSize)),
    rows:pageRows,
    facets:facets
  };
}

function adminListProjection_(def, row) {
  var out = {};
  var fields = [def.pk].concat(def.list || []);
  if ((SCHEMA[def.sheet] || []).indexOf('archived_at') >= 0) fields.push('archived_at');
  fields.forEach(function(field){ if (out[field] === undefined) out[field] = row[field]; });
  return out;
}

function adminGetRecord_(token, tableKey, id) {
  requireAdminSession_(token);
  var def = adminRequireTable_(tableKey);
  var row = dbFindById_(def.sheet, safeString_(id), {includeArchived:true});
  if (!row) throw new Error('Registro no encontrado');
  return {success:true, record:adminSanitizeRowForUi_(def,row)};
}
