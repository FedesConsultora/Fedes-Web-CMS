function seedCurrentLanding_() {
  seedSettings_();
  seedContent_();
  seedModules_();
  seedCases_();
  seedCampaigns_();
}

function seedIfMissing_(sheetName, keyField, keyValue, record) {
  var existing = dbFindOne_(sheetName, function(r){ return String(r[keyField]) === String(keyValue); }, {includeArchived:true});
  if (!existing) dbInsert_(sheetName, record);
}

function seedSettings_() {
  var rows = [
    ['site_name','Fedes Consultora','string','site','Nombre público del sitio'],
    ['locale','es-AR','string','site','Idioma'],
    ['currency','ARS','string','site','Moneda'],
    ['timezone','America/Argentina/Buenos_Aires','string','site','Zona horaria'],
    ['seo_title','Fedes Consultora','string','seo','Título SEO'],
    ['seo_description','Fedes Consultora - Agencia de comunicación y marketing.','string','seo','Descripción actual; revisar según Plan 2026/27'],
    ['meeting_url','','url','commercial','URL de sesión de diagnóstico'],
    ['feature_fedi_enabled','false','boolean','features','Fedi temporalmente desactivado'],
    ['feature_galicia_banner_enabled','true','boolean','features','Banner Banco Galicia'],
  ];
  rows.forEach(function(r){
    seedIfMissing_(APP.SHEETS.SETTINGS,'setting_key',r[0],{
      setting_key:r[0], setting_value:r[1], value_type:r[2], group_name:r[3], description:r[4], status:APP.STATUS.PUBLISHED
    });
  });
}

function seedContent_() {
  var rows = [
    {content_key:'home.hero',section:'home',title:'¿Estás buscando orden o clientes?',subtitle:'Trabajamos sobre las dos razones reales por las que un negocio no escala.',sort_order:10,status:'published'},
    {content_key:'home.solution.consultora',section:'home',title:'¿Sentís que tu negocio te atrapa?',body:'Ventas desordenadas, rentabilidad baja, dependencia de estar presente 24/7.',cta_label:'Necesito orden',cta_url:'/consultora',sort_order:20,status:'published'},
    {content_key:'home.solution.agencia',section:'home',title:'¿Sentís que el mercado te ignora?',body:'Marca desactualizada, anuncios que no convierten, competencia que avanza.',cta_label:'Necesito clientes',cta_url:'/agencia',sort_order:30,status:'published'},
    {content_key:'consultora.intro',section:'consultora',title:'Facturar no es lo mismo que ganar dinero.',subtitle:'Si tu empresa crece pero tu tranquilidad baja, el problema no es la venta: es la estructura.',body:'Te ayudamos a dejar de apagar incendios y empezar a dirigir.',cta_label:'Agendar sesión de diagnóstico',sort_order:10,status:'published'},
    {content_key:'consultora.engineering',section:'consultora',title:'No improvisamos. Hacemos ingeniería de negocios.',sort_order:40,status:'published'},
    {content_key:'agencia.intro',section:'agencia',title:'Creatividad que se mide en ventas.',subtitle:'Branding, contenido y paid media pensados para que tu marca deje de competir y empiece a liderar.',sort_order:10,status:'published'},
    {content_key:'agencia.services',section:'agencia',title:'Tu departamento de marketing externo.',sort_order:20,status:'published'},
  ];
  rows.forEach(function(r){ seedIfMissing_(APP.SHEETS.CONTENT,'content_key',r.content_key,r); });
}

function seedModules_() {
  var modules = [
    ['digital','Onboarding Digital','El punto de partida esencial para ordenar el ecosistema online. Análisis profundo de Instagram, Facebook, Google y e-commerce.','Playbook de canales: qué publicar, dónde y con qué presupuesto exacto.','Dejamos de mirar "likes" para mirar el retorno de inversión real.','#3b82f6'],
    ['identity','Onboarding Identidad','Bajo la lupa el ADN de la marca. Coherencia visual, narrativa, naming, slogans y segmentación estratégica.','Biblia de marca: documento que unifica el tono de voz y la estética visual.','Tu marca deja de ser un logo para convertirse en una narrativa que justifica tus precios.','#a855f7'],
    ['market','Onboarding Mercado','Estudio de mercado y benchmarking competitivo. Análisis de tendencias, amenazas y rentabilidad para expansión.','Matriz de oportunidades y pricing: comparativa contra la competencia para subir precios.','Seguridad estratégica basada en datos reales y tendencias validadas.','#06b6d4'],
    ['org','Onboarding Organizacional','Ordenar la casa por dentro. Procesos internos, roles, flujos de comunicación y cultura de trabajo.','Mapa de procesos y roles: define quién hace qué y cómo se mide.','Recuperar tiempo personal. La empresa deja de depender 100% de la memoria del dueño.','#10b981'],
    ['product','Onboarding Producto','Arquitectura de la oferta para maximizar el deseo de compra. Ciclo de vida, packaging y propuesta de valor.','Catálogo optimizado: priorización de productos de mayor margen.','Eficiencia comercial enfocando los recursos donde hay rentabilidad real.','#f59e0b'],
    ['commercial','Onboarding Comercial','Auditoría del motor de ventas. Embudo de conversión, CRM, desempeño de equipo y protocolos de cierre.','Protocolo de gestión de ventas: el paso a paso de cómo atender y cerrar prospectos.','Dejás de depender del talento natural para pasar a un proceso repetible.','#6366f1'],
    ['financial','Onboarding Financiero','Diagnóstico de salud económica. Costos, márgenes, flujos de caja y proyecciones sostenibles.','Hoja de ruta de rentabilidad: informe de números claros y punto de equilibrio.','Claridad total. Entender por fin por qué, aunque facturás, sentís que no te queda plata.','#ef4444'],
  ];
  modules.forEach(function(m, idx){
    seedIfMissing_(APP.SHEETS.MODULES,'module_key',m[0],{
      module_key:m[0], title:m[1], description:m[2], deliverable:m[3], value_text:m[4], accent_color:m[5], sort_order:(idx+1)*10, status:'published'
    });
  });
}

function seedCases_() {
  var cases = [
    ['mercurio-2024','Ganadores del Premio Mercurio 2024','+40%','de rentabilidad neta en 6 meses mediante optimización estructural.','src/assets/video/cases/case1.webp','src/assets/video/cases/case1.mp4','src/assets/video/cases/case1.webm'],
    ['escalamiento-estrategico','Escalamiento Estratégico','2.5x','aumento en la capacidad operativa sin incrementar costos fijos.','src/assets/video/cases/case2.webp','src/assets/video/cases/case2.mp4','src/assets/video/cases/case2.webm'],
    ['estructura-negocios','Estructura de Negocios','+65%','de eficiencia en procesos comerciales y flujo de caja.','src/assets/video/cases/case3.webp','src/assets/video/cases/case3.mp4','src/assets/video/cases/case3.webm'],
  ];
  cases.forEach(function(c, idx){
    seedIfMissing_(APP.SHEETS.CASES,'case_key',c[0],{
      case_key:c[0],tag:c[1],stat:c[2],result_text:c[3],poster_url:c[4],video_mp4_url:c[5],video_webm_url:c[6],sort_order:(idx+1)*10,status:'published',metadata_json:jsonStringify_({source:'current_repo_assets'})
    });
  });
}

function seedCampaigns_() {
  seedIfMissing_(APP.SHEETS.CAMPAIGNS,'campaign_key','galicia-2026',{
    campaign_key:'galicia-2026',
    name:'Banco Galicia 2026 — Beneficio Onboarding',
    landing_path:'/bonificacion-galicia',
    benefit_label:'50% de bonificación en el primer mes del Onboarding',
    meeting_url:'',
    sort_order:10,
    featured:true,
    status:'draft',
    metadata_json:jsonStringify_({event:'Pymes que venden más: cómo arrancar de cero con publicidad, automatización e IA',maxQualifiedSlots:10})
  });
}
