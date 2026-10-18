/** Read-only release checks. Never print config values, provider payloads or row data. */
export async function checkReleaseReadiness(env, { remote=false, allFeatures=false, fetcher=fetch }={}) {
  const checks=[];
  const add=(id,status,message)=>checks.push({id,status,message});
  const present=(key)=>Boolean(env[key]?.trim());
  const required=(key,needed=true)=>{add(key,present(key)?'pass':needed?'blocked':'off',present(key)?'Configurato (valore nascosto)':'Non configurato');};
  for(const key of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY']) required(key);
  for(const [name,client,server] of [
    ['sessions','NEXT_PUBLIC_SESSION_INVITES_ENABLED','SESSION_INVITES_ENABLED'],
    ['metrics','NEXT_PUBLIC_PRODUCT_METRICS_ENABLED','PRODUCT_METRICS_ENABLED'],
  ]) {
    const ui=env[client]==='true',api=env[server]==='true';
    add(name,ui===api?(ui?'pass':allFeatures?'blocked':'off'):'blocked',ui!==api?'Flag interfaccia/server non allineati':ui?'Abilitato':'Disattivato');
  }
  const sessions=allFeatures||env.SESSION_INVITES_ENABLED==='true';
  const newsletter=allFeatures||env.NEWSLETTER_CONSENT_ENABLED==='true';
  const metrics=allFeatures||env.PRODUCT_METRICS_ENABLED==='true';
  add('newsletter',env.NEWSLETTER_CONSENT_ENABLED==='true'?'pass':allFeatures?'blocked':'off','Raccolta newsletter '+(env.NEWSLETTER_CONSENT_ENABLED==='true'?'abilitata':'disattivata'));
  const inviteEmail=allFeatures||env.SESSION_INVITES_EMAIL_ENABLED==='true';
  add('session-email',env.SESSION_INVITES_EMAIL_ENABLED==='true'&&env.SESSION_INVITES_ENABLED!=='true'?'blocked':env.SESSION_INVITES_EMAIL_ENABLED==='true'?'pass':allFeatures?'blocked':'off','Email inviti '+(env.SESSION_INVITES_EMAIL_ENABLED==='true'?'abilitate':'disattivate'));
  required('RESEND_API_KEY',inviteEmail||newsletter);
  required('MAILERLITE_API_KEY');
  required('MAILERLITE_WEBHOOK_SECRET',newsletter);
  required('CRON_SECRET',newsletter||metrics);
  if(inviteEmail) add('session-worker-secret',present('SESSION_INVITES_CRON_SECRET')||present('CRON_SECRET')?'pass':'blocked','Serve il segreto del worker, oppure CRON_SECRET per Vercel');
  for(const key of ['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN']) required(key);
  if(env.CHRISPY_LOCAL_PREVIEW==='true') add('preview-exception','blocked','Eccezione locale attiva: non usare questa configurazione nel deploy pubblico');
  add('smtp-delivery','manual','Verificare SMTP, mittente e ricezione reale di conferma e recupero password');
  add('scheduler','manual','Verificare pianificazione remota e frequenza supportata dal piano hosting');
  add('database-policies','manual','Presenza API non certifica cronologia migrazioni, policy o collaudo con account reali');
  if(!remote) add('remote-state','manual','Stato remoto non verificato; aggiungere --remote');
  else if(!['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'].every(present)) add('remote-state','blocked','Credenziali insufficienti per i controlli remoti');
  else {
    let base;
    try { const url=new URL(env.NEXT_PUBLIC_SUPABASE_URL); if(url.protocol!=='https:'||url.username||url.password)throw new Error();base=url.origin; }
    catch { add('remote-url','blocked','Origine Supabase HTTPS non valida'); return checks; }
    const authHeaders={apikey:env.NEXT_PUBLIC_SUPABASE_ANON_KEY};
    const adminHeaders={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`};
    const read=async(path,headers,method='GET')=>fetcher(base+path,{method,headers,redirect:'error',signal:AbortSignal.timeout(8000)});
    try {
      const response=await read('/auth/v1/settings',authHeaders);
      if(!response.ok)throw new Error(); const settings=await response.json();
      add('email-confirmation',settings.mailer_autoconfirm===false?'pass':'blocked',settings.mailer_autoconfirm===false?'Conferma richiesta':settings.mailer_autoconfirm===true?'Autoconferma attiva: proprietà email non verificata':'Impostazione non disponibile');
    } catch { add('email-confirmation','blocked','Impossibile verificare le impostazioni auth'); }
    const tables=['profiles','rider_details',
      ...(sessions?['cm_session_invites','cm_session_messages','cm_session_blocks','cm_session_preferences','cm_session_reports','cm_session_email_outbox']:[]),
      ...(metrics?['cm_product_metrics_daily']:[]),
      ...(newsletter?['cm_newsletter_preferences','cm_newsletter_consent_events','cm_newsletter_confirmations']:[])];
    for(const table of tables) {
      try { const response=await read(`/rest/v1/${table}?select=*&limit=0`,adminHeaders,'HEAD'); add(table,response.ok?'pass':'blocked',`Disponibilità REST: HTTP ${response.status}`); }
      catch { add(table,'blocked','Disponibilità REST non verificabile'); }
    }
    // OpenAPI describes RPC presence. Never invoke a mutating RPC as a health check.
    const rpcs=[...(sessions?['cm_session_create_invite','cm_session_inbox','cm_session_thread','cm_session_send_message','cm_session_action','cm_session_set_preference','cm_session_unblock_user']:[]),...(metrics?['cm_increment_product_metric','cm_purge_product_metrics']:[]),...(newsletter?['cm_newsletter_choose','cm_newsletter_request','cm_newsletter_confirm','cm_newsletter_claim','cm_newsletter_finish','cm_newsletter_purge','cm_newsletter_provider_withdraw']:[])];
    if(rpcs.length) {
      try {
        const response=await read('/rest/v1/',{...adminHeaders,Accept:'application/openapi+json'});
        if(!response.ok)throw new Error(); const schema=await response.json();
        for(const rpc of rpcs)add(rpc,schema.paths?.[`/rpc/${rpc}`]?'pass':'blocked',schema.paths?.[`/rpc/${rpc}`]?'RPC esposto (esecuzione non provata)':'RPC non disponibile nel documento API');
      } catch { add('rpc-catalog','blocked','Catalogo RPC non verificabile'); }
    }
  }
  return checks;
}
