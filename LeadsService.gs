const GALICIA = Object.freeze({
  CAMPAIGN_KEY:'galicia-2026',
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
  var leadId=safeString_(data.leadId)||uuid_();
  var email=sanitizeEmail_(data.email);
  if (!email || email.indexOf('@')<1) throw new Error('Email inválido');
  if (!safeString_(data.company)) throw new Error('Empresa obligatoria');
  var existing=dbFindById_(APP.SHEETS.LEADS,leadId,{includeArchived:true});

  // Idempotencia: un retry tardío del Paso 1 nunca debe degradar un lead ya completo.
  if (existing && safeString_(existing.status)==='complete') {
    return galiciaResultFromLead_(existing);
  }

  var rec={
    lead_id:leadId,campaign_key:GALICIA.CAMPAIGN_KEY,source:safeString_(data.source)||'direct',status:'incomplete',stage:'captured',
    full_name:safeString_(data.fullName),email:email,company:safeString_(data.company),website:sanitizeUrl_(data.website),phone:safeString_(data.phone),
    score_total:'',knockout:false,classification:'',benefit:'pending',mailing_segment:'D',utm_source:safeString_(data.utm_source||data.utmSource),
    utm_medium:safeString_(data.utm_medium||data.utmMedium),utm_campaign:safeString_(data.utm_campaign||data.utmCampaign),referrer:safeString_(data.referrer),
    consent_marketing:safeBoolean_(data.consentMarketing),metadata_json:jsonStringify_({client:data.client||'landing',userAgent:data.userAgent||''})
  };
  var saved=existing?dbUpdateById_(APP.SHEETS.LEADS,leadId,rec):dbInsert_(APP.SHEETS.LEADS,rec);
  recordLeadEvent_(leadId,'lead_captured',data);
  audit_(email,'lead',APP.SHEETS.LEADS,leadId,existing?'update':'create',existing,saved,'public_form');
  return {success:true,leadId:leadId,status:'incomplete',stage:'captured'};
}

function completeGaliciaLead_(data) {
  data=data||{};
  var leadId=safeString_(data.leadId);
  if (!leadId) throw new Error('leadId obligatorio');
  var lead=dbFindById_(APP.SHEETS.LEADS,leadId,{includeArchived:true});
  if (!lead) throw new Error('Lead no encontrado');

  // Evita duplicar respuestas/eventos cuando el navegador reintenta el POST no-cors.
  if (safeString_(lead.status)==='complete') {
    return galiciaResultFromLead_(lead);
  }

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
    upsertLeadAnswer_(leadId,q,answerKey,question.options[answerKey],GALICIA.SCORES[answerKey],q==='q2'&&answerKey==='A');
  });
  var saved=dbUpdateById_(APP.SHEETS.LEADS,leadId,{
    status:'complete',stage:stage,score_total:total,knockout:knockout,classification:classification,benefit:benefit,mailing_segment:segment,completed_at:nowIso_()
  });
  recordLeadEvent_(leadId,'lead_completed',{score:total,classification:classification,source:lead.source,pagePath:data.pagePath||'/bono'});
  audit_(lead.email,'lead',APP.SHEETS.LEADS,leadId,'complete',lead,saved,'public_form');
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
    score:score,
    knockout:safeBoolean_(lead.knockout),
    classification:classification,
    benefit:lead.benefit||'',
    mailingSegment:lead.mailing_segment||'',
    meetingUrl:classification==='CALIFICADO'?safeString_(campaign.meeting_url):''
  };
}

function upsertLeadAnswer_(leadId,questionKey,answerKey,answerText,score,knockout) {
  var existing=dbFindOne_(APP.SHEETS.LEAD_ANSWERS,function(r){ return r.lead_id===leadId&&r.question_key===questionKey;},{includeArchived:true});
  var rec={lead_id:leadId,campaign_key:GALICIA.CAMPAIGN_KEY,question_key:questionKey,answer_key:answerKey,answer_text:answerText,score:score,knockout:knockout};
  if (existing) return dbUpdateById_(APP.SHEETS.LEAD_ANSWERS,existing.answer_id,rec);
  return dbInsert_(APP.SHEETS.LEAD_ANSWERS,rec);
}

function recordLeadEvent_(leadId,eventType,data) {
  var lead=dbFindById_(APP.SHEETS.LEADS,leadId,{includeArchived:true})||{};
  return dbInsert_(APP.SHEETS.LEAD_EVENTS,{
    lead_id:leadId,campaign_key:lead.campaign_key||GALICIA.CAMPAIGN_KEY,event_type:eventType,page_path:safeString_(data&&data.pagePath),source:safeString_(data&&data.source)||lead.source||'',metadata_json:jsonStringify_(data||{})
  });
}

function markGaliciaMeetingClick_(data) {
  var leadId=safeString_(data&&data.leadId);
  if (!leadId) throw new Error('leadId obligatorio');
  recordLeadEvent_(leadId,'meeting_click',data||{});
  return {success:true};
}

function getLeadPublicStatus_(leadId) {
  var row=dbFindById_(APP.SHEETS.LEADS,leadId);
  if (!row) return {found:false};
  return {found:true,leadId:row.lead_id,status:row.status,stage:row.stage,score:row.score_total===''?null:safeNumber_(row.score_total,0),knockout:safeBoolean_(row.knockout),classification:row.classification||'',benefit:row.benefit||''};
}
