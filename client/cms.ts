import type { CmsBootstrap, GaliciaLeadStart, GaliciaLeadComplete, LeadStatus } from './types';

export class FedesCmsClient {
  constructor(private readonly endpoint:string) {}

  private jsonp<T>(params:Record<string,string>):Promise<T>{
    return new Promise((resolve,reject)=>{
      const cb=`__fedesCms_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const url=new URL(this.endpoint);
      Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
      url.searchParams.set('callback',cb);
      const script=document.createElement('script');
      const timeout=setTimeout(()=>cleanup(new Error('CMS timeout')),12000);
      const cleanup=(err?:Error)=>{clearTimeout(timeout);script.remove();delete (window as any)[cb];err?reject(err):undefined};
      (window as any)[cb]=(data:T)=>{cleanup();resolve(data)};
      script.onerror=()=>cleanup(new Error('No se pudo consultar el CMS'));
      script.src=url.toString();document.head.appendChild(script);
    });
  }

  getBootstrap(){ return this.jsonp<CmsBootstrap>({api:'bootstrap'}); }
  getLeadStatus(leadId:string){ return this.jsonp<LeadStatus>({api:'lead-status',leadId}); }

  private async postOpaque(action:string,payload:unknown){
    const url=new URL(this.endpoint);url.searchParams.set('action',action);
    await fetch(url.toString(),{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(payload),keepalive:true});
  }

  private async waitForLead(leadId:string,predicate:(x:LeadStatus)=>boolean,timeoutMs=12000){
    const started=Date.now();
    while(Date.now()-started<timeoutMs){
      const state=await this.getLeadStatus(leadId);
      if(predicate(state))return state;
      await new Promise(r=>setTimeout(r,700));
    }
    throw new Error('El servidor no confirmó el guardado del lead.');
  }

  async startGaliciaLead(input:Omit<GaliciaLeadStart,'leadId'> & {leadId?:string}){
    const leadId=input.leadId || crypto.randomUUID();
    await this.postOpaque('galiciaStart',{...input,leadId});
    await this.waitForLead(leadId,s=>s.found===true);
    return {leadId};
  }

  async completeGaliciaLead(input:GaliciaLeadComplete){
    await this.postOpaque('galiciaComplete',input);
    return this.waitForLead(input.leadId,s=>s.status==='complete');
  }

  async markMeetingClick(leadId:string){ return this.postOpaque('galiciaMeetingClick',{leadId,pagePath:location.pathname}); }
}
