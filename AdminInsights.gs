function adminGetInsights(token) {
  requireAdminSession_(token);

  var analytics = dbReadAll_(APP.SHEETS.ANALYTICS, {includeArchived:true});
  var leads = dbReadAll_(APP.SHEETS.LEADS);
  var contacts = dbReadAll_(APP.SHEETS.CONTACTS);
  var onboarding = dbReadAll_(APP.SHEETS.ONBOARDING);
  var mailings = dbReadAll_(APP.SHEETS.LEAD_MAILINGS);
  var blog = dbReadAll_(APP.SHEETS.BLOG);
  var content = dbReadAll_(APP.SHEETS.CONTENT);
  var media = dbReadAll_(APP.SHEETS.MEDIA);
  var cases = dbReadAll_(APP.SHEETS.CASES);
  var team = dbReadAll_(APP.SHEETS.TEAM);
  var testimonials = dbReadAll_(APP.SHEETS.TESTIMONIALS);

  var cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  var analytics30 = analytics.filter(function(r) {
    var t = Date.parse(r.created_at || '');
    return isFinite(t) && t >= cutoff;
  });

  return {
    success:true,
    analytics:{
      total:analytics.length,
      last30:analytics30.length,
      topPages:adminCountTop_(analytics30,'page_path',8),
      topSources:adminCountTop_(analytics30,'source',8),
      categories:adminCountTop_(analytics30,'category',8)
    },
    crm:{
      contactSources:adminCountTop_(contacts,'source',8),
      leadStages:adminCountTop_(leads,'stage',8),
      leadClassifications:adminCountTop_(leads,'classification',8),
      meetingStatuses:adminCountTop_(leads,'meeting_status',8)
    },
    cms:{
      blog:adminCollectionHealth_(blog),
      content:adminCollectionHealth_(content),
      media:adminCollectionHealth_(media),
      cases:adminCollectionHealth_(cases),
      team:adminCollectionHealth_(team),
      testimonials:adminCollectionHealth_(testimonials)
    },
    quality:{
      leadsMissingEmail:leads.filter(function(r){return !safeString_(r.email);}).length,
      leadsMissingCompany:leads.filter(function(r){return !safeString_(r.company);}).length,
      leadsMissingSource:leads.filter(function(r){return !safeString_(r.source);}).length,
      onboardingMissingEmail:onboarding.filter(function(r){return !safeString_(r.email);}).length,
      onboardingMissingCompany:onboarding.filter(function(r){return !safeString_(r.company_name);}).length,
      blogMissingContent:blog.filter(function(r){return !safeString_(r.content);}).length,
      mediaMissingAlt:media.filter(function(r){return !safeString_(r.alt_text);}).length,
      failedMailings:mailings.filter(function(r){return safeString_(r.status)==='failed';}).length
    }
  };
}

function adminCountTop_(rows, field, limit) {
  var counts = {};
  (rows || []).forEach(function(r) {
    var value = safeString_(r[field]) || 'Sin dato';
    counts[value] = (counts[value] || 0) + 1;
  });
  return Object.keys(counts).map(function(key){return {key:key,count:counts[key]};})
    .sort(function(a,b){return b.count-a.count;}).slice(0,limit||8);
}

function adminCollectionHealth_(rows) {
  rows = rows || [];
  return {
    total:rows.length,
    published:rows.filter(function(r){return safeString_(r.status)==='published';}).length,
    draft:rows.filter(function(r){return safeString_(r.status)==='draft';}).length,
    hidden:rows.filter(function(r){return safeString_(r.status)==='hidden';}).length
  };
}
