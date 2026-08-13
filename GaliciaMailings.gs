var GALICIA_MAILING_PLAN = Object.freeze({
  A: Object.freeze([
    Object.freeze({templateKey:'galicia_a_01_preaprobado',sequence:1,delayHours:0,purpose:'Confirmación y acceso al beneficio'}),
    Object.freeze({templateKey:'galicia_a_02_metodologia',sequence:2,delayHours:72,purpose:'Metodología y valor del onboarding'}),
    Object.freeze({templateKey:'galicia_a_03_seguimiento',sequence:3,delayHours:168,purpose:'Seguimiento y próximo paso'}),
  ]),
  B: Object.freeze([
    Object.freeze({templateKey:'galicia_b_01_revision',sequence:1,delayHours:0,purpose:'Confirmación de revisión manual'}),
    Object.freeze({templateKey:'galicia_b_02_seguimiento',sequence:2,delayHours:96,purpose:'Seguimiento de evaluación'}),
  ]),
  C: Object.freeze([
    Object.freeze({templateKey:'galicia_c_01_recursos',sequence:1,delayHours:24,purpose:'Recursos estratégicos y orientación'}),
  ]),
  D: Object.freeze([
    Object.freeze({templateKey:'galicia_d_01_recuperacion',sequence:1,delayHours:24,purpose:'Recuperación de formulario incompleto'}),
  ]),
});

function syncGaliciaMailingsForLead_(leadOrId) {
  var lead = typeof leadOrId === 'object' && leadOrId ? leadOrId : resolveGaliciaLead_(safeString_(leadOrId));
  if (!lead || safeString_(lead.campaign_key)!==GALICIA.CAMPAIGN_KEY) return {success:true,skipped:true,reason:'not_galicia'};
  if (safeString_(lead.archived_at)) return {success:true,skipped:true,reason:'archived'};

  var segment = galiciaMailingSegmentForLead_(lead);
  var plan = GALICIA_MAILING_PLAN[segment] || [];
  if (!plan.length) return {success:true,skipped:true,reason:'no_plan'};

  var baseAt = galiciaMailingBaseDate_(lead,segment);
  var existing = dbReadAll_(APP.SHEETS.LEAD_MAILINGS,{includeArchived:true}).filter(function(row){
    return safeString_(row.lead_id)===safeString_(lead.lead_id) && safeString_(row.campaign_key)===GALICIA.CAMPAIGN_KEY;
  });
  var wanted={};
  plan.forEach(function(item){ wanted[item.templateKey]=true; });

  existing.forEach(function(row){
    var status=safeString_(row.status);
    var template=safeString_(row.template_key);
    if (wanted[template]) return;
    if (['sent','opened','clicked'].indexOf(status)>=0) return;
    if (!safeString_(row.archived_at)) dbArchiveById_(APP.SHEETS.LEAD_MAILINGS,row.mailing_id);
  });

  var created=0,updated=0;
  plan.forEach(function(item){
    var scheduledAt=new Date(baseAt.getTime()+item.delayHours*60*60*1000).toISOString();
    var match=existing.filter(function(row){return safeString_(row.template_key)===item.templateKey;})[0] || null;
    var metadata={purpose:item.purpose,automation:'queue_only',requiresProvider:true};
    if (segment==='C') metadata.communicationRule='empathetic_resources_no_rejection_language';
    if (segment==='D') metadata.resumeRequired=true;

    if (match) {
      if (['sent','opened','clicked'].indexOf(safeString_(match.status))>=0) return;
      dbUpdateById_(APP.SHEETS.LEAD_MAILINGS,match.mailing_id,{
        segment:segment,
        sequence_no:item.sequence,
        status:'pending',
        scheduled_at:scheduledAt,
        provider:'',
        error_message:'',
        archived_at:'',
        metadata_json:jsonStringify_(metadata)
      });
      updated++;
      return;
    }

    dbInsert_(APP.SHEETS.LEAD_MAILINGS,{
      lead_id:lead.lead_id,
      campaign_key:GALICIA.CAMPAIGN_KEY,
      segment:segment,
      template_key:item.templateKey,
      sequence_no:item.sequence,
      status:'pending',
      scheduled_at:scheduledAt,
      provider:'',
      attempt_count:0,
      metadata_json:jsonStringify_(metadata)
    });
    created++;
  });

  return {success:true,leadId:lead.lead_id,segment:segment,planned:plan.length,created:created,updated:updated};
}

function syncGaliciaMailingQueue() {
  var leads=dbReadAll_(APP.SHEETS.LEADS).filter(function(lead){return safeString_(lead.campaign_key)===GALICIA.CAMPAIGN_KEY;});
  var summary={success:true,leads:leads.length,created:0,updated:0,skipped:0,errors:[]};
  leads.forEach(function(lead){
    try {
      var result=syncGaliciaMailingsForLead_(lead);
      summary.created+=safeNumber_(result.created,0);
      summary.updated+=safeNumber_(result.updated,0);
      if (result.skipped) summary.skipped++;
    } catch(err) {
      summary.errors.push({leadId:safeString_(lead.lead_id),error:err.message});
    }
  });
  return summary;
}

function galiciaMailingSegmentForLead_(lead) {
  if (safeString_(lead.status)!=='complete') return 'D';
  var segment=safeString_(lead.mailing_segment).toUpperCase();
  return ['A','B','C'].indexOf(segment)>=0?segment:'';
}

function galiciaMailingBaseDate_(lead,segment) {
  var raw=segment==='D'?(lead.created_at||lead.last_activity_at):(lead.completed_at||lead.last_activity_at||lead.created_at);
  var ms=Date.parse(raw||'');
  if (!isFinite(ms)) ms=Date.now();
  return new Date(ms);
}
