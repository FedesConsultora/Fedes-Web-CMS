const GALICIA = Object.freeze({
  CAMPAIGN_KEY:'galicia-2026',
  RESUME_TTL_HOURS:168,
  SCORES:{A:0,B:15,C:25},
  QUESTIONS:Object.freeze({
    q1:Object.freeze({
      title:'¿Cómo está estructurado actualmente el equipo interno que ejecutará las estrategias comerciales y operativas en tu empresa?',
      options:Object.freeze({
        A:'No tenemos un equipo dedicado y buscamos delegar la ejecución táctica diaria en un tercero.',
        B:'Contamos con un equipo de ejecución interno, pero carecemos de dirección estratégica y optimización de procesos de negocio.',
        C:'Tenemos áreas de gerencia estructuradas (Marketing, Operaciones, Ventas) y buscamos profesionalizar, integrar tecnologías o automatizar flujos de trabajo a escala.'
      })
    }),
    q2:Object.freeze({
      title:'Al iniciar un proceso de consultoría de negocios, ¿con qué horizonte de tiempo planifican ver consolidados los resultados estratégicos?',
      options:Object.freeze({
        A:'Necesitamos implementar acciones comerciales o de pauta inmediatas para ver retornos en los próximos 30 días.',
        B:'Nos movemos bajo objetivos trimestrales, pero buscamos una planificación de negocio coordinada con una visión anual.',
        C:'Diseñamos planes estratégicos y de profesionalización a mediano/largo plazo (12 a 24 meses) y requerimos un socio consultor continuo.'
      })
    }),
    q3:Object.freeze({
      title:'¿Cuál es el principal desafío estratégico que tu negocio necesita resolver prioritariamente en este momento?',
      options:Object.freeze({
        A:'Generar visibilidad inmediata en redes sociales o diseñar piezas de comunicación puntuales.',
        B:'Realizar una auditoría integral del negocio, mapear nuestros procesos internos y diseñar una estrategia comercial robusta.',
        C:'Automatizar operaciones complejas, integrar herramientas de gestión (CRM/ERP), capacitar a nuestro equipo o estructurar el crecimiento por industrias.'
      })
    }),
    q4:Object.freeze({
      title:'¿Qué tipo de servicios externos de soporte al crecimiento ha contratado tu empresa anteriormente?',
      options:Object.freeze({
        A:'Solo hemos trabajado con diseñadores independientes o agencias de marketing digital tradicionales.',
        B:'Hemos trabajado con agencias, pero sentimos que nos falta una dirección de negocios profunda y un orden metodológico en los procesos.',
        C:'Hemos contratado previamente consultorías de procesos, tecnología, finanzas o desarrollo de negocios.'
      })
    })
  })
});

function saveContact_(data) {
  var clean=data||{};
  return dbInsert_(APP.SHEETS.CONTACTS,{
    full_name:firstDefined_(clean,['fullName','name','nombre','Nombre'],''),
    email:sanitizeEmail_(firstDefined_(clean,['email','correo','Email'],'')),
    phone:firstDefined_(clean,['phone','telefono','teléfono','Telefono'],''),
    company:firstDefined_(clean,['company','empresa','Empresa'],''),
    message:firstDefined_(clean,['message','mensaje','Mensaje'],''),
    source:firstDefined_(clean,['source','origen'],'web_contact'),
    page_path:firstDefined_(clean,['pagePath','url','path'],''),
    status:'new',metadata_json:jsonStringify_(clean)
  });
}

function saveGaliciaLead_(data) {
  data=data||{};
  var incomingLeadId=safeString_(data.leadId)||uuid_();
  var email=sanitizeEmail_(data.email);
  if (!email || email.indexOf('@')<1) throw new Error('Email inválido');
  if (!safeString_(data.company)) throw new Error('Empresa obligatoria');

  var existing=resolveGaliciaLead_(incomingLeadId);
  if (existing && sanitizeEmail_(existing.email) && sanitizeEmail_(existing.email)!==email) {
    throw new Error('El registro no coincide con el correo indicado');
  }

  // Como el POST público es no-cors, el navegador no puede leer un ID canónico.
  // Si el mismo email vuelve con otro leadId, conservamos una sola fila activa y
  // guardamos el nuevo ID como alias para que ese navegador pueda seguir usando
  // su identificador sin crear duplicados.
  if (!existing) existing=findCanonicalGaliciaLeadByEmail_(email);

  if (existing) {
    var canonicalId=safeString_(existing.lead_id);
    var metadata=leadMetadata_(existing);
    metadata.aliasLeadIds=uniqueStrings_((metadata.aliasLeadIds||[]).concat(
      incomingLeadId!==canonicalId?[incomingLeadId]:[]
    ));
    metadata.client=safeString_(data.client)||safeString_(metadata.client)||'landing';
    metadata.lastSource=safeString_(data.source)||safeString_(metadata.lastSource)||safeString_(existing.source);

    var patch={
      full_name:safeString_(data.fullName)||safeString_(existing.full_name),
      email:email,
      company:safeString_(data.company)||safeString_(existing.company),
      website:safeString_(data.website)?sanitizeUrl_(data.website):safeString_(existing.website),
      phone:safeString_(data.phone)||safeString_(existing.phone),
      source:safeString_(existing.source)||safeString_(data.source)||'direct',
      utm_source:safeString_(existing.utm_source)||safeString_(data.utm_source||data.utmSource),
      utm_medium:safeString_(existing.utm_medium)||safeString_(data.utm_medium||data.utmMedium),
      utm_campaign:safeString_(existing.utm_campaign)||safeString_(data.utm_campaign||data.utmCampaign),
      referrer:safeString_(existing.referrer)||safeString_(data.referrer),
      consent_marketing:safeBoolean_(existing.consent_marketing)||safeBoolean_(data.consentMarketing),
      current_step:Math.max(1,safeNumber_(existing.current_step,1)),
      last_activity_at:nowIso_(),
      metadata_json:jsonStringify_(metadata)
    };

    var savedExisting=dbUpdateById_(APP.SHEETS.LEADS,canonicalId,patch);
    if (safeString_(existing.status)==='complete') return galiciaResultFromLead_(savedExisting||existing);

    recordLeadEvent_(canonicalId,'lead_revisited',{
      source:data.source,
      pagePath:data.pagePath,
      aliasUsed:incomingLeadId!==canonicalId
    });
    audit_(email,'lead',APP.SHEETS.LEADS,canonicalId,'update',existing,savedExisting,'public_form');
    return {success:true,leadId:incomingLeadId,canonicalLeadId:canonicalId,status:'incomplete',stage:savedExisting.stage||'captured'};
  }

  var rec={
    lead_id:incomingLeadId,campaign_key:GALICIA.CAMPAIGN_KEY,source:safeString_(data.source)||'direct',status:'incomplete',stage:'captured',
    full_name:safeString_(data.fullName),email:email,company:safeString_(data.company),website:sanitizeUrl_(data.website),phone:safeString_(data.phone),
    score_total:'',knockout:false,classification:'',benefit:'pending',mailing_segment:'D',utm_source:safeString_(data.utm_source||data.utmSource),
    utm_medium:safeString_(data.utm_medium||data.utmMedium),utm_campaign:safeString_(data.utm_campaign||data.utmCampaign),referrer:safeString_(data.referrer),
    consent_marketing:safeBoolean_(data.consentMarketing),current_step:1,last_question_key:'',last_activity_at:nowIso_(),manual_review_status:'',
    meeting_status:'',meeting_clicked_at:'',metadata_json:jsonStringify_({client:data.client||'landing',lastSource:safeString_(data.source),aliasLeadIds:[]})
  };
  var saved=dbInsert_(APP.SHEETS.LEADS,rec);
  recordLeadEvent_(saved.lead_id,'lead_captured',{source:data.source,pagePath:data.pagePath,client:data.client});
  audit_(email,'lead',APP.SHEETS.LEADS,saved.lead_id,'create',null,saved,'public_form');
  return {success:true,leadId:incomingLeadId,canonicalLeadId:saved.lead_id,status:'incomplete',stage:'captured'};
}

function saveGaliciaProgress_(data) {
  data=data||{};
  var incomingLeadId=safeString_(data.leadId);
  if (!incomingLeadId) throw new Error('leadId obligatorio');
  var lead=resolveGaliciaLead_(incomingLeadId);
  if (!lead) throw new Error('Lead no encontrado');
  if (safeString_(lead.status)==='complete') return galiciaResultFromLead_(lead);

  var canonicalId=safeString_(lead.lead_id);
  var provided={};
  Object.keys(GALICIA.QUESTIONS).forEach(function(q){
    var answer=safeString_(data[q]).toUpperCase();
    if (!answer) return;
    if (!GALICIA.SCORES.hasOwnProperty(answer)) throw new Error('Respuesta inválida para '+q);
    provided[q]=answer;
    var question=GALICIA.QUESTIONS[q];
    upsertLeadAnswer_(canonicalId,q,answer,question.options[answer],GALICIA.SCORES[answer],q==='q2'&&answer==='A');
  });

  var allAnswers=getLeadAnswersMap_(canonicalId);
  var lastQuestion=normalizeQuestionKey_(data.lastQuestionKey)||highestAnsweredQuestion_(allAnswers);
  var website=safeString_(data.website)?sanitizeUrl_(data.website):safeString_(lead.website);
  var changedProgress=safeNumber_(lead.current_step,1)<2 || (lastQuestion && lastQuestion!==safeString_(lead.last_question_key));

  var saved=dbUpdateById_(APP.SHEETS.LEADS,canonicalId,{
    website:website,
    current_step:2,
    last_question_key:lastQuestion,
    last_activity_at:nowIso_()
  });

  if (changedProgress) {
    recordLeadEvent_(canonicalId,'lead_progress',{
      source:data.source,
      pagePath:data.pagePath,
      questionKey:lastQuestion,
      answeredCount:Object.keys(allAnswers).length
    });
  }
  return {
    success:true,
    leadId:incomingLeadId,
    canonicalLeadId:canonicalId,
    status:'incomplete',
    currentStep:2,
    lastQuestionKey:lastQuestion,
    answeredCount:Object.keys(allAnswers).length
  };
}

function completeGaliciaLead_(data) {
  data=data||{};
  var incomingLeadId=safeString_(data.leadId);
  if (!incomingLeadId) throw new Error('leadId obligatorio');
  var lead=resolveGaliciaLead_(incomingLeadId);
  if (!lead) throw new Error('Lead no encontrado');

  if (safeString_(lead.status)==='complete') return galiciaResultFromLead_(lead);

  var canonicalId=safeString_(lead.lead_id);
  var website=safeString_(data.website)?sanitizeUrl_(data.website):safeString_(lead.website);
  var answers={q1:safeString_(data.q1).toUpperCase(),q2:safeString_(data.q2).toUpperCase(),q3:safeString_(data.q3).toUpperCase(),q4:safeString_(data.q4).toUpperCase()};
  Object.keys(answers).forEach(function(k){ if (!GALICIA.SCORES.hasOwnProperty(answers[k])) throw new Error('Respuesta inválida para '+k); });
  var knockout=answers.q2==='A';
  var total=Object.keys(answers).reduce(function(acc,k){ return acc+GALICIA.SCORES[answers[k]]; },0);
  var classification,benefit,segment,stage;
  if (knockout) { classification='NO_CALIFICADO_KO';benefit='NO_APLICA';segment='C';stage='disqualified'; }
  else if (total>=80) { classification='CALIFICADO';benefit='PREAPROBADO';segment='A';stage='qualified'; }
  else if (total>=55) { classification='EN_EVALUACION';benefit='EN_EVALUACION';segment='B';stage='evaluation'; }
  else { classification='NO_CALIFICADO';benefit='NO_APLICA';segment='C';stage='disqualified'; }

  Object.keys(answers).forEach(function(q){
    var answerKey=answers[q];
    var question=GALICIA.QUESTIONS[q];
    upsertLeadAnswer_(canonicalId,q,answerKey,question.options[answerKey],GALICIA.SCORES[answerKey],q==='q2'&&answerKey==='A');
  });
  var saved=dbUpdateById_(APP.SHEETS.LEADS,canonicalId,{
    website:website,status:'complete',stage:stage,score_total:total,knockout:knockout,classification:classification,benefit:benefit,mailing_segment:segment,
    current_step:2,last_question_key:'q4',last_activity_at:nowIso_(),manual_review_status:classification==='EN_EVALUACION'?'pending':'',completed_at:nowIso_()
  });
  recordLeadEvent_(canonicalId,'lead_completed',{score:total,classification:classification,source:lead.source,pagePath:data.pagePath||'/regalo-galicia'});
  audit_(lead.email,'lead',APP.SHEETS.LEADS,canonicalId,'complete',lead,saved,'public_form');
  return galiciaResultFromLead_(saved);
}

function galiciaResultFromLead_(lead) {
  var campaign=dbFindOne_(APP.SHEETS.CAMPAIGNS,function(r){return r.campaign_key===GALICIA.CAMPAIGN_KEY;},{includeArchived:true})||{};
  var classification=safeString_(lead.classification);
  var score=lead.score_total===''?null:safeNumber_(lead.score_total,0);
  return {
    success:true,
    leadId:lead.lead_id,
    status:lead.status||'incomplete',
    stage:lead.stage||'',
    currentStep:safeNumber_(lead.current_step,1),
    lastQuestionKey:safeString_(lead.last_question_key),
    score:score,
    knockout:safeBoolean_(lead.knockout),
    classification:classification,
    benefit:lead.benefit||'',
    mailingSegment:lead.mailing_segment||'',
    meetingUrl:classification==='CALIFICADO'?safeString_(campaign.meeting_url):''
  };
}

function upsertLeadAnswer_(leadId,questionKey,answerKey,answerText,score,knockout) {
  var existing=dbFindOne_(APP.SHEETS.LEAD_ANSWERS,function(r){ return String(r.lead_id)===String(leadId)&&r.question_key===questionKey;},{includeArchived:true});
  var rec={lead_id:leadId,campaign_key:GALICIA.CAMPAIGN_KEY,question_key:questionKey,answer_key:answerKey,answer_text:answerText,score:score,knockout:knockout};
  if (existing) return dbUpdateById_(APP.SHEETS.LEAD_ANSWERS,existing.answer_id,rec);
  return dbInsert_(APP.SHEETS.LEAD_ANSWERS,rec);
}

function getLeadAnswersMap_(leadId) {
  var out={};
  dbReadAll_(APP.SHEETS.LEAD_ANSWERS).forEach(function(row){
    if (String(row.lead_id)!==String(leadId)) return;
    var key=normalizeQuestionKey_(row.question_key);
    var answer=safeString_(row.answer_key).toUpperCase();
    if (key && GALICIA.SCORES.hasOwnProperty(answer)) out[key]=answer;
  });
  return out;
}

function recordLeadEvent_(leadId,eventType,data) {
  var lead=resolveGaliciaLead_(leadId)||{};
  var canonicalId=safeString_(lead.lead_id)||safeString_(leadId);
  return dbInsert_(APP.SHEETS.LEAD_EVENTS,{
    lead_id:canonicalId,
    campaign_key:lead.campaign_key||GALICIA.CAMPAIGN_KEY,
    event_type:eventType,
    page_path:safeString_(data&&data.pagePath),
    source:safeString_(data&&data.source)||lead.source||'',
    metadata_json:jsonStringify_(leadEventMetadata_(eventType,data||{}))
  });
}

function leadEventMetadata_(eventType,data) {
  var meta={};
  if (safeString_(data.client)) meta.client=safeString_(data.client);
  if (data.aliasUsed!==undefined) meta.aliasUsed=safeBoolean_(data.aliasUsed);
  if (normalizeQuestionKey_(data.questionKey)) meta.questionKey=normalizeQuestionKey_(data.questionKey);
  if (data.answeredCount!==undefined) meta.answeredCount=safeNumber_(data.answeredCount,0);
  if (data.score!==undefined) meta.score=safeNumber_(data.score,0);
  if (safeString_(data.classification)) meta.classification=safeString_(data.classification);
  if (safeString_(data.templateKey)) meta.templateKey=safeString_(data.templateKey);
  if (eventType==='resume_opened') meta.resume=true;
  return meta;
}

function markGaliciaMeetingClick_(data) {
  var incomingLeadId=safeString_(data&&data.leadId);
  if (!incomingLeadId) throw new Error('leadId obligatorio');
  var lead=resolveGaliciaLead_(incomingLeadId);
  if (!lead) throw new Error('Lead no encontrado');
  var canonicalId=safeString_(lead.lead_id);
  dbUpdateById_(APP.SHEETS.LEADS,canonicalId,{meeting_status:'clicked',meeting_clicked_at:nowIso_(),last_activity_at:nowIso_()});
  recordLeadEvent_(canonicalId,'meeting_click',data||{});
  return {success:true};
}

function getLeadPublicStatus_(leadId) {
  var row=resolveGaliciaLead_(safeString_(leadId));
  if (!row) return {found:false};
  return {
    found:true,
    leadId:row.lead_id,
    status:row.status,
    stage:row.stage,
    currentStep:safeNumber_(row.current_step,1),
    lastQuestionKey:safeString_(row.last_question_key),
    score:row.score_total===''?null:safeNumber_(row.score_total,0),
    knockout:safeBoolean_(row.knockout),
    classification:row.classification||'',
    benefit:row.benefit||''
  };
}

function issueGaliciaResumeToken_(leadId,ttlHours,recordEvent) {
  var lead=resolveGaliciaLead_(safeString_(leadId));
  if (!lead) throw new Error('Lead no encontrado');
  var token=randomSecret_(32);
  var expiresAt=new Date(Date.now()+Math.max(1,safeNumber_(ttlHours,GALICIA.RESUME_TTL_HOURS))*60*60*1000).toISOString();
  dbUpdateById_(APP.SHEETS.LEADS,lead.lead_id,{
    resume_token_hash:digestHex_(token),
    resume_expires_at:expiresAt,
    last_activity_at:safeString_(lead.last_activity_at)||nowIso_()
  });
  if (recordEvent!==false) recordLeadEvent_(lead.lead_id,'resume_link_created',{});
  return {token:token,leadId:lead.lead_id,expiresAt:expiresAt};
}

function getGaliciaResumeState_(token) {
  var raw=safeString_(token);
  if (!raw) return {found:false,reason:'missing'};
  var hash=digestHex_(raw);
  var lead=dbFindOne_(APP.SHEETS.LEADS,function(row){
    var stored=safeString_(row.resume_token_hash);
    return stored && constantTimeEquals_(stored,hash);
  });
  if (!lead) return {found:false,reason:'invalid'};
  var expires=safeString_(lead.resume_expires_at);
  if (!expires || new Date(expires).getTime()<Date.now()) return {found:false,reason:'expired'};

  var answers=getLeadAnswersMap_(lead.lead_id);
  return {
    found:true,
    leadId:lead.lead_id,
    status:lead.status,
    stage:lead.stage,
    currentStep:safeNumber_(lead.current_step,1),
    lastQuestionKey:safeString_(lead.last_question_key),
    form:{
      fullName:safeString_(lead.full_name),
      email:sanitizeEmail_(lead.email),
      company:safeString_(lead.company),
      website:safeString_(lead.website)
    },
    answers:answers,
    classification:safeString_(lead.classification),
    benefit:safeString_(lead.benefit)
  };
}

function resolveGaliciaLead_(incomingLeadId) {
  var id=safeString_(incomingLeadId);
  if (!id) return null;
  var direct=dbFindById_(APP.SHEETS.LEADS,id);
  if (direct) return direct;
  return dbFindOne_(APP.SHEETS.LEADS,function(row){
    var aliases=leadMetadata_(row).aliasLeadIds||[];
    return aliases.some(function(alias){return String(alias)===id;});
  });
}

function findCanonicalGaliciaLeadByEmail_(email) {
  var normalized=sanitizeEmail_(email);
  var matches=dbReadAll_(APP.SHEETS.LEADS).filter(function(row){
    return row.campaign_key===GALICIA.CAMPAIGN_KEY && sanitizeEmail_(row.email)===normalized;
  });
  if (!matches.length) return null;
  matches.sort(function(a,b){
    var aComplete=safeString_(a.status)==='complete'?1:0;
    var bComplete=safeString_(b.status)==='complete'?1:0;
    if (aComplete!==bComplete) return bComplete-aComplete;
    return String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||''));
  });
  return matches[0];
}

function leadMetadata_(lead) {
  var meta=jsonParse_(lead&&lead.metadata_json,{});
  return meta && typeof meta==='object' && !Array.isArray(meta)?meta:{};
}

function uniqueStrings_(values) {
  var seen={},out=[];
  (values||[]).forEach(function(value){
    var clean=safeString_(value);
    if (!clean || seen[clean]) return;
    seen[clean]=true;out.push(clean);
  });
  return out;
}

function normalizeQuestionKey_(value) {
  var key=safeString_(value).toLowerCase();
  return GALICIA.QUESTIONS.hasOwnProperty(key)?key:'';
}

function highestAnsweredQuestion_(answers) {
  for (var i=4;i>=1;i--) if (answers['q'+i]) return 'q'+i;
  return '';
}
