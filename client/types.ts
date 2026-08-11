export type CmsStatus = 'draft' | 'published' | 'hidden' | 'archived';

export interface CmsMedia { media_id:string; file_name:string; mime_type:string; public_url:string; alt_text?:string; }
export interface CmsContent { content_id:string; content_key:string; section:string; title?:string; subtitle?:string; body?:string; cta_label?:string; cta_url?:string; media_id?:string; sort_order?:number; featured?:boolean; status:CmsStatus; media?:CmsMedia; metadata_json?:string; }
export interface OnboardingModule { module_id:string; module_key:string; title:string; description:string; deliverable:string; value_text:string; accent_color?:string; media_id?:string; sort_order:number; status:CmsStatus; media?:CmsMedia; }
export interface CaseStudy { case_id:string; case_key:string; tag:string; stat:string; result_text:string; poster_url?:string; video_mp4_url?:string; video_webm_url?:string; media?:CmsMedia; }
export interface Testimonial { testimonial_id:string; testimonial_key:string; company:string; person_name?:string; person_role?:string; quote:string; media?:CmsMedia; }
export interface TeamMember { team_id:string; team_key:string; name:string; role:string; bio?:string; linkedin_url?:string; media?:CmsMedia; }
export interface BlogPost { post_id:string; slug:string; title:string; description?:string; content?:string; author?:string; published_at?:string; image_url?:string; external_url?:string; media?:CmsMedia; }
export interface GalleryItem { gallery_id:string; title?:string; caption?:string; external_url?:string; alt_text?:string; media?:CmsMedia; }
export interface Campaign { campaign_id:string; campaign_key:string; name:string; landing_path:string; benefit_label?:string; meeting_url?:string; starts_at?:string; ends_at?:string; status:CmsStatus; }
export interface CmsBootstrap { meta:{app:string;version:string;schemaVersion:number;generatedAt:string}; settings:Record<string,unknown>; content:Record<string,CmsContent>; onboardingModules:OnboardingModule[]; caseStudies:CaseStudy[]; testimonials:Testimonial[]; team:TeamMember[]; blog:BlogPost[]; gallery:GalleryItem[]; campaigns:Campaign[]; }
export type GaliciaAnswer = 'A'|'B'|'C';
export interface GaliciaLeadStart { leadId:string; fullName:string; email:string; company:string; website?:string; phone?:string; source?:string; utm_source?:string; utm_medium?:string; utm_campaign?:string; referrer?:string; consentMarketing?:boolean; userAgent?:string; pagePath?:string; }
export interface GaliciaLeadComplete { leadId:string; q1:GaliciaAnswer; q2:GaliciaAnswer; q3:GaliciaAnswer; q4:GaliciaAnswer; pagePath?:string; }
export interface LeadStatus { found:boolean; leadId?:string; status?:string; stage?:string; score?:number|null; knockout?:boolean; classification?:string; benefit?:string; }
