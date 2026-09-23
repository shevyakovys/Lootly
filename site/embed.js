(() => {
  const script=document.currentScript;if(!script)return;
  const key=script.dataset.lootlyWidget;if(!key)return;
  const SUPABASE_URL="https://tccmnfuwambjbsbmozdl.supabase.co";
  const SUPABASE_KEY="sb_publishable_Pk7SN0966fEeJHTmj_b4mQ_U7Vyp8kc";
  const WEB_URL="https://shevyakovys.github.io/Lootly/#/widget/";
  const rootId="lootly-widget-"+key;
  const rpc=async(name,body)=>{const r=await fetch(SUPABASE_URL+"/rest/v1/rpc/"+name,{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify(body)});if(!r.ok)throw new Error("Lootly widget unavailable");return r.json()};
  const start=async()=>{
    if(document.getElementById(rootId))return;
    const data=await rpc("get_public_widget",{p_public_key:key}),cfg=data.widget;
    const storageKey="lootly_embed_"+key;let sessionKey=sessionStorage.getItem(storageKey);if(!sessionKey){sessionKey=(crypto.randomUUID?.()||String(Date.now())+Math.random());sessionStorage.setItem(storageKey,sessionKey)}
    const root=document.createElement("div");root.id=rootId;root.style.position="relative";root.style.zIndex="2147483000";
    const style=document.createElement("style");style.textContent=`
    @keyframes lootlyPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}@keyframes lootlyIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    .lootly-launcher{position:fixed;z-index:2147483000;border:0;border-radius:999px;padding:14px 20px;font:700 15px/1 system-ui,-apple-system,sans-serif;color:white;box-shadow:0 14px 36px rgba(15,23,42,.22);cursor:pointer;transition:.18s}.lootly-launcher:hover{transform:translateY(-2px)}
    .lootly-overlay{position:fixed;inset:0;z-index:2147482999;background:rgba(15,23,42,.42);backdrop-filter:blur(3px);display:flex;animation:lootlyIn .18s ease}.lootly-panel{position:relative;background:white;overflow:hidden;box-shadow:0 24px 80px rgba(15,23,42,.28);animation:lootlyIn .2s ease}.lootly-panel iframe{display:block;width:100%;height:100%;border:0;background:white}.lootly-close{position:absolute;right:12px;top:12px;z-index:2;width:38px;height:38px;border:0;border-radius:50%;background:rgba(15,23,42,.75);color:white;font:24px/1 system-ui;cursor:pointer}@media(max-width:640px){.lootly-panel{width:100%!important;height:100%!important;max-width:none!important;border-radius:0!important}}
    `;root.append(style);
    const button=document.createElement("button");button.className="lootly-launcher";button.textContent=cfg.button_text||"Записаться";button.style.background=cfg.primary_color||"#111827";const pos=cfg.button_position||"bottom-right";button.style[pos.startsWith("top")?"top":"bottom"]="22px";button.style[pos.endsWith("left")?"left":"right"]="22px";if(cfg.button_animation)button.style.animation="lootlyPulse 2.5s ease-in-out infinite";root.append(button);
    let overlay=null,oldOverflow="";const close=()=>{overlay?.remove();overlay=null;document.documentElement.style.overflow=oldOverflow};
    const open=async()=>{if(overlay)return;rpc("track_widget_event",{p_public_key:key,p_session_key:sessionKey,p_event_type:"open"}).catch(()=>{});overlay=document.createElement("div");overlay.className="lootly-overlay";overlay.style.justifyContent=cfg.open_mode==="modal"?"center":(cfg.panel_side==="left"?"flex-start":"flex-end");overlay.style.alignItems=cfg.open_mode==="modal"?"center":"stretch";const panel=document.createElement("div");panel.className="lootly-panel";if(cfg.open_mode==="modal"){panel.style.width="min(700px,calc(100vw - 36px))";panel.style.height="min(820px,calc(100vh - 36px))";panel.style.borderRadius="24px"}else{panel.style.width="min(570px,100vw)";panel.style.height="100%"}const iframe=document.createElement("iframe");iframe.src=WEB_URL+encodeURIComponent(key);iframe.title=cfg.title||"Онлайн-запись";const x=document.createElement("button");x.className="lootly-close";x.type="button";x.ariaLabel="Закрыть";x.textContent="×";x.onclick=close;panel.append(iframe,x);overlay.append(panel);overlay.addEventListener("click",e=>{if(e.target===overlay)close()});root.append(overlay);oldOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow="hidden"};
    button.addEventListener("click",open);document.body.append(root);
  };
  const run=()=>start().catch(e=>console.error("[Lootly]",e));if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run,{once:true});else run();
})();