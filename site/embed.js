(() => {
  const script = document.currentScript;
  if (!script) return;
  const key = script.dataset.lootlyWidget;
  if (!key) return;

  const SUPABASE_URL = "https://tccmnfuwambjbsbmozdl.supabase.co";
  const SUPABASE_KEY = "sb_publishable_Pk7SN0966fEeJHTmj_b4mQ_U7Vyp8kc";
  const WEB_URL = "https://shevyakovys.github.io/Lootly/#/widget/";
  const rootId = "lootly-widget-" + key;

  const fetchConfig = async () => {
    const response = await fetch(SUPABASE_URL + "/rest/v1/rpc/get_public_widget", {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ p_public_key: key })
    });
    if (!response.ok) throw new Error("Lootly widget unavailable");
    return response.json();
  };

  const mount = (data) => {
    if (document.getElementById(rootId)) return;
    const cfg = data.widget;
    const root = document.createElement("div");
    root.id = rootId;
    root.style.position = "relative";
    root.style.zIndex = "2147483000";

    const style = document.createElement("style");
    style.textContent = `
      @keyframes lootlyPulse { 0%,100% { transform:scale(1) } 50% { transform:scale(1.045) } }
      .lootly-launcher{position:fixed;z-index:2147483000;border:0;border-radius:999px;padding:14px 20px;font:600 15px/1 system-ui,-apple-system,sans-serif;color:white;box-shadow:0 12px 30px rgba(15,23,42,.2);cursor:pointer}
      .lootly-overlay{position:fixed;inset:0;z-index:2147482999;background:rgba(15,23,42,.38);backdrop-filter:blur(2px);display:flex}
      .lootly-panel{position:relative;background:white;overflow:hidden;box-shadow:0 20px 60px rgba(15,23,42,.28)}
      .lootly-panel iframe{display:block;width:100%;height:100%;border:0;background:white}
      .lootly-close{position:absolute;right:12px;top:12px;z-index:2;width:36px;height:36px;border:0;border-radius:50%;background:rgba(17,24,39,.72);color:white;font:24px/1 system-ui;cursor:pointer}
      @media(max-width:640px){.lootly-panel{width:100%!important;height:100%!important;max-width:none!important;border-radius:0!important}}
    `;
    root.appendChild(style);

    const button = document.createElement("button");
    button.className = "lootly-launcher";
    button.textContent = cfg.button_text || "Записаться";
    button.style.background = cfg.primary_color || "#111827";
    const pos = cfg.button_position || "bottom-right";
    button.style[pos.startsWith("top") ? "top" : "bottom"] = "22px";
    button.style[pos.endsWith("left") ? "left" : "right"] = "22px";
    if (cfg.button_animation) button.style.animation = "lootlyPulse 2.4s ease-in-out infinite";
    root.appendChild(button);

    let overlay = null;
    const close = () => { overlay?.remove(); overlay = null; document.documentElement.style.overflow = ""; };
    const open = () => {
      if (overlay) return;
      overlay = document.createElement("div");
      overlay.className = "lootly-overlay";
      overlay.style.justifyContent = cfg.open_mode === "modal" ? "center" : (cfg.panel_side === "left" ? "flex-start" : "flex-end");
      overlay.style.alignItems = cfg.open_mode === "modal" ? "center" : "stretch";

      const panel = document.createElement("div");
      panel.className = "lootly-panel";
      if (cfg.open_mode === "modal") {
        panel.style.width = "min(680px, calc(100vw - 40px))";
        panel.style.height = "min(780px, calc(100vh - 40px))";
        panel.style.borderRadius = "22px";
      } else {
        panel.style.width = "min(560px, 100vw)";
        panel.style.height = "100%";
      }

      const iframe = document.createElement("iframe");
      iframe.src = WEB_URL + encodeURIComponent(key);
      iframe.title = cfg.title || "Онлайн-запись";
      iframe.allow = "clipboard-write";

      const closeBtn = document.createElement("button");
      closeBtn.className = "lootly-close";
      closeBtn.type = "button";
      closeBtn.setAttribute("aria-label", "Закрыть");
      closeBtn.textContent = "×";
      closeBtn.onclick = close;

      panel.append(iframe, closeBtn);
      overlay.appendChild(panel);
      overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
      document.addEventListener("keydown", function esc(e){ if(e.key==="Escape"){close();document.removeEventListener("keydown",esc)} });
      root.appendChild(overlay);
      document.documentElement.style.overflow = "hidden";
    };

    button.addEventListener("click", open);
    document.body.appendChild(root);
  };

  const start = () => fetchConfig().then(mount).catch(err => console.error("[Lootly]", err));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once:true });
  else start();
})();