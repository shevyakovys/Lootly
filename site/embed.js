(() => {
  const script=document.currentScript;if(!script)return;
  const key=script.dataset.lootlyWidget;if(!key)return;
  const SUPABASE_URL="https://tccmnfuwambjbsbmozdl.supabase.co";
  const SUPABASE_KEY="sb_publishable_Pk7SN0966fEeJHTmj_b4mQ_U7Vyp8kc";
  const WEB_URL="https://shevyakovys.github.io/Lootly/#/widget/";
  const rootId="lootly-widget-"+key;
  if(document.getElementById(rootId))return;

  const emit=(name,detail={})=>window.dispatchEvent(new CustomEvent(name,{detail:{widgetKey:key,...detail}}));
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const fetchTimeout=async(url,options={},timeout=7000)=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
    try{return await fetch(url,{...options,signal:controller.signal})}finally{clearTimeout(timer)}
  };
  const rpc=async(name,body,{attempts=3,timeout=7000}={})=>{
    let last;
    for(let i=0;i<attempts;i++){
      try{
        const r=await fetchTimeout(SUPABASE_URL+"/rest/v1/rpc/"+name,{
          method:"POST",
          headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},
          body:JSON.stringify(body)
        },timeout);
        if(!r.ok){
          const payload=await r.json().catch(()=>({}));
          const err=new Error(payload.message||("HTTP "+r.status));
          err.status=r.status;throw err;
        }
        const text=await r.text();return text?JSON.parse(text):null;
      }catch(e){last=e;if(i<attempts-1)await sleep(300*(i+1))}
    }
    throw last||new Error("request failed");
  };
  const sessionKey=(()=>{
    const storageKey="lootly_embed_"+key;
    try{let v=sessionStorage.getItem(storageKey);if(!v){v=crypto.randomUUID?.()||String(Date.now())+Math.random();sessionStorage.setItem(storageKey,v)}return v}
    catch{return crypto.randomUUID?.()||String(Date.now())+Math.random()}
  })();

  const host=document.createElement("div");host.id=rootId;host.style.position="relative";host.style.zIndex="2147483000";
  const shadow=host.attachShadow?host.attachShadow({mode:"open"}):host;
  const style=document.createElement("style");style.textContent=`
    :host{all:initial}
    @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}@keyframes enter{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    *{box-sizing:border-box}.launcher{position:fixed;z-index:2147483000;border:0;border-radius:999px;padding:14px 20px;font:700 15px/1 system-ui,-apple-system,sans-serif;color:#fff;box-shadow:0 14px 36px rgba(15,23,42,.22);cursor:pointer;transition:.18s;white-space:nowrap}.launcher:hover{transform:translateY(-2px)}.launcher:focus-visible{outline:3px solid rgba(15,118,110,.20);outline-offset:3px}
    .overlay{position:fixed;inset:0;z-index:2147482999;background:rgba(8,30,36,.34);backdrop-filter:blur(10px);display:flex;animation:enter .18s ease}.panel{position:relative;background:rgba(248,253,252,.90);overflow:hidden;border:1px solid rgba(135,170,175,.24);box-shadow:0 26px 86px rgba(11,43,50,.24);backdrop-filter:blur(24px);animation:enter .2s ease}.panel iframe{display:block;width:100%;height:100%;border:0;background:#fff}.close{position:absolute;right:12px;top:12px;z-index:2;width:38px;height:38px;border:0;border-radius:50%;background:rgba(10,48,53,.78);color:#fff;font:24px/1 system-ui;cursor:pointer}.fallback{position:fixed;left:16px;right:16px;bottom:16px;max-width:420px;margin:auto;padding:12px 14px;border-radius:14px;background:rgba(250,254,253,.92);color:#14343c;border:1px solid rgba(127,160,166,.22);box-shadow:0 18px 50px rgba(11,43,50,.18);backdrop-filter:blur(18px);font:13px/1.4 system-ui;z-index:2147483000}.fallback a{display:inline-block;margin-top:8px;font-weight:700;color:#0f766e}
    @media(max-width:640px){.panel{width:100%!important;height:100%!important;max-width:none!important;border-radius:0!important}.launcher{max-width:calc(100vw - 32px)}}
    @media(prefers-reduced-motion:reduce){.launcher,.overlay,.panel{animation:none!important;transition:none!important}}
  `;shadow.append(style);document.body.append(host);

  const positionButton=(button,pos)=>{
    button.style.top=button.style.bottom=button.style.left=button.style.right="";
    button.style[pos.startsWith("top")?"top":"bottom"]="22px";
    button.style[pos.endsWith("left")?"left":"right"]="22px";
  };

  const mountFallback=(message)=>{
    const button=document.createElement("button");button.className="launcher";button.textContent="Онлайн-запись";button.style.background="#0f766e";positionButton(button,"bottom-right");
    button.addEventListener("click",()=>window.open(WEB_URL+encodeURIComponent(key),"_blank","noopener"));
    shadow.append(button);
    emit("lootly:error",{stage:"init",message});
  };

  const mount=(data)=>{
    const cfg=data.widget||{};
    const button=document.createElement("button");button.className="launcher";button.type="button";button.textContent=cfg.button_text||"Записаться";button.style.background=cfg.primary_color||"#111827";positionButton(button,cfg.button_position||"bottom-right");if(cfg.button_animation)button.style.animation="pulse 2.5s ease-in-out infinite";button.setAttribute("aria-haspopup","dialog");button.setAttribute("aria-expanded","false");shadow.append(button);

    let overlay=null,oldOverflow="",iframe=null,lastFocused=null;
    const close=()=>{
      if(!overlay)return;
      overlay.remove();overlay=null;button.setAttribute("aria-expanded","false");document.documentElement.style.overflow=oldOverflow;lastFocused?.focus?.();
    };
    const open=()=>{
      if(overlay)return;
      lastFocused=document.activeElement;button.setAttribute("aria-expanded","true");
      rpc("track_widget_event",{p_public_key:key,p_session_key:sessionKey,p_event_type:"open"},{attempts:1,timeout:4000}).catch(()=>{});
      overlay=document.createElement("div");overlay.className="overlay";overlay.setAttribute("role","dialog");overlay.setAttribute("aria-modal","true");overlay.style.justifyContent=cfg.open_mode==="modal"?"center":(cfg.panel_side==="left"?"flex-start":"flex-end");overlay.style.alignItems=cfg.open_mode==="modal"?"center":"stretch";
      const panel=document.createElement("div");panel.className="panel";
      if(cfg.open_mode==="modal"){panel.style.width="min(700px,calc(100vw - 36px))";panel.style.height="min(820px,calc(100vh - 36px))";panel.style.borderRadius="24px"}else{panel.style.width="min(570px,100vw)";panel.style.height="100%"}
      iframe=document.createElement("iframe");iframe.src=WEB_URL+encodeURIComponent(key);iframe.title=cfg.title||"Онлайн-запись";iframe.loading="eager";iframe.referrerPolicy="strict-origin-when-cross-origin";
      const x=document.createElement("button");x.className="close";x.type="button";x.setAttribute("aria-label","Закрыть онлайн-запись");x.textContent="×";x.onclick=close;
      panel.append(iframe,x);overlay.append(panel);overlay.addEventListener("click",e=>{if(e.target===overlay)close()});shadow.append(overlay);oldOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow="hidden";x.focus();
    };
    button.addEventListener("click",open);
    document.addEventListener("keydown",e=>{if(e.key==="Escape"&&overlay)close()});
    window.addEventListener("message",e=>{
      if(!iframe||e.source!==iframe.contentWindow||!e.data||typeof e.data!=="object")return;
      if(e.data.type==="lootly:ready")emit("lootly:ready",{});
      if(e.data.type==="lootly:booking-complete")emit("lootly:booking",{bookingId:e.data.bookingId,startAt:e.data.startAt});
      if(e.data.type==="lootly:error")emit("lootly:error",{stage:e.data.stage,message:e.data.message});
    });
    emit("lootly:ready",{});
  };

  rpc("get_public_widget",{p_public_key:key},{attempts:3,timeout:7000})
    .then(mount)
    .catch(err=>mountFallback(err?.message||"Widget unavailable"));
})();