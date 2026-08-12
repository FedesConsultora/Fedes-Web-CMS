function saveGaliciaProgressSafe_(data) {
  var result=saveGaliciaProgress_(data||{});
  var lead=resolveGaliciaLead_(safeString_(data&&data.leadId));
  if (!lead || safeString_(lead.status)==='complete') return result;

  var highest=highestAnsweredQuestion_(getLeadAnswersMap_(lead.lead_id));
  if (highest && highest!==safeString_(lead.last_question_key)) {
    dbUpdateById_(APP.SHEETS.LEADS,lead.lead_id,{
      current_step:2,
      last_question_key:highest,
      last_activity_at:nowIso_()
    });
  }

  if (result && highest) result.lastQuestionKey=highest;
  return result;
}
