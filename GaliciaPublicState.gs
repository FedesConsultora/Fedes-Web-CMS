function getGaliciaProgressState_(leadId) {
  var lead=resolveGaliciaLead_(safeString_(leadId));
  if (!lead) return {found:false};

  return {
    found:true,
    leadId:safeString_(lead.lead_id),
    status:safeString_(lead.status),
    stage:safeString_(lead.stage),
    currentStep:safeNumber_(lead.current_step,1),
    lastQuestionKey:safeString_(lead.last_question_key),
    website:safeString_(lead.website),
    answers:getLeadAnswersMap_(lead.lead_id),
    classification:safeString_(lead.classification),
    benefit:safeString_(lead.benefit)
  };
}
