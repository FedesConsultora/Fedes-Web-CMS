function upgradeCrmCampaignV3() {
  var before = dbReadAll_(APP.SHEETS.LEADS, { includeArchived: true });

  ensureSheet_(APP.SHEETS.LEADS, SCHEMA[APP.SHEETS.LEADS]);
  ensureSheet_(APP.SHEETS.LEAD_ANSWERS, SCHEMA[APP.SHEETS.LEAD_ANSWERS]);
  ensureSheet_(APP.SHEETS.LEAD_EVENTS, SCHEMA[APP.SHEETS.LEAD_EVENTS]);
  ensureSheet_(APP.SHEETS.LEAD_MAILINGS, SCHEMA[APP.SHEETS.LEAD_MAILINGS]);
  ensureSheet_(APP.SHEETS.CAMPAIGNS, SCHEMA[APP.SHEETS.CAMPAIGNS]);

  var summary = {
    leadsSeen: 0,
    leadsUpdated: 0,
    incomplete: 0,
    complete: 0,
    reviewPending: 0,
    mailingRows: dbReadAll_(APP.SHEETS.LEAD_MAILINGS, { includeArchived: true }).length
  };

  before.forEach(function(lead) {
    if (!safeString_(lead.lead_id)) return;
    summary.leadsSeen++;

    var isComplete = safeString_(lead.status) === 'complete';
    var patch = {
      current_step: isComplete ? 2 : 1,
      last_question_key: isComplete ? 'q4' : '',
      last_activity_at: safeString_(lead.updated_at || lead.completed_at || lead.created_at),
      manual_review_status: safeString_(lead.classification) === 'EN_EVALUACION' ? 'pending' : '',
      meeting_status: safeString_(lead.meeting_status),
      meeting_clicked_at: safeString_(lead.meeting_clicked_at)
    };

    dbUpdateById_(APP.SHEETS.LEADS, lead.lead_id, patch);
    summary.leadsUpdated++;
    if (isComplete) summary.complete++; else summary.incomplete++;
    if (patch.manual_review_status === 'pending') summary.reviewPending++;
  });

  systemSet_('schema_version', String(APP.SCHEMA_VERSION));
  systemSet_('app_version', APP.VERSION);
  systemSet_('crm_campaign_v3_at', nowIso_());
  audit_('system', 'system', APP.SHEETS.LEADS, 'crm-v3', 'upgrade', null, summary, 'manual_upgrade');
  Logger.log('Upgrade CRM campaign v3: ' + JSON.stringify(summary));
  return summary;
}

function verifyCrmCampaignV3() {
  var leadsSheet = getSpreadsheet_().getSheetByName(APP.SHEETS.LEADS);
  var mailingSheet = getSpreadsheet_().getSheetByName(APP.SHEETS.LEAD_MAILINGS);
  var leadHeaders = leadsSheet ? dbHeaders_(leadsSheet) : [];
  var mailingHeaders = mailingSheet ? dbHeaders_(mailingSheet) : [];
  var leads = dbReadAll_(APP.SHEETS.LEADS, { includeArchived: true });

  var requiredLeadFields = [
    'current_step','last_question_key','last_activity_at','manual_review_status',
    'owner','next_action_at','resume_token_hash','resume_expires_at',
    'meeting_status','meeting_clicked_at'
  ];
  var requiredMailingFields = SCHEMA[APP.SHEETS.LEAD_MAILINGS] || [];

  var result = {
    schemaVersion: APP.SCHEMA_VERSION,
    appVersion: APP.VERSION,
    leadRows: leads.length,
    leadColumnsOk: requiredLeadFields.every(function(field) { return leadHeaders.indexOf(field) >= 0; }),
    missingLeadColumns: requiredLeadFields.filter(function(field) { return leadHeaders.indexOf(field) < 0; }),
    mailingSheetExists: !!mailingSheet,
    mailingColumnsOk: requiredMailingFields.every(function(field) { return mailingHeaders.indexOf(field) >= 0; }),
    missingMailingColumns: requiredMailingFields.filter(function(field) { return mailingHeaders.indexOf(field) < 0; }),
    incompleteWithStep1: leads.filter(function(lead) {
      return safeString_(lead.status) === 'incomplete' && safeNumber_(lead.current_step, 0) === 1;
    }).length,
    completeWithStep2: leads.filter(function(lead) {
      return safeString_(lead.status) === 'complete' && safeNumber_(lead.current_step, 0) >= 2;
    }).length
  };

  Logger.log('Verify CRM campaign v3: ' + JSON.stringify(result));
  return result;
}
