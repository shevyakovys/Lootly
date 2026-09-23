import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL="https://tccmnfuwambjbsbmozdl.supabase.co";
const SUPABASE_KEY="sb_publishable_Pk7SN0966fEeJHTmj_b4mQ_U7Vyp8kc";
const sb=createClient(SUPABASE_URL,SUPABASE_KEY);
const app=document.querySelector("#app");
const toastRoot=document.querySelector("#toast-root");
let currentProfile=null,currentOrg=null;

const esc=(v="")=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>new Intl.NumberFormat("ru-RU",{style:"currency",currency:"RUB",maximumFractionDigits:0}).format(Number(v||0));
const durationLabel=v=>{const m=Math.max(0,Number(v||0)),h=Math.floor(m/60),r=m%60;return h?(h+" ч"+(r?" "+r+" мин":"")):(r+" мин")};
const dt=v=>v?new Date(v).toLocaleString("ru-RU",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"";
const day=v=>v?new Date(v).toLocaleDateString("ru-RU",{weekday:"short",day:"numeric",month:"short"}):"";
const initials=v=>String(v||"?").trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()).join("");
const localIsoDate=d=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
const todayIso=()=>localIsoDate(new Date());
const addDaysIso=(iso,days)=>{const d=new Date(iso+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+Number(days||0));return d.toISOString().slice(0,10)};
const weekStartIso=iso=>{const d=new Date(iso+"T12:00:00Z"),offset=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-offset);return d.toISOString().slice(0,10)};
const localDateParts=(value,tz)=>{
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:tz||"UTC",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(value));
  const get=type=>parts.find(x=>x.type===type)?.value;
  return{date:get("year")+"-"+get("month")+"-"+get("day"),hour:Number(get("hour")||0),minute:Number(get("minute")||0)};
};
const dtZone=(value,tz)=>value?new Intl.DateTimeFormat("ru-RU",{timeZone:tz||undefined,day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)):"";
const dayZone=(value,tz)=>value?new Intl.DateTimeFormat("ru-RU",{timeZone:tz||undefined,weekday:"short",day:"numeric",month:"short"}).format(new Date(value)):"";
const icon=n=>({dashboard:"⌂",catalog:"▦",schedule:"◫",widgets:"◇",settings:"⚙",plus:"+",calendar:"▣",client:"◎",service:"✦",staff:"♙"}[n]||"•");
const slugify=(value="")=>{const m={а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"c",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya"};return String(value).trim().toLowerCase().split("").map(c=>m[c]??c).join("").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,100)};

function toast(text,type="success"){const el=document.createElement("div");el.className="toast "+type;el.textContent=text;toastRoot.append(el);setTimeout(()=>el.remove(),3200)}
function friendlyError(error){
  const raw=String(error?.message||error||"").toLowerCase();
  if(raw.includes("rate limit"))return "Слишком много запросов. Подождите минуту и попробуйте снова.";
  if(raw.includes("no longer available")||raw.includes("exclusion"))return "Это время только что заняли. Мы обновили свободные слоты.";
  if(raw.includes("outside working hours"))return "Это время уже недоступно. Выберите другое.";
  if(raw.includes("booking notice requirement"))return "До этого времени уже нельзя записаться. Выберите более поздний слот.";
  if(raw.includes("booking outside horizon"))return "Эта дата находится за пределами доступного периода записи.";
  if(raw.includes("widget not found")||raw.includes("waitlist unavailable"))return "Эта форма записи сейчас недоступна.";
  if(raw.includes("failed to fetch")||raw.includes("network")||raw.includes("timeout"))return "Не удалось связаться с сервисом. Проверьте интернет и повторите попытку.";
  return error?.message||"Не удалось выполнить действие. Попробуйте ещё раз.";
}
async function rpcRetry(name,args,{attempts=2,timeout=9000}={}){
  let last=null;
  for(let i=0;i<attempts;i++){
    try{
      const timeoutPromise=new Promise((_,reject)=>setTimeout(()=>reject(new Error("request timeout")),timeout));
      const result=await Promise.race([sb.rpc(name,args),timeoutPromise]);
      if(result.error)throw result.error;
      return result.data;
    }catch(e){
      last=e;
      if(i<attempts-1)await new Promise(r=>setTimeout(r,350*(i+1)));
    }
  }
  throw last||new Error("request failed");
}
function statusLabel(s){return {booked:"Новая",confirmed:"Подтверждена",completed:"Завершена",canceled:"Отменена",no_show:"Не пришёл"}[s]||s}
function emptyState(title,text,action=""){return '<div class="empty"><div class="empty-icon">✦</div><h3>'+esc(title)+'</h3><p>'+esc(text)+'</p>'+action+'</div>'}
async function session(){return (await sb.auth.getSession()).data.session}
async function profile(){if(currentProfile)return currentProfile;const s=await session();if(!s)return null;const {data,error}=await sb.from("profiles").select("*").eq("id",s.user.id).single();if(error)throw error;currentProfile=data;return data}
async function org(){if(currentOrg)return currentOrg;const p=await profile();if(!p)return null;const {data,error}=await sb.from("organizations").select("*").eq("id",p.organization_id).single();if(error)throw error;currentOrg=data;return data}
async function requireAuth(){const s=await session();if(!s){location.hash="#/login";return null}return s}
function navLink(route,label,ic,active){return '<a class="nav-item '+(active===route?"active":"")+'" href="#/'+route+'"><span class="nav-icon">'+icon(ic)+'</span>'+label+'</a>'}
async function shell(route,title,content){
  const p=await profile(),o=await org(),s=await session();
  app.innerHTML='<div class="app-shell"><aside class="sidebar"><a class="logo" href="#/dashboard"><span class="brand-mark">L</span>Lootly</a><nav class="sidebar-nav">'+
    navLink("dashboard","Журнал","dashboard",route)+navLink("calendar","Календарь","calendar",route)+navLink("catalog","Справочники","catalog",route)+navLink("schedule","Расписание","schedule",route)+navLink("widgets","Виджеты","widgets",route)+navLink("settings","Настройки","settings",route)+
    '</nav><div class="sidebar-foot"><div class="profile-mini"><strong>'+esc(o?.name||s?.user?.email)+'</strong><span>'+esc(p?.role||"")+'</span></div><button id="logout" class="btn ghost sm" style="width:100%;margin-top:7px;color:#94a3b8">Выйти</button></div></aside>'+
    '<div class="main"><div class="mobile-top"><a class="logo" href="#/dashboard"><span class="brand-mark">L</span>Lootly</a><span class="muted tiny">'+esc(o?.name||"")+'</span></div><header class="topbar"><div class="breadcrumb">Lootly / '+esc(title)+'</div><div class="top-actions"><a class="btn secondary sm" target="_blank" href="#/book/'+esc(o?.slug||"")+'">Открыть онлайн-запись ↗</a></div></header><main class="page">'+content+'</main>'+
    '<nav class="mobile-nav"><a class="'+(route==="dashboard"?"active":"")+'" href="#/dashboard"><b>⌂</b>Журнал</a><a class="'+(route==="calendar"?"active":"")+'" href="#/calendar"><b>▣</b>Календарь</a><a class="'+(route==="catalog"?"active":"")+'" href="#/catalog"><b>▦</b>Данные</a><a class="'+(route==="widgets"?"active":"")+'" href="#/widgets"><b>◇</b>Виджеты</a><a class="'+(route==="settings"?"active":"")+'" href="#/settings"><b>⚙</b>Ещё</a></nav></div></div>';
  document.querySelector("#logout")?.addEventListener("click",async()=>{await sb.auth.signOut();currentProfile=currentOrg=null;location.hash="#/login"});
}
function authLayout(inner){app.innerHTML='<div class="auth-wrap"><section class="auth-art"><div class="auth-art-inner"><a class="logo" href="#/"><span class="brand-mark">L</span>Lootly</a><h1>Запись, которая работает сама.</h1><p>Расписание, клиенты, команда и онлайн-запись — в одном аккуратном рабочем пространстве.</p></div></section><section class="auth-panel">'+inner+'</section></div>'}

function landing(){
  authLayout('<div class="auth-card"><a class="logo" href="#/"><span class="brand-mark">L</span>Lootly</a><h1>Добро пожаловать</h1><p class="muted">Запустите онлайн-запись для вашего бизнеса за несколько минут.</p><div class="stack" style="margin-top:22px"><a class="btn brand" href="#/setup">Создать организацию</a><a class="btn secondary" href="#/login">У меня уже есть аккаунт</a></div></div>');
}
function setup(){
  authLayout('<div class="auth-card"><a class="logo" href="#/"><span class="brand-mark">L</span>Lootly</a><h1>Создать рабочее пространство</h1><p class="muted">Сначала — базовые данные. Остальное настроим внутри.</p><form id="setupForm" class="stack" style="margin-top:22px"><label class="field"><span>Название бизнеса</span><input name="organization_name" placeholder="Студия Aura" required></label><label class="field"><span>Адрес онлайн-записи</span><input name="organization_slug" placeholder="aura-studio" pattern="[a-z0-9-]{2,100}" required><small>Например: lootly.ru/aura-studio. Кириллицу преобразуем автоматически.</small></label><label class="field"><span>Email владельца</span><input name="email" type="email" autocomplete="email" required></label><label class="field"><span>Пароль</span><input name="password" type="password" minlength="10" autocomplete="new-password" required><small>Не менее 10 символов.</small></label><button class="btn brand">Создать Lootly</button><div id="setupMsg"></div></form><p class="tiny muted" style="margin-top:18px">Уже есть аккаунт? <a href="#/login"><b>Войти</b></a></p></div>');
  const f=document.querySelector("#setupForm"),slug=f.elements.organization_slug,name=f.elements.organization_name;let slugTouched=false;
  slug.addEventListener("input",()=>{slugTouched=true;slug.value=slugify(slug.value)});
  name.addEventListener("input",()=>{if(!slugTouched)slug.value=slugify(name.value)});
  f.addEventListener("submit",async e=>{e.preventDefault();const fd=new FormData(f),out=document.querySelector("#setupMsg");out.innerHTML="";let sl=slugify(fd.get("organization_slug"))||slugify(fd.get("organization_name"));if(sl.length<2)sl="org-"+crypto.randomUUID().slice(0,8);const {data,error}=await sb.auth.signUp({email:String(fd.get("email")).trim(),password:String(fd.get("password")),options:{data:{organization_name:String(fd.get("organization_name")).trim(),organization_slug:sl}}});if(error){out.innerHTML='<div class="notice error">'+esc(error.message)+'</div>';return}if(data.session){currentProfile=currentOrg=null;location.hash="#/dashboard"}else out.innerHTML='<div class="notice success">Аккаунт создан. Проверьте email, если Supabase запросит подтверждение.</div>'});
}
function login(){
  authLayout('<div class="auth-card"><a class="logo" href="#/"><span class="brand-mark">L</span>Lootly</a><h1>С возвращением</h1><p class="muted">Войдите в рабочее пространство.</p><form id="loginForm" class="stack" style="margin-top:22px"><label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" required></label><label class="field"><span>Пароль</span><input name="password" type="password" autocomplete="current-password" required></label><button class="btn brand">Войти</button><div id="loginMsg"></div></form><p class="tiny muted" style="margin-top:18px">Нет аккаунта? <a href="#/setup"><b>Создать</b></a></p></div>');
  document.querySelector("#loginForm").addEventListener("submit",async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),out=document.querySelector("#loginMsg");const {error}=await sb.auth.signInWithPassword({email:String(fd.get("email")),password:String(fd.get("password"))});if(error){out.innerHTML='<div class="notice error">'+esc(error.message)+'</div>';return}currentProfile=currentOrg=null;location.hash="#/dashboard"});
}
function join(token){
  authLayout('<div class="auth-card"><a class="logo" href="#/"><span class="brand-mark">L</span>Lootly</a><h1>Присоединиться к команде</h1><p class="muted">Создайте аккаунт по приглашению.</p><form id="joinForm" class="stack" style="margin-top:22px"><label class="field"><span>Email</span><input name="email" type="email" required></label><label class="field"><span>Пароль</span><input name="password" type="password" minlength="10" required></label><button class="btn brand">Присоединиться</button><div id="joinMsg"></div></form></div>');
  document.querySelector("#joinForm").addEventListener("submit",async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),out=document.querySelector("#joinMsg");const {data,error}=await sb.auth.signUp({email:String(fd.get("email")),password:String(fd.get("password")),options:{data:{invite_token:token}}});if(error){out.innerHTML='<div class="notice error">'+esc(error.message)+'</div>';return}if(data.session){currentProfile=currentOrg=null;location.hash="#/dashboard"}else out.innerHTML='<div class="notice success">Аккаунт создан. Подтвердите email при необходимости.</div>'});
}

async function dashboard(){
  if(!await requireAuth())return;
  const p=await profile(),o=await org();
  const lookback=new Date(Date.now()-36*60*60*1000);
  const [aRes,apptRes,locRes,svcRes,staffRes,hoursRes,widgetRes,waitRes]=await Promise.all([
    sb.rpc("get_admin_analytics"),
    sb.from("appointments").select("*,customers(name,phone),services(name),staff_members(name),locations(name,timezone)").gte("start_at",lookback.toISOString()).order("start_at",{ascending:true}).limit(250),
    sb.from("locations").select("id,timezone",{count:"exact"}).eq("active",true).order("created_at"),
    sb.from("services").select("id",{count:"exact"}).eq("active",true),
    sb.from("staff_members").select("id",{count:"exact"}).eq("active",true),
    sb.from("working_hours").select("id",{count:"exact"}).limit(1),
    sb.from("booking_widgets").select("id",{count:"exact"}).eq("active",true),
    sb.from("waitlist_entries").select("*,services(name),staff_members(name),locations(name)").eq("status","waiting").order("desired_date",{ascending:true}).limit(30)
  ]);
  if(aRes.error||apptRes.error){await shell("dashboard","Журнал",'<div class="notice error">'+esc((aRes.error||apptRes.error).message)+'</div>');return}
  const metrics=aRes.data||{},all=apptRes.data||[],now=new Date(),defaultTz=locRes.data?.[0]?.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone;
  const currentDateFor=tz=>localDateParts(now,tz||defaultTz).date;
  const today=all.filter(x=>{const tz=x.locations?.timezone||defaultTz;return localDateParts(x.start_at,tz).date===currentDateFor(tz)});
  const upcoming=all.filter(x=>new Date(x.start_at)>=now).slice(0,30),waitlist=waitRes.data||[];
  const checklist=[
    [locRes.count>0,"Добавьте филиал","#/catalog"],
    [svcRes.count>0,"Создайте услуги","#/catalog"],
    [staffRes.count>0,"Добавьте сотрудников","#/catalog"],
    [hoursRes.count>0,"Настройте расписание","#/schedule"],
    [widgetRes.count>0,"Создайте виджет","#/widgets"]
  ],done=checklist.filter(x=>x[0]).length;
  const onboarding=done<checklist.length?'<section class="card onboarding"><div class="spread"><div><h2>Настройка '+done+'/'+checklist.length+'</h2><p>Ещё немного — и клиенты смогут записываться сами.</p></div><span style="font-size:34px;font-weight:850">'+Math.round(done/checklist.length*100)+'%</span></div><div class="checklist">'+checklist.map(x=>'<a href="'+x[2]+'" class="checkitem '+(x[0]?"done":"")+'"><span class="checkdot">'+(x[0]?"✓":"•")+'</span><span>'+esc(x[1])+'</span></a>').join("")+'</div></section>':"";
  const rows=upcoming.map(x=>appointmentRow(x)).join("");
  const content='<div class="page-head"><div><h1>Добрый день 👋</h1><p>'+esc(o.name)+' · '+new Intl.DateTimeFormat("ru-RU",{timeZone:defaultTz,weekday:"long",day:"numeric",month:"long"}).format(now)+'</p></div><div class="cluster"><a class="btn secondary" href="#/widgets">Поделиться записью</a><button class="btn brand" id="focusNewBooking">+ Новая запись</button></div></div>'+
  onboarding+'<section class="grid grid-4" style="margin-top:16px"><div class="metric-card"><div class="metric-label">Сегодня</div><div class="metric-value">'+today.length+'</div><div class="metric-delta">записей в журнале</div></div><div class="metric-card"><div class="metric-label">Онлайн-записи</div><div class="metric-value">'+(metrics.public_bookings||0)+'</div><div class="muted tiny">за период</div></div><div class="metric-card"><div class="metric-label">Отмены</div><div class="metric-value">'+Math.round(Number(metrics.cancellation_rate||0)*100)+'%</div><div class="muted tiny">доля отмен</div></div><div class="metric-card"><div class="metric-label">Повторные</div><div class="metric-value">'+Math.round(Number(metrics.repeat_customer_rate||0)*100)+'%</div><div class="muted tiny">клиентов вернулись</div></div></section>'+
  '<section class="quick" style="margin-top:16px"><a href="#/calendar"><span>Календарь</span><b>Открыть неделю</b></a><a href="#/schedule"><span>Расписание</span><b>Изменить график</b></a><a href="#/widgets"><span>Онлайн-запись</span><b>Настроить виджет</b></a><a href="#/settings"><span>Публикация</span><b>Скопировать ссылку</b></a></section>'+
  (waitlist.length?'<section class="card" style="margin-top:18px"><div class="card-title"><div><h2>Лист ожидания</h2><p class="muted tiny">Клиенты, которые не нашли подходящее время</p></div><span class="status booked">'+waitlist.length+' ожидают</span></div><div id="waitlistRows">'+waitlist.map(x=>'<div class="spread" style="padding:12px 0;border-bottom:1px solid var(--line)"><div><b>'+esc(x.customer_name)+'</b><div class="muted tiny">'+esc(x.customer_phone)+' · '+esc(x.services?.name||"")+' · '+new Date(x.desired_date+"T12:00:00").toLocaleDateString("ru-RU")+'</div></div><div class="cluster"><button class="btn secondary sm" data-wait="'+x.id+'" data-wait-status="contacted">Связались</button><button class="btn ghost sm" data-wait="'+x.id+'" data-wait-status="canceled">Снять</button></div></div>').join("")+'</div></section>':"")+
  (["owner","admin"].includes(p.role)?'<section id="newBooking" style="margin-top:18px"></section>':"")+
  '<section class="card flush" style="margin-top:18px"><div class="card-title" style="padding:18px 18px 0"><div><h2>Ближайшие записи</h2><p class="muted tiny">Показываем будущие визиты</p></div><div class="cluster"><div class="search"><input id="apptSearch" placeholder="Клиент, услуга, сотрудник"></div><select id="apptStatus" style="width:auto"><option value="">Все статусы</option><option value="booked">Новые</option><option value="confirmed">Подтверждённые</option><option value="completed">Завершённые</option><option value="canceled">Отменённые</option></select></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Время</th><th>Клиент</th><th>Услуга</th><th>Сотрудник</th><th>Статус</th><th></th></tr></thead><tbody id="apptRows">'+(rows||'<tr><td colspan="6">'+emptyState("Пока нет записей","Создайте первую запись или опубликуйте онлайн-виджет.")+'</td></tr>')+'</tbody></table></div></section>';
  await shell("dashboard","Журнал",content);
  bindAppointmentActions();
  const renderFilter=()=>{const q=(document.querySelector("#apptSearch")?.value||"").toLowerCase(),st=document.querySelector("#apptStatus")?.value||"";const filtered=upcoming.filter(x=>{const hay=[x.customers?.name,x.customers?.phone,x.services?.name,x.staff_members?.name].join(" ").toLowerCase();return(!q||hay.includes(q))&&(!st||x.status===st)});document.querySelector("#apptRows").innerHTML=filtered.length?filtered.map(appointmentRow).join(""):'<tr><td colspan="6">'+emptyState("Ничего не найдено","Измените поиск или фильтр.")+'</td></tr>';bindAppointmentActions()};
  document.querySelector("#apptSearch")?.addEventListener("input",renderFilter);document.querySelector("#apptStatus")?.addEventListener("change",renderFilter);
  document.querySelectorAll("[data-wait]").forEach(b=>b.addEventListener("click",async()=>{const {error}=await sb.from("waitlist_entries").update({status:b.dataset.waitStatus,updated_at:new Date().toISOString()}).eq("id",b.dataset.wait);if(error)toast(error.message,"error");else{toast("Лист ожидания обновлён");dashboard()}}));
  if(["owner","admin"].includes(p.role)){await renderQuickBooking();document.querySelector("#focusNewBooking")?.addEventListener("click",()=>document.querySelector("#newBooking")?.scrollIntoView({behavior:"smooth"}))}
}
function appointmentRow(x){return '<tr><td><b>'+dtZone(x.start_at,x.locations?.timezone)+'</b><div class="muted tiny">'+esc(x.locations?.name||"")+'</div></td><td><div class="person"><span class="avatar">'+initials(x.customers?.name)+'</span><div><a href="#/client/'+x.customer_id+'"><b>'+esc(x.customers?.name||"Клиент")+'</b></a><small>'+esc(x.customers?.phone||"")+'</small></div></div></td><td>'+esc(x.services?.name||"—")+'<div class="muted tiny">'+durationLabel(x.duration_minutes)+'</div></td><td>'+esc(x.staff_members?.name||"—")+'</td><td><span class="status '+esc(x.status)+'">'+esc(statusLabel(x.status))+'</span></td><td><div class="cluster">'+(["booked","confirmed"].includes(x.status)?'<button class="btn secondary sm" data-status="'+x.id+'" data-to="confirmed">✓</button><button class="btn secondary sm" data-status="'+x.id+'" data-to="completed">Готово</button><button class="btn danger sm" data-status="'+x.id+'" data-to="canceled">Отмена</button>':"")+'</div></td></tr>'}
function bindAppointmentActions(){document.querySelectorAll("[data-status]").forEach(b=>b.addEventListener("click",async()=>{const {error}=await sb.rpc("set_appointment_status",{p_appointment_id:b.dataset.status,p_status:b.dataset.to});if(error)toast(error.message,"error");else{toast("Статус обновлён");dashboard()}}))}
async function renderQuickBooking(){
  const root=document.querySelector("#newBooking");if(!root)return;
  const [l,s,custRes]=await Promise.all([
    sb.from("locations").select("*").eq("active",true).order("name"),
    sb.from("services").select("*").eq("active",true).order("name"),
    sb.from("customers").select("*").order("name")
  ]);
  const loadError=l.error||s.error||custRes.error;
  if(loadError){root.innerHTML='<div class="notice error">'+esc(friendlyError(loadError))+'</div>';return}
  const loc=l.data||[],svc=s.data||[],cust=custRes.data||[];
  if(!loc.length||!svc.length||!cust.length){
    root.innerHTML='<div class="card"><h2>Новая запись</h2><p class="muted">Сначала добавьте филиал, услугу и клиента в справочниках.</p><a class="btn secondary" href="#/catalog">Открыть справочники</a></div>';return
  }

  root.innerHTML='<form id="quickBook" class="card stack"><div class="card-title"><div><h2>Новая запись</h2><p class="muted tiny">Можно выбрать свободный слот или поставить запись вручную на точное время.</p></div><span class="status confirmed" id="quickDuration">—</span></div><div class="grid grid-4"><label class="field"><span>Филиал</span><select name="location">'+loc.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")+'</select></label><label class="field"><span>Услуга</span><select name="service">'+svc.map(x=>'<option value="'+x.id+'">'+esc(x.name)+' · '+durationLabel(x.duration_minutes)+'</option>').join("")+'</select></label><label class="field"><span>Сотрудник</span><select name="staff"><option value="">Загрузка…</option></select></label><label class="field"><span>Клиент</span><select name="customer">'+cust.map(x=>'<option value="'+x.id+'">'+esc(x.name)+' · '+esc(x.phone)+'</option>').join("")+'</select></label></div><div class="quick-book-mode"><button type="button" class="active" data-quick-mode="slots">Свободные слоты</button><button type="button" data-quick-mode="manual">Точное время</button></div><div class="grid grid-2"><label class="field"><span>Дата</span><input type="date" name="day"></label><label class="field" id="quickSlotField"><span>Свободное время</span><select name="slot"><option value="">Загрузка…</option></select></label><label class="field hidden" id="quickManualField"><span>Время начала</span><input type="time" name="manual_time" step="60"><small>Длительность услуги будет учтена автоматически.</small></label></div><div id="quickBookInfo" class="muted tiny"></div><div><button class="btn brand" id="quickBookSubmit">Создать запись</button></div></form>';

  const f=document.querySelector("#quickBook"),o=await org();
  let eligibleStaff=[],quickMode="slots";
  const dateInZone=(tz)=>{
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    const get=type=>parts.find(x=>x.type===type)?.value;
    return get("year")+"-"+get("month")+"-"+get("day");
  };
  const currentLocation=()=>loc.find(x=>x.id===f.elements.location.value)||loc[0];
  const formatSlot=(value,tz)=>new Intl.DateTimeFormat("ru-RU",{timeZone:tz,hour:"2-digit",minute:"2-digit"}).format(new Date(value));
  const setDayForLocation=()=>{
    const location=currentLocation(),today=dateInZone(location.timezone);
    f.elements.day.min=today;
    if(!f.elements.day.value||f.elements.day.value<today)f.elements.day.value=today;
  };
  const loadSlots=async()=>{
    if(quickMode==="manual"){syncQuickMode();return}
    const staffId=f.elements.staff.value,location=currentLocation(),info=document.querySelector("#quickBookInfo"),submit=document.querySelector("#quickBookSubmit");
    if(!staffId){f.elements.slot.innerHTML='<option value="">Нет доступного сотрудника</option>';submit.disabled=true;return}
    f.elements.slot.disabled=true;f.elements.slot.innerHTML='<option value="">Загрузка…</option>';submit.disabled=true;
    const {data,error}=await sb.rpc("get_admin_availability",{p_location_id:location.id,p_service_id:f.elements.service.value,p_day:f.elements.day.value,p_staff_id:staffId});
    if(error){
      f.elements.slot.innerHTML='<option value="">Не удалось загрузить время</option>';info.textContent=friendlyError(error);return
    }
    const rows=data||[],staffRow=eligibleStaff.find(x=>x.id===staffId),duration=Number(staffRow?.duration_minutes||svc.find(x=>x.id===f.elements.service.value)?.duration_minutes||0);
    document.querySelector("#quickDuration").textContent=durationLabel(duration);
    f.elements.slot.innerHTML='<option value="">Выберите время</option>'+rows.map(x=>'<option value="'+x.start_at+'">'+formatSlot(x.start_at,location.timezone)+' – '+formatSlot(x.end_at,location.timezone)+'</option>').join("");
    f.elements.slot.disabled=!rows.length;submit.disabled=!rows.length;
    info.textContent=rows.length?"Время показано в часовом поясе филиала: "+location.timezone:"На выбранную дату свободных окон нет.";
  };
  const loadStaff=async({resetDay=false}={})=>{
    const location=currentLocation(),prev=f.elements.staff.value,info=document.querySelector("#quickBookInfo"),submit=document.querySelector("#quickBookSubmit");
    if(resetDay)setDayForLocation();
    f.elements.staff.disabled=true;f.elements.staff.innerHTML='<option value="">Загрузка…</option>';f.elements.slot.innerHTML='<option value="">—</option>';submit.disabled=true;
    try{
      eligibleStaff=await rpcRetry("get_public_staff",{p_slug:o.slug,p_location_id:location.id,p_service_id:f.elements.service.value},{attempts:2,timeout:8000})||[];
      f.elements.staff.innerHTML=eligibleStaff.length
        ? eligibleStaff.map(x=>'<option value="'+x.id+'" '+(x.id===prev?"selected":"")+'>'+esc(x.name)+' · '+durationLabel(x.duration_minutes)+'</option>').join("")
        : '<option value="">Нет сотрудников для этой услуги</option>';
      f.elements.staff.disabled=!eligibleStaff.length;
      if(eligibleStaff.length&&!eligibleStaff.some(x=>x.id===f.elements.staff.value))f.elements.staff.value=eligibleStaff[0].id;
      info.textContent=eligibleStaff.length?"":"Назначьте услугу сотруднику в разделе «Справочники».";
      await loadSlots();
    }catch(err){
      eligibleStaff=[];f.elements.staff.innerHTML='<option value="">Ошибка загрузки</option>';info.textContent=friendlyError(err);submit.disabled=true;
    }
  };

  const syncQuickMode=()=>{
    const manual=quickMode==="manual";
    document.querySelector("#quickSlotField")?.classList.toggle("hidden",manual);
    document.querySelector("#quickManualField")?.classList.toggle("hidden",!manual);
    document.querySelectorAll("[data-quick-mode]").forEach(b=>b.classList.toggle("active",b.dataset.quickMode===quickMode));
    const submit=document.querySelector("#quickBookSubmit");
    if(manual){
      f.elements.slot.disabled=true;
      submit.disabled=!f.elements.staff.value||!f.elements.manual_time.value;
      document.querySelector("#quickBookInfo").textContent="Ручное время проверяется по рабочим часам, исключениям и пересечениям при создании записи.";
    }else{
      f.elements.slot.disabled=false;
      loadSlots();
    }
  };
  document.querySelectorAll("[data-quick-mode]").forEach(b=>b.addEventListener("click",()=>{quickMode=b.dataset.quickMode;syncQuickMode()}));
  setDayForLocation();
  f.elements.location.addEventListener("change",()=>loadStaff({resetDay:true}));
  f.elements.service.addEventListener("change",()=>loadStaff());
  f.elements.staff.addEventListener("change",()=>{if(quickMode==="slots")loadSlots();else syncQuickMode()});
  f.elements.day.addEventListener("change",()=>{if(quickMode==="slots")loadSlots()});
  f.elements.manual_time.addEventListener("input",syncQuickMode);
  await loadStaff({resetDay:true});
  syncQuickMode();

  f.addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(f),btn=document.querySelector("#quickBookSubmit");
    if(!fd.get("staff"))return toast("Выберите сотрудника","error");
    if(quickMode==="slots"&&!fd.get("slot"))return toast("Выберите свободное время","error");
    if(quickMode==="manual"&&!fd.get("manual_time"))return toast("Укажите время начала","error");
    btn.disabled=true;btn.textContent="Создаём…";
    const request=quickMode==="manual"
      ? sb.rpc("create_admin_booking_local",{p_location_id:fd.get("location"),p_service_id:fd.get("service"),p_staff_id:fd.get("staff"),p_customer_id:fd.get("customer"),p_local_date:fd.get("day"),p_local_time:fd.get("manual_time"),p_note:null,p_booking_key:crypto.randomUUID()})
      : sb.rpc("create_admin_booking",{p_location_id:fd.get("location"),p_service_id:fd.get("service"),p_staff_id:fd.get("staff"),p_customer_id:fd.get("customer"),p_start_at:fd.get("slot"),p_note:null,p_booking_key:crypto.randomUUID()});
    const {error}=await request;
    if(error){toast(friendlyError(error),"error");btn.disabled=false;btn.textContent="Создать запись"}
    else{toast("Запись создана");dashboard()}
  });
}

async function catalog(){
  if(!await requireAuth())return;
  const p=await profile(),manager=["owner","admin"].includes(p.role);
  const [l,s,st,cust,cat,ss]=await Promise.all([
    sb.from("locations").select("*").order("name"),
    sb.from("services").select("*,service_categories(name)").order("name"),
    sb.from("staff_members").select("*").order("name"),
    sb.from("customers").select("*").order("created_at",{ascending:false}),
    sb.from("service_categories").select("*").order("sort_order").order("name"),
    sb.from("staff_services").select("*")
  ]);
  const err=l.error||s.error||st.error||cust.error||cat.error||ss.error;
  if(err)return shell("catalog","Справочники",'<div class="notice error">'+esc(friendlyError(err))+'</div>');
  const content='<div class="page-head"><div><h1>Справочники</h1><p>Услуги, команда, филиалы и клиентская база.</p></div></div><div class="tabs" id="catalogTabs"><button class="tab active" data-tab="services">Услуги '+(s.data?.length||0)+'</button><button class="tab" data-tab="staff">Сотрудники '+(st.data?.length||0)+'</button><button class="tab" data-tab="locations">Филиалы '+(l.data?.length||0)+'</button><button class="tab" data-tab="customers">Клиенты '+(cust.data?.length||0)+'</button></div><section id="catalogPane" style="margin-top:16px"></section>';
  await shell("catalog","Справочники",content);
  const data={services:s.data||[],staff:st.data||[],locations:l.data||[],customers:cust.data||[],categories:cat.data||[],assignments:ss.data||[]};

  const render=tab=>{
    document.querySelectorAll("#catalogTabs .tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===tab));
    const pane=document.querySelector("#catalogPane");
    const categoryOptions='<option value="">Без категории</option>'+data.categories.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("");
    const minuteOptions=Array.from({length:60},(_,i)=>'<option value="'+i+'">'+String(i).padStart(2,"0")+' мин</option>').join("");
    const forms={
      services:'<div class="grid grid-2"><form id="addEntity" class="card stack"><input type="hidden" name="entity_id"><div class="card-title"><div><h2 id="serviceFormTitle">Новая услуга</h2><p class="muted tiny">Длительность хранится точно в минутах и определяет реальный конец записи.</p></div></div><div class="grid grid-2"><label class="field"><span>Название</span><input name="name" required></label><label class="field"><span>Категория</span><select name="category">'+categoryOptions+'</select></label></div><div class="duration-editor"><label class="field"><span>Часы</span><input name="duration_hours" type="number" value="1" min="0" max="24" step="1"></label><label class="field"><span>Минуты</span><select name="duration_minutes_part">'+minuteOptions+'</select></label><label class="field"><span>Цена</span><input name="price" type="number" value="0" min="0" step=".01"></label></div><div class="grid grid-2"><label class="field"><span>Статус</span><select name="active"><option value="true">Активна</option><option value="false">Выключена</option></select></label><div class="notice info duration-hint">Например, 1 ч 20 мин = запись займёт ровно 80 минут. Шаг начала записи настраивается отдельно.</div></div><div class="cluster"><button class="btn brand" id="serviceSubmit">Добавить услугу</button><button type="button" class="btn secondary hidden" id="cancelServiceEdit">Отмена</button></div></form><form id="categoryForm" class="card stack"><div><h2>Категории</h2><p class="muted tiny">Помогают структурировать каталог и форму онлайн-записи.</p></div><label class="field"><span>Название категории</span><input name="name" placeholder="Стрижки, массаж, консультации" required></label><button class="btn secondary">Добавить категорию</button><div class="scope-pills">'+data.categories.map(x=>'<span class="category-label">'+esc(x.name)+'</span>').join("")+'</div></form></div>',
      staff:'<div class="grid grid-2"><form id="addEntity" class="card stack"><h2>Новый сотрудник</h2><label class="field"><span>Имя</span><input name="name" required></label><label class="field"><span>Филиал</span><select name="location">'+data.locations.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")+'</select></label><label class="field"><span>Фото — URL</span><input name="avatar_url" type="url" placeholder="https://..."><small>Можно оставить пустым — покажем инициалы.</small></label><button class="btn brand">Добавить сотрудника</button></form><form id="assignService" class="card stack"><div><h2>Услуга сотрудника</h2><p class="muted tiny">Назначьте услугу и при необходимости задайте персональную длительность.</p></div><label class="field"><span>Сотрудник</span><select name="staff">'+data.staff.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")+'</select></label><label class="field"><span>Услуга</span><select name="service">'+data.services.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")+'</select></label><label class="field"><span>Длительность</span><select name="duration_mode"><option value="default">Как у услуги</option><option value="custom">Индивидуальная</option></select></label><div id="staffDurationFields" class="duration-editor compact hidden"><label class="field"><span>Часы</span><input name="duration_hours" type="number" min="0" max="24" value="1"></label><label class="field"><span>Минуты</span><select name="duration_minutes_part">'+minuteOptions+'</select></label></div><div id="staffServiceHint" class="notice info">Используется длительность услуги.</div><div class="cluster"><button class="btn secondary">Назначить / сохранить</button><button type="button" class="btn danger hidden" id="removeStaffService">Убрать услугу</button></div></form></div>',
      locations:'<form id="addEntity" class="card stack"><h2>Новый филиал</h2><div class="grid grid-3"><label class="field"><span>Название</span><input name="name" required></label><label class="field"><span>Timezone</span><input name="timezone" value="Europe/Moscow"></label><label class="field"><span>Адрес</span><input name="address"></label></div><button class="btn brand">Добавить филиал</button></form>',
      customers:'<form id="addEntity" class="card stack"><h2>Новый клиент</h2><div class="grid grid-3"><label class="field"><span>Имя</span><input name="name" required></label><label class="field"><span>Телефон</span><input name="phone" required></label><label class="field"><span>Email</span><input name="email" type="email"></label></div><label class="field"><span>Заметка</span><textarea name="note"></textarea></label><button class="btn brand">Добавить клиента</button></form>'
    };
    const filters=tab==="services"?'<div class="cluster"><div class="search"><input id="entitySearch" placeholder="Поиск"></div><select id="categoryFilter" style="width:auto"><option value="">Все категории</option>'+data.categories.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")+'</select></div>':'<div class="search"><input id="entitySearch" placeholder="Поиск"></div>';
    const renderRows=()=>{
      const q=(document.querySelector("#entitySearch")?.value||"").toLowerCase(),catId=document.querySelector("#categoryFilter")?.value||"";
      const rows=data[tab].filter(x=>JSON.stringify(x).toLowerCase().includes(q)&&(!catId||x.category_id===catId));
      document.querySelector("#entityList").innerHTML=rows.length?rows.map(x=>entityCard(tab,x,manager)).join(""):emptyState("Ничего не найдено","Измените поиск или фильтр.");
    };
    const cards=data[tab].map(x=>entityCard(tab,x,manager)).join("");
    pane.innerHTML=(manager?forms[tab]:"")+'<div class="card" style="margin-top:16px"><div class="card-title"><h2>'+({services:"Услуги",staff:"Сотрудники",locations:"Филиалы",customers:"Клиенты"}[tab])+'</h2>'+filters+'</div><div id="entityList">'+(cards||emptyState("Пока пусто","Добавьте первую запись в этот справочник."))+'</div></div>';
    document.querySelector("#entitySearch")?.addEventListener("input",renderRows);
    document.querySelector("#categoryFilter")?.addEventListener("change",renderRows);

    if(manager){
      bindAddEntity(tab,p,data);
      if(tab==="services"){
        const serviceForm=document.querySelector("#addEntity");
        const resetServiceForm=()=>{
          serviceForm.reset();
          serviceForm.elements.entity_id.value="";
          serviceForm.elements.duration_hours.value="1";
          serviceForm.elements.duration_minutes_part.value="0";
          serviceForm.elements.active.value="true";
          document.querySelector("#serviceFormTitle").textContent="Новая услуга";
          document.querySelector("#serviceSubmit").textContent="Добавить услугу";
          document.querySelector("#cancelServiceEdit").classList.add("hidden");
        };
        document.querySelector("#cancelServiceEdit")?.addEventListener("click",resetServiceForm);
        document.querySelector("#entityList")?.addEventListener("click",e=>{
          const button=e.target.closest("[data-edit-service]");if(!button)return;
          const item=data.services.find(x=>x.id===button.dataset.editService);if(!item)return;
          serviceForm.elements.entity_id.value=item.id;
          serviceForm.elements.name.value=item.name||"";
          serviceForm.elements.category.value=item.category_id||"";
          serviceForm.elements.duration_hours.value=Math.floor(Number(item.duration_minutes||0)/60);
          serviceForm.elements.duration_minutes_part.value=String(Number(item.duration_minutes||0)%60);
          serviceForm.elements.price.value=item.price||0;
          serviceForm.elements.active.value=String(item.active);
          document.querySelector("#serviceFormTitle").textContent="Редактировать услугу";
          document.querySelector("#serviceSubmit").textContent="Сохранить изменения";
          document.querySelector("#cancelServiceEdit").classList.remove("hidden");
          serviceForm.scrollIntoView({behavior:"smooth",block:"start"});
        });
        document.querySelector("#categoryForm")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget),name=String(f.get("name")).trim();if(!name)return;const {error}=await sb.from("service_categories").insert({organization_id:p.organization_id,name});if(error)toast(friendlyError(error),"error");else{toast("Категория добавлена");catalog()}});
      }
      if(tab==="staff"){
        const assignmentForm=document.querySelector("#assignService");
        const syncAssignment=()=>{
          if(!assignmentForm)return;
          const staffId=assignmentForm.elements.staff.value,serviceId=assignmentForm.elements.service.value;
          const service=data.services.find(x=>x.id===serviceId);
          const assignment=data.assignments.find(x=>x.staff_id===staffId&&x.service_id===serviceId);
          const override=Number(assignment?.duration_override_minutes||0);
          assignmentForm.elements.duration_mode.value=override>0?"custom":"default";
          assignmentForm.elements.duration_hours.value=String(Math.floor((override||Number(service?.duration_minutes||60))/60));
          assignmentForm.elements.duration_minutes_part.value=String((override||Number(service?.duration_minutes||60))%60);
          const fields=document.querySelector("#staffDurationFields"),hint=document.querySelector("#staffServiceHint"),remove=document.querySelector("#removeStaffService");
          fields?.classList.toggle("hidden",assignmentForm.elements.duration_mode.value!=="custom");
          remove?.classList.toggle("hidden",!assignment);
          if(hint)hint.innerHTML=assignment
            ? (override>0
              ?"Назначено · индивидуально <b>"+durationLabel(override)+"</b>. Базовая услуга: "+durationLabel(service?.duration_minutes||0)+"."
              :"Назначено · используется базовая длительность <b>"+durationLabel(service?.duration_minutes||0)+"</b>.")
            :"Эта услуга сотруднику ещё не назначена.";
        };
        assignmentForm?.elements.staff.addEventListener("change",syncAssignment);
        assignmentForm?.elements.service.addEventListener("change",syncAssignment);
        assignmentForm?.elements.duration_mode.addEventListener("change",()=>{
          document.querySelector("#staffDurationFields")?.classList.toggle("hidden",assignmentForm.elements.duration_mode.value!=="custom");
        });
        assignmentForm?.addEventListener("submit",async e=>{
          e.preventDefault();const f=new FormData(e.currentTarget);
          let override=null;
          if(f.get("duration_mode")==="custom"){
            override=Number(f.get("duration_hours")||0)*60+Number(f.get("duration_minutes_part")||0);
            if(override<1||override>1440)return toast("Проверьте индивидуальную длительность","error");
          }
          const payload={staff_id:f.get("staff"),service_id:f.get("service"),duration_override_minutes:override};
          const {data:row,error}=await sb.from("staff_services").upsert(payload,{onConflict:"staff_id,service_id"}).select("*").single();
          if(error)return toast(friendlyError(error),"error");
          const idx=data.assignments.findIndex(x=>x.staff_id===row.staff_id&&x.service_id===row.service_id);
          if(idx>=0)data.assignments[idx]=row;else data.assignments.push(row);
          toast(override?"Индивидуальная длительность сохранена":"Услуга назначена с базовой длительностью");
          syncAssignment();
        });
        document.querySelector("#removeStaffService")?.addEventListener("click",async()=>{
          const staffId=assignmentForm.elements.staff.value,serviceId=assignmentForm.elements.service.value;
          const assignment=data.assignments.find(x=>x.staff_id===staffId&&x.service_id===serviceId);
          if(!assignment)return;
          if(!confirm("Убрать эту услугу у сотрудника? Он перестанет появляться для неё в онлайн-записи."))return;
          const {error}=await sb.from("staff_services").delete().eq("id",assignment.id);
          if(error)return toast(friendlyError(error),"error");
          data.assignments=data.assignments.filter(x=>x.id!==assignment.id);
          toast("Услуга снята с сотрудника");syncAssignment();
        });
        syncAssignment();
      }
    }
  };
  document.querySelectorAll("#catalogTabs .tab").forEach(b=>b.addEventListener("click",()=>render(b.dataset.tab)));
  render("services");
}

function entityCard(tab,x,editable=false){
  if(tab==="customers")return '<div class="spread" style="padding:13px 0;border-bottom:1px solid var(--line)"><div class="person"><span class="avatar">'+initials(x.name)+'</span><div><a href="#/client/'+x.id+'"><b>'+esc(x.name)+'</b></a><small>'+esc(x.phone)+' · '+esc(x.email||"без email")+'</small></div></div><span class="muted tiny">'+esc(x.note||"")+'</span></div>';
  if(tab==="services")return '<div class="spread service-row" style="padding:13px 0;border-bottom:1px solid var(--line)"><div><div class="cluster"><b>'+esc(x.name)+'</b>'+(x.service_categories?.name?'<span class="category-label">'+esc(x.service_categories.name)+'</span>':"")+'<span class="status '+(x.active?"confirmed":"canceled")+'">'+(x.active?"Активна":"Выключена")+'</span></div><div class="muted tiny">'+durationLabel(x.duration_minutes)+'</div></div><div class="cluster">'+(editable?'<button type="button" class="btn secondary sm" data-edit-service="'+x.id+'">Изменить</button>':"")+'<b>'+money(x.price)+'</b></div></div>';
  if(tab==="staff"){const avatar=x.avatar_url?'<img class="staff-photo" src="'+esc(x.avatar_url)+'" alt="" loading="lazy">':'<span class="avatar">'+initials(x.name)+'</span>';return '<div class="spread" style="padding:13px 0;border-bottom:1px solid var(--line)"><div class="person">'+avatar+'<div><b>'+esc(x.name)+'</b><small>'+(x.active?"Активен":"Неактивен")+'</small></div></div></div>'}
  return '<div class="spread" style="padding:13px 0;border-bottom:1px solid var(--line)"><div><b>'+esc(x.name)+'</b><div class="muted tiny">'+esc(x.address||"Адрес не указан")+' · '+esc(x.timezone||"")+'</div></div></div>';
}
function bindAddEntity(tab,p,data){
  document.querySelector("#addEntity")?.addEventListener("submit",async e=>{
    e.preventDefault();
    const f=new FormData(e.currentTarget);let table,payload;
    const id=f.get("entity_id")||null;
    if(tab==="services"){
      const hours=Math.max(0,Number(f.get("duration_hours")||0));
      const minutes=Math.max(0,Number(f.get("duration_minutes_part")||0));
      const duration=Math.round(hours*60+minutes);
      if(duration<1)return toast("Укажите длительность услуги","error");
      if(duration>1440)return toast("Длительность услуги не может превышать 24 часа","error");
      table="services";
      payload={organization_id:p.organization_id,name:String(f.get("name")||"").trim(),duration_minutes:duration,price:Number(f.get("price")||0),category_id:f.get("category")||null,active:f.get("active")!=="false"};
    }
    else if(tab==="staff"){table="staff_members";payload={organization_id:p.organization_id,name:f.get("name"),location_id:f.get("location"),avatar_url:f.get("avatar_url")||null}}
    else if(tab==="locations"){table="locations";payload={organization_id:p.organization_id,name:f.get("name"),timezone:f.get("timezone"),address:f.get("address")||null}}
    else{table="customers";payload={organization_id:p.organization_id,name:f.get("name"),phone:f.get("phone"),email:f.get("email")||null,note:f.get("note")||null}}
    const query=id&&tab==="services"?sb.from(table).update(payload).eq("id",id):sb.from(table).insert(payload);
    const {error}=await query;
    if(error)toast(friendlyError(error),"error");else{toast(id?"Изменения сохранены":"Добавлено");catalog()}
  })
}
async function calendar(){
  if(!await requireAuth())return;
  const p=await profile(),o=await org(),manager=["owner","admin"].includes(p.role);
  const [apptRes,staffRes,locRes,hoursRes]=await Promise.all([
    sb.from("appointments").select("*,customers(name,phone),services(name),staff_members(name),locations(name,timezone)").order("start_at",{ascending:true}).limit(500),
    sb.from("staff_members").select("id,name").eq("active",true).order("name"),
    sb.from("locations").select("id,name,timezone").eq("active",true).order("name"),
    sb.from("working_hours").select("start_time,end_time")
  ]);
  const loadError=apptRes.error||staffRes.error||locRes.error||hoursRes.error;
  if(loadError)return shell("calendar","Календарь",'<div class="notice error">'+esc(friendlyError(loadError))+'</div>');
  const all=apptRes.data||[],staff=staffRes.data||[],locations=locRes.data||[],working=hoursRes.data||[];
  let mode="week",anchor=todayIso(),staffFilter="",locationFilter="",gridStep=[5,10,15,20,30,60].includes(Number(o.booking_interval_minutes))?Number(o.booking_interval_minutes):15,suppressEventClick=false;
  try{const stored=Number(localStorage.getItem("lootly_calendar_grid_step"));if([5,10,15,20,30,60].includes(stored))gridStep=stored}catch{}
  const hourFromTime=t=>Number(String(t||"08:00").slice(0,2));
  const minuteFromTime=t=>Number(String(t||"00:00").slice(3,5));
  const startHour=working.length?Math.max(0,Math.min(...working.map(x=>hourFromTime(x.start_time)))):8;
  const endHour=working.length?Math.min(24,Math.max(...working.map(x=>hourFromTime(x.end_time)+(minuteFromTime(x.end_time)>0?1:0)))):21;

  const content='<div class="page-head"><div><h1>Календарь</h1><p>Рабочая неделя, загрузка команды и точный перенос записей.</p></div><div class="cluster"><select id="calendarMode" style="width:auto"><option value="week">Неделя</option><option value="day">День</option></select><select id="calendarGridStep" style="width:auto"><option value="5">Сетка 5 мин</option><option value="10">Сетка 10 мин</option><option value="15">Сетка 15 мин</option><option value="20">Сетка 20 мин</option><option value="30">Сетка 30 мин</option><option value="60">Сетка 60 мин</option></select><select id="calendarLocation" style="width:auto"><option value="">Все филиалы</option>'+locations.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")+'</select><select id="calendarStaff" style="width:auto"><option value="">Все сотрудники</option>'+staff.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")+'</select></div></div><div class="calendar-toolbar"><div class="cluster"><button class="btn secondary sm" id="calPrev">←</button><button class="btn secondary sm" id="calToday">Сегодня</button><button class="btn secondary sm" id="calNext">→</button></div><b id="calendarPeriod"></b><span class="muted tiny">'+(manager?"Сетка календаря влияет только на отображение и перенос. Онлайн-запись использует шаг "+Number(o.booking_interval_minutes||15)+" мин.":"Сетка календаря — только способ отображения.")+'</span></div><div class="calendar-grid week" id="calendarGrid"></div>';
  await shell("calendar","Календарь",content);
  document.querySelector("#calendarGridStep").value=String(gridStep);

  function openAppointment(a){
    document.querySelector("#calendarAppointmentModal")?.remove();
    const tz=a.locations?.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone;
    const modal=document.createElement("div");
    modal.id="calendarAppointmentModal";modal.className="calendar-modal-backdrop";
    const actions=manager&&["booked","confirmed"].includes(a.status)
      ? '<div class="calendar-modal-actions"><button class="btn secondary" data-modal-status="confirmed">Подтвердить</button><button class="btn secondary" data-modal-status="completed">Завершить</button><button class="btn danger" data-modal-status="canceled">Отменить</button></div>'
      : "";
    modal.innerHTML='<div class="calendar-modal" role="dialog" aria-modal="true" aria-labelledby="calendarModalTitle"><div class="spread"><div><span class="status '+esc(a.status)+'">'+esc(statusLabel(a.status))+'</span><h2 id="calendarModalTitle" style="margin:10px 0 4px">'+esc(a.customers?.name||"Клиент")+'</h2><div class="muted">'+esc(a.customers?.phone||"")+'</div></div><button type="button" class="btn ghost" id="calendarModalClose" aria-label="Закрыть">×</button></div><div class="calendar-modal-grid"><div><span>Время</span><b>'+dtZone(a.start_at,tz)+' — '+new Intl.DateTimeFormat("ru-RU",{timeZone:tz,hour:"2-digit",minute:"2-digit"}).format(new Date(a.end_at))+'</b></div><div><span>Длительность</span><b>'+durationLabel(a.duration_minutes)+'</b></div><div><span>Услуга</span><b>'+esc(a.services?.name||"—")+'</b></div><div><span>Сотрудник</span><b>'+esc(a.staff_members?.name||"—")+'</b></div><div><span>Филиал</span><b>'+esc(a.locations?.name||"—")+'</b></div><div><span>Стоимость</span><b>'+money(a.price)+'</b></div></div><div class="cluster"><a class="btn secondary" href="#/client/'+a.customer_id+'">Карточка клиента</a></div>'+actions+'</div>';
    document.body.append(modal);
    const close=()=>modal.remove();
    document.querySelector("#calendarModalClose")?.addEventListener("click",close);
    modal.addEventListener("click",e=>{if(e.target===modal)close()});
    const onKey=e=>{if(e.key==="Escape"){close();document.removeEventListener("keydown",onKey)}};
    document.addEventListener("keydown",onKey);
    modal.querySelectorAll("[data-modal-status]").forEach(b=>b.addEventListener("click",async()=>{
      b.disabled=true;
      const {error}=await sb.rpc("set_appointment_status",{p_appointment_id:a.id,p_status:b.dataset.modalStatus});
      if(error){toast(friendlyError(error),"error");b.disabled=false;return}
      toast("Статус обновлён");close();calendar();
    }));
  }

  function render(){
    const grid=document.querySelector("#calendarGrid");
    const start=mode==="week"?weekStartIso(anchor):anchor;
    const days=Array.from({length:mode==="week"?7:1},(_,i)=>addDaysIso(start,i));
    const hours=Array.from({length:Math.max(1,endHour-startHour)},(_,i)=>startHour+i);
    const hourHeight=gridStep<=5?160:gridStep<=10?128:gridStep<=15?104:gridStep<=20?92:gridStep<=30?76:64;
    grid.className="calendar-grid "+mode;
    grid.style.setProperty("--cal-hour-height",hourHeight+"px");
    document.querySelector("#calendarPeriod").textContent=mode==="week"
      ? new Date(days[0]+"T12:00:00").toLocaleDateString("ru-RU",{day:"numeric",month:"short"})+" — "+new Date(days[days.length-1]+"T12:00:00").toLocaleDateString("ru-RU",{day:"numeric",month:"short",year:"numeric"})
      : new Date(anchor+"T12:00:00").toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long"});

    const sublines=Array.from({length:Math.max(0,Math.floor(60/gridStep)-1)},(_,i)=>{const minute=(i+1)*gridStep;return '<span class="cal-subline" style="top:'+(minute/60*100)+'%"><i>'+String(minute).padStart(2,"0")+'</i></span>'}).join("");
    let html='<div class="cal-head"></div>'+days.map(x=>'<div class="cal-head">'+new Date(x+"T12:00:00").toLocaleDateString("ru-RU",{weekday:"short",day:"numeric",month:"short"})+'</div>').join("");
    for(const hour of hours){
      html+='<div class="cal-time">'+String(hour).padStart(2,"0")+':00</div>';
      for(const date of days)html+='<div class="cal-cell" data-date="'+date+'" data-hour="'+hour+'">'+sublines+'</div>';
    }
    grid.innerHTML=html;

    const filtered=all.filter(a=>(!staffFilter||a.staff_id===staffFilter)&&(!locationFilter||a.location_id===locationFilter));
    const visible=filtered.map(a=>{
      const tz=a.locations?.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone;
      const lp=localDateParts(a.start_at,tz);
      return{a,tz,lp,start:lp.hour*60+lp.minute,end:lp.hour*60+lp.minute+Number(a.duration_minutes||60)};
    }).filter(x=>days.includes(x.lp.date)&&x.lp.hour>=startHour&&x.lp.hour<endHour);
    const layouts=new Map();
    for(const date of days){
      const items=visible.filter(x=>x.lp.date===date).sort((a,b)=>a.start-b.start||a.end-b.end);
      let cluster=[],clusterEnd=-1;
      const flush=()=>{
        if(!cluster.length)return;
        const colEnds=[],assigned=[];
        cluster.forEach(item=>{
          let col=colEnds.findIndex(end=>end<=item.start);
          if(col<0){col=colEnds.length;colEnds.push(item.end)}else colEnds[col]=item.end;
          assigned.push({item,col});
        });
        const cols=Math.max(1,colEnds.length);
        assigned.forEach(({item,col})=>layouts.set(item.a.id,{col,cols}));
        cluster=[];clusterEnd=-1;
      };
      items.forEach(item=>{
        if(cluster.length&&item.start>=clusterEnd)flush();
        cluster.push(item);clusterEnd=Math.max(clusterEnd,item.end);
      });
      flush();
    }
    visible.forEach(({a,lp})=>{
      const cell=grid.querySelector('.cal-cell[data-date="'+lp.date+'"][data-hour="'+lp.hour+'"]');
      if(!cell)return;
      const ev=document.createElement("div");
      ev.className="cal-event "+a.status;
      ev.draggable=manager&&["booked","confirmed"].includes(a.status);
      ev.dataset.appointment=a.id;
      const height=Math.max(30,(Number(a.duration_minutes||60)/60)*hourHeight-5),layout=layouts.get(a.id)||{col:0,cols:1};
      ev.style.top=(3+(lp.minute/60)*hourHeight)+"px";ev.style.height=height+"px";
      if(layout.cols>1){
        ev.style.right="auto";
        ev.style.left="calc("+(layout.col*100/layout.cols)+"% + 3px)";
        ev.style.width="calc("+(100/layout.cols)+"% - 6px)";
      }
      ev.innerHTML='<b>'+String(lp.hour).padStart(2,"0")+':'+String(lp.minute).padStart(2,"0")+' · '+esc(a.customers?.name||"Клиент")+'</b><span>'+esc(a.services?.name||"")+' · '+durationLabel(a.duration_minutes)+' · '+esc(a.staff_members?.name||"")+'</span>';
      ev.title=(a.customers?.name||"")+" · "+(a.services?.name||"")+" · "+durationLabel(a.duration_minutes)+" · "+statusLabel(a.status);
      ev.addEventListener("click",()=>{if(!suppressEventClick)openAppointment(a)});
      cell.append(ev);
    });

    if(manager){
      grid.querySelectorAll(".cal-event[draggable=true]").forEach(ev=>ev.addEventListener("dragstart",e=>{
        suppressEventClick=true;
        const rect=ev.getBoundingClientRect();
        const appointment=all.find(x=>x.id===ev.dataset.appointment);
        const duration=Number(appointment?.duration_minutes||60);
        const grabMinutes=Math.max(0,Math.min(duration-1,((e.clientY-rect.top)/hourHeight)*60));
        e.dataTransfer.setData("text/plain",JSON.stringify({id:ev.dataset.appointment,grabMinutes,duration}));
        e.dataTransfer.effectAllowed="move";
        requestAnimationFrame(()=>ev.classList.add("dragging"));
      }));
      grid.querySelectorAll(".cal-event[draggable=true]").forEach(ev=>ev.addEventListener("dragend",()=>{ev.classList.remove("dragging");setTimeout(()=>{suppressEventClick=false},120)}));
      grid.querySelectorAll(".cal-cell").forEach(cell=>{
        cell.addEventListener("dragover",e=>{e.preventDefault();cell.classList.add("drag-over")});
        cell.addEventListener("dragleave",()=>cell.classList.remove("drag-over"));
        cell.addEventListener("drop",async e=>{
          e.preventDefault();cell.classList.remove("drag-over");
          let payload={id:"",grabMinutes:0};
          try{payload=JSON.parse(e.dataTransfer.getData("text/plain"))}catch{payload.id=e.dataTransfer.getData("text/plain")}
          if(!payload.id)return;
          const rect=cell.getBoundingClientRect();
          const pointerMinutes=Math.max(0,Math.min(59.999,((e.clientY-rect.top)/rect.height)*60));
          const rawStart=Number(cell.dataset.hour)*60+pointerMinutes-Number(payload.grabMinutes||0);
          const snapped=Math.round(rawStart/gridStep)*gridStep;
          const minTotal=startHour*60;
          const appointment=all.find(x=>x.id===payload.id);
          const duration=Math.max(1,Number(payload.duration||appointment?.duration_minutes||60));
          const maxTotal=Math.max(minTotal,endHour*60-duration);
          const totalMinutes=Math.max(minTotal,Math.min(maxTotal,snapped));
          const targetHour=Math.floor(totalMinutes/60),minute=totalMinutes%60;
          const time=String(targetHour).padStart(2,"0")+":"+String(minute).padStart(2,"0")+":00";
          try{
            await rpcRetry("reschedule_appointment_local",{p_appointment_id:payload.id,p_local_date:cell.dataset.date,p_local_time:time},{attempts:1,timeout:10000});
            toast("Запись перенесена на "+String(targetHour).padStart(2,"0")+":"+String(minute).padStart(2,"0"));
            calendar();
          }catch(err){toast(friendlyError(err),"error")}
        });
      });
    }
  }
  document.querySelector("#calendarMode").addEventListener("change",e=>{mode=e.target.value;render()});
  document.querySelector("#calendarGridStep").addEventListener("change",e=>{gridStep=Number(e.target.value);try{localStorage.setItem("lootly_calendar_grid_step",String(gridStep))}catch{}render()});
  document.querySelector("#calendarStaff").addEventListener("change",e=>{staffFilter=e.target.value;render()});
  document.querySelector("#calendarLocation").addEventListener("change",e=>{locationFilter=e.target.value;render()});
  document.querySelector("#calToday").addEventListener("click",()=>{anchor=todayIso();render()});
  document.querySelector("#calPrev").addEventListener("click",()=>{anchor=addDaysIso(anchor,mode==="week"?-7:-1);render()});
  document.querySelector("#calNext").addEventListener("click",()=>{anchor=addDaysIso(anchor,mode==="week"?7:1);render()});
  render();
}

async function clientDetail(id){
  if(!await requireAuth())return;
  const p=await profile(),manager=["owner","admin"].includes(p.role);
  const [custRes,apptRes]=await Promise.all([
    sb.from("customers").select("*").eq("id",id).single(),
    sb.from("appointments").select("*,services(name),staff_members(name),locations(name,timezone)").eq("customer_id",id).order("start_at",{ascending:false}).limit(200)
  ]);
  if(custRes.error)return shell("catalog","Клиент",'<div class="notice error">'+esc(custRes.error.message)+'</div>');
  const c=custRes.data,visits=apptRes.data||[],completed=visits.filter(x=>x.status==="completed"),spent=completed.reduce((s,x)=>s+Number(x.price||0),0),next=visits.filter(x=>new Date(x.start_at)>new Date()&&["booked","confirmed"].includes(x.status)).sort((a,b)=>new Date(a.start_at)-new Date(b.start_at))[0];
  const rows=visits.map(x=>'<tr><td>'+dtZone(x.start_at,x.locations?.timezone)+'</td><td>'+esc(x.services?.name||"—")+'<div class="muted tiny">'+durationLabel(x.duration_minutes)+'</div></td><td>'+esc(x.staff_members?.name||"—")+'</td><td>'+money(x.price)+'</td><td><span class="status '+x.status+'">'+statusLabel(x.status)+'</span></td></tr>').join("");
  const content='<div class="page-head"><div><a class="muted tiny" href="#/catalog">← Назад к клиентам</a></div></div><section class="card"><div class="client-hero"><div class="client-avatar">'+initials(c.name)+'</div><div><h1 style="margin-bottom:6px">'+esc(c.name)+'</h1><div class="muted">'+esc(c.phone)+(c.email?" · "+esc(c.email):"")+'</div></div><div class="cluster"><a class="btn brand" href="#/dashboard">+ Новая запись</a></div></div><div class="stat-row" style="margin-top:20px"><div class="stat-box"><b>'+visits.length+'</b><span>визитов всего</span></div><div class="stat-box"><b>'+money(spent)+'</b><span>сумма завершённых</span></div><div class="stat-box"><b>'+(next?dayZone(next.start_at,next.locations?.timezone):"—")+'</b><span>следующий визит</span></div></div></section><div class="grid grid-2" style="margin-top:16px"><section class="card stack"><div class="card-title"><h2>Заметка</h2></div><textarea id="clientNote" '+(manager?"":"readonly")+' placeholder="Предпочтения, важные детали...">'+esc(c.note||"")+'</textarea>'+(manager?'<button class="btn secondary" id="saveClientNote">Сохранить заметку</button>':"")+'</section><section class="card"><div class="card-title"><h2>Контакты</h2></div><div class="stack"><div><span class="muted tiny">Телефон</span><div><b>'+esc(c.phone)+'</b></div></div><div><span class="muted tiny">Email</span><div><b>'+esc(c.email||"Не указан")+'</b></div></div><div><span class="muted tiny">Клиент с</span><div><b>'+new Date(c.created_at).toLocaleDateString("ru-RU")+'</b></div></div></div></section></div><section class="card flush" style="margin-top:16px"><div class="card-title" style="padding:18px 18px 0"><h2>История визитов</h2></div><div class="table-wrap"><table class="table"><thead><tr><th>Дата</th><th>Услуга</th><th>Сотрудник</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>'+(rows||'<tr><td colspan="5">'+emptyState("Истории пока нет","После первой записи здесь появится история клиента.")+'</td></tr>')+'</tbody></table></div></section>';
  await shell("catalog","Карточка клиента",content);
  document.querySelector("#saveClientNote")?.addEventListener("click",async()=>{const note=document.querySelector("#clientNote").value.trim();const {error}=await sb.from("customers").update({note}).eq("id",id);if(error)toast(error.message,"error");else toast("Заметка сохранена")});
}

async function schedule(){
  if(!await requireAuth())return;
  const p=await profile(),manager=["owner","admin"].includes(p.role);
  const {data:staff,error}=await sb.from("staff_members").select("*,locations(name,timezone)").eq("active",true).order("name");
  if(error)return shell("schedule","Расписание",'<div class="notice error">'+esc(friendlyError(error))+'</div>');
  const content='<div class="page-head"><div><h1>Расписание</h1><p>Рабочие интервалы, перерывы и исключения по каждому сотруднику.</p></div></div>'+(staff?.length?'<div class="grid grid-3" id="staffSelector">'+staff.map((x,i)=>'<button class="card '+(i===0?"soft":"")+'" data-staff="'+x.id+'" style="text-align:left"><div class="person"><span class="avatar">'+initials(x.name)+'</span><div><b>'+esc(x.name)+'</b><small>'+esc(x.locations?.name||"Филиал")+'</small></div></div></button>').join("")+'</div><section id="schedulePane" style="margin-top:16px"></section>':emptyState("Нет сотрудников","Добавьте сотрудника в справочниках.","<a class='btn brand' href='#/catalog'>Добавить сотрудника</a>"));
  await shell("schedule","Расписание",content);
  if(!staff?.length)return;

  const load=async id=>{
    const target=staff.find(x=>x.id===id);
    document.querySelectorAll("[data-staff]").forEach(b=>b.classList.toggle("soft",b.dataset.staff===id));
    const [h,o]=await Promise.all([
      sb.from("working_hours").select("*").eq("staff_id",id).order("weekday").order("start_time"),
      sb.from("time_off").select("*").eq("staff_id",id).order("start_at")
    ]);
    const loadError=h.error||o.error;
    if(loadError){document.querySelector("#schedulePane").innerHTML='<div class="notice error">'+esc(friendlyError(loadError))+'</div>';return}
    const hours=h.data||[],off=o.data||[],days=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"],tz=target.locations?.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone;
    const localDateTime=value=>new Intl.DateTimeFormat("ru-RU",{timeZone:tz,day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value));
    const weekHtml=days.map((d,i)=>{
      const rows=hours.filter(x=>x.weekday===i);
      return '<div class="schedule-day"><div class="schedule-day-label"><b>'+d+'</b><span class="muted tiny">'+(rows.length?rows.length+" интервал"+(rows.length>1?"а":""):"Выходной")+'</span></div><div class="schedule-intervals">'+(rows.length?rows.map(row=>'<div class="schedule-interval"><span>'+row.start_time.slice(0,5)+' – '+row.end_time.slice(0,5)+'</span>'+(manager?'<div class="cluster"><button type="button" class="btn ghost sm" data-edit-hour="'+row.id+'">Изменить</button><button type="button" class="btn ghost sm danger-text" data-delete-hour="'+row.id+'">×</button></div>':"")+'</div>').join(""):'<span class="muted tiny">Рабочих часов нет</span>')+'</div></div>';
    }).join("");

    document.querySelector("#schedulePane").innerHTML='<div class="grid grid-2"><div class="card"><div class="card-title"><div><h2>'+esc(target.name)+'</h2><p class="muted tiny">'+esc(target.locations?.name||"")+' · '+esc(tz)+' · можно задавать несколько интервалов в день</p></div></div>'+weekHtml+'</div><div class="stack">'+(manager?'<form id="hoursForm" class="card stack"><input type="hidden" name="hour_id"><div class="card-title"><div><h3 id="hoursFormTitle">Добавить рабочий интервал</h3><p class="muted tiny">Например: 09:00–13:00 и 14:00–18:00 для обеденного перерыва.</p></div></div><div class="grid grid-3"><label class="field"><span>День</span><select name="weekday">'+days.map((x,i)=>'<option value="'+i+'">'+x+'</option>').join("")+'</select></label><label class="field"><span>С</span><input name="start" type="time" value="09:00" required></label><label class="field"><span>До</span><input name="end" type="time" value="18:00" required></label></div><div class="cluster"><button class="btn brand" id="hoursSubmit">Добавить интервал</button><button type="button" class="btn secondary hidden" id="cancelHourEdit">Отмена</button></div></form><form id="offForm" class="card stack"><div><h3>Исключение / Time off</h3><p class="muted tiny">Время трактуется в timezone филиала: '+esc(tz)+'.</p></div><div class="grid grid-2"><label class="field"><span>Начало</span><input name="start" type="datetime-local" required></label><label class="field"><span>Конец</span><input name="end" type="datetime-local" required></label></div><label class="field"><span>Причина</span><input name="reason" placeholder="Отпуск, обучение, личное время..."></label><button class="btn secondary">Добавить исключение</button></form>':"")+'<div class="card"><h3>Исключения</h3>'+(off.length?off.map(x=>'<div class="spread schedule-off"><span><b>'+localDateTime(x.start_at)+'</b><span class="muted tiny"> → '+localDateTime(x.end_at)+(x.reason?" · "+esc(x.reason):"")+'</span></span>'+(manager?'<button class="btn danger sm" data-off="'+x.id+'">Удалить</button>':"")+'</div>').join(""):'<p class="muted tiny">Исключений нет.</p>')+'</div></div></div>';

    if(manager){
      const form=document.querySelector("#hoursForm");
      const resetHourForm=()=>{
        form.reset();form.elements.hour_id.value="";form.elements.start.value="09:00";form.elements.end.value="18:00";
        document.querySelector("#hoursFormTitle").textContent="Добавить рабочий интервал";
        document.querySelector("#hoursSubmit").textContent="Добавить интервал";
        document.querySelector("#cancelHourEdit").classList.add("hidden");
      };
      document.querySelector("#cancelHourEdit")?.addEventListener("click",resetHourForm);
      document.querySelectorAll("[data-edit-hour]").forEach(b=>b.addEventListener("click",()=>{
        const row=hours.find(x=>x.id===b.dataset.editHour);if(!row)return;
        form.elements.hour_id.value=row.id;form.elements.weekday.value=String(row.weekday);form.elements.start.value=row.start_time.slice(0,5);form.elements.end.value=row.end_time.slice(0,5);
        document.querySelector("#hoursFormTitle").textContent="Изменить рабочий интервал";
        document.querySelector("#hoursSubmit").textContent="Сохранить";
        document.querySelector("#cancelHourEdit").classList.remove("hidden");
        form.scrollIntoView({behavior:"smooth",block:"center"});
      }));
      form?.addEventListener("submit",async e=>{
        e.preventDefault();
        const f=new FormData(e.currentTarget),start=String(f.get("start")),end=String(f.get("end")),weekday=Number(f.get("weekday")),hourId=f.get("hour_id")||null;
        if(start>=end)return toast("Время окончания должно быть позже начала","error");
        const payload={staff_id:id,weekday,start_time:start,end_time:end};
        const query=hourId?sb.from("working_hours").update(payload).eq("id",hourId):sb.from("working_hours").insert(payload);
        const {error}=await query;
        if(error)return toast(String(error.message||"").includes("working hours overlap")?"Интервал пересекается с уже существующим":friendlyError(error),"error");
        toast(hourId?"Интервал изменён":"Интервал добавлен");load(id);
      });
      document.querySelector("#offForm")?.addEventListener("submit",async e=>{
        e.preventDefault();
        const f=new FormData(e.currentTarget),start=String(f.get("start")),end=String(f.get("end"));
        if(!start||!end||end<=start)return toast("Проверьте начало и конец исключения","error");
        try{
          await rpcRetry("create_time_off_local",{p_staff_id:id,p_local_start:start,p_local_end:end,p_reason:f.get("reason")||null},{attempts:1,timeout:8000});
          toast("Исключение добавлено");load(id);
        }catch(err){toast(friendlyError(err),"error")}
      });
      document.querySelectorAll("[data-off]").forEach(b=>b.addEventListener("click",async()=>{
        const {error}=await sb.from("time_off").delete().eq("id",b.dataset.off);
        if(error)toast(friendlyError(error),"error");else{toast("Исключение удалено");load(id)}
      }));
      document.querySelectorAll("[data-delete-hour]").forEach(b=>b.addEventListener("click",async()=>{
        const {error}=await sb.from("working_hours").delete().eq("id",b.dataset.deleteHour);
        if(error)toast(friendlyError(error),"error");else{toast("Рабочий интервал удалён");load(id)}
      }));
    }
  };
  document.querySelectorAll("[data-staff]").forEach(b=>b.addEventListener("click",()=>load(b.dataset.staff)));
  load(staff[0].id);
}

async function widgets(){
  if(!await requireAuth())return;
  const p=await profile();
  if(!["owner","admin"].includes(p.role))return shell("widgets","Виджеты",'<div class="notice error">Конструктор доступен владельцу и администратору.</div>');

  const [w,l,s,st]=await Promise.all([
    sb.from("booking_widgets").select("*").order("created_at"),
    sb.from("locations").select("id,name").eq("active",true).order("name"),
    sb.from("services").select("id,name").eq("active",true).order("name"),
    sb.from("staff_members").select("id,name").eq("active",true).order("name")
  ]);
  if(w.error||l.error||s.error||st.error){
    const e=w.error||l.error||s.error||st.error;
    return shell("widgets","Виджеты",'<div class="notice error">'+esc(friendlyError(e))+'</div>');
  }

  let list=w.data||[];
  if(!list.length){
    const {data,error}=await sb.from("booking_widgets").insert({
      organization_id:p.organization_id,
      name:"Основной виджет",
      title:"Онлайн-запись",
      subtitle:"Выберите услугу и удобное время"
    }).select("*").single();
    if(error)return shell("widgets","Виджеты",'<div class="notice error">'+esc(friendlyError(error))+'</div>');
    list=[data];
  }

  const content='<div class="page-head"><div><h1>Виджеты</h1><p>Настройте сценарий записи, оформление и способ установки на сайт.</p></div><div class="cluster"><span id="widgetSaveState" class="save-state saved">Сохранено</span><button class="btn brand" id="newWidget">+ Новый виджет</button></div></div>'+
    '<div class="widget-builder"><div class="stack"><div class="card"><label class="field"><span>Редактируемый виджет</span><select id="widgetSelect">'+list.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")+'</select></label></div><form id="widgetForm" class="card stack"></form><section id="widgetShare" class="card stack"></section></div>'+
    '<aside class="preview-device" id="previewDevice"><div class="preview-toolbar"><div class="segmented"><button type="button" class="active" data-preview-mode="desktop">Desktop</button><button type="button" data-preview-mode="mobile">Mobile</button></div><div class="segmented"><button type="button" class="active" data-preview-step="start">Начало</button><button type="button" data-preview-step="time">Время</button><button type="button" data-preview-step="contact">Контакты</button></div></div><div class="preview-screen" id="widgetPreview"></div></aside></div>';
  await shell("widgets","Виджеты",content);

  let selected=list[0],embedMode="floating",previewMode="desktop",previewStep="start",dirty=false;
  const loc=l.data||[],svc=s.data||[],staff=st.data||[];
  const form=document.querySelector("#widgetForm"),preview=document.querySelector("#widgetPreview"),share=document.querySelector("#widgetShare"),select=document.querySelector("#widgetSelect"),device=document.querySelector("#previewDevice"),saveState=document.querySelector("#widgetSaveState");

  const analytics=async()=>{
    try{
      const {data,error}=await sb.rpc("get_widget_analytics",{p_widget_id:selected.id});
      if(error)throw error;
      return data||{};
    }catch{return{}}
  };
  const pills=(items,ids,scope)=>'<div class="scope-pills" data-scope="'+scope+'">'+(items.length?items.map(x=>'<label class="scope-pill"><input type="checkbox" value="'+x.id+'" '+(ids.includes(x.id)?"checked":"")+'>'+esc(x.name)+'</label>').join(""):'<span class="muted tiny">Нет активных элементов</span>')+'</div>';
  const setDirty=value=>{
    dirty=value;
    saveState.textContent=value?"Есть несохранённые изменения":"Сохранено";
    saveState.className="save-state "+(value?"dirty":"saved");
  };
  const defaultConfig=()=>({
    title:"Онлайн-запись",
    subtitle:"Выберите услугу и удобное время",
    primary_color:"#5b5cf0",
    button_text:"Записаться",
    button_position:"bottom-right",
    panel_side:"right",
    open_mode:"drawer",
    button_animation:false,
    show_staff_step:true,
    allow_any_staff:true,
    show_branding:true,
    waitlist_enabled:true,
    step_preset:"location-first"
  });
  function collect(){
    const check=s=>[...form.querySelectorAll('[data-scope="'+s+'"] input:checked')].map(x=>x.value);
    return{
      organization_id:p.organization_id,
      name:form.elements.name.value.trim(),
      active:form.elements.active.value==="true",
      title:form.elements.title.value.trim()||"Онлайн-запись",
      subtitle:form.elements.subtitle.value.trim()||null,
      primary_color:form.elements.primary_color.value,
      button_text:form.elements.button_text.value.trim()||"Записаться",
      button_position:form.elements.button_position.value,
      panel_side:form.elements.panel_side.value,
      open_mode:form.elements.open_mode.value,
      button_animation:form.elements.button_animation.checked,
      show_staff_step:form.elements.show_staff_step.checked,
      allow_any_staff:form.elements.allow_any_staff.checked,
      show_branding:form.elements.show_branding.checked,
      waitlist_enabled:form.elements.waitlist_enabled.checked,
      location_ids:check("locations"),
      service_ids:check("services"),
      staff_ids:check("staff"),
      step_order:form.elements.step_preset.value==="service-first"?["service","location","staff","datetime"]:["location","service","staff","datetime"],
      updated_at:new Date().toISOString()
    };
  }
  function updatePreview(){
    if(!form.elements.name)return;
    const cfg=collect();
    preview.style.setProperty("--accent",cfg.primary_color);
    device.classList.toggle("mobile",previewMode==="mobile");
    let sample="";
    if(previewStep==="start"){
      sample='<span class="tiny muted">ШАГ 1</span><h3 style="margin:6px 0 14px">'+(cfg.step_order[0]==="service"?"Выберите услугу":"Выберите филиал")+'</h3><div class="stack"><button class="option active" type="button"><b>Основной вариант</b><small>Пример выбранного элемента</small></button><button class="option" type="button"><b>Другой вариант</b><small>Пример элемента</small></button></div><button class="btn brand" type="button" style="width:100%;margin-top:18px;background:'+cfg.primary_color+'">Продолжить</button>';
    }else if(previewStep==="time"){
      sample='<span class="tiny muted">ВЫБОР ВРЕМЕНИ</span><h3 style="margin:6px 0 14px">Выберите время</h3><div class="date-strip preview-dates"><button class="date-chip active" type="button"><span>ср</span><b>23</b></button><button class="date-chip" type="button"><span>чт</span><b>24</b></button><button class="date-chip" type="button"><span>пт</span><b>25</b></button></div><div class="slot-group"><div class="slot-group-title">Днём</div><div class="slot-grid"><button class="slot active" type="button">13:00</button><button class="slot" type="button">14:30</button><button class="slot" type="button">16:00</button></div></div>';
    }else{
      sample='<span class="tiny muted">КОНТАКТЫ</span><h3 style="margin:6px 0 14px">Контактные данные</h3><div class="summary"><b>Стрижка</b><div class="muted tiny">Основной филиал · 24 сентября, 14:30</div></div><div class="stack" style="margin-top:12px"><input placeholder="Ваше имя"><input placeholder="+7 999 000-00-00"><input placeholder="Email — необязательно"></div><button class="btn brand" type="button" style="width:100%;margin-top:18px;background:'+cfg.primary_color+'">Продолжить</button>';
    }
    preview.innerHTML='<div style="padding:14px"><div class="spread"><span class="avatar" style="background:'+cfg.primary_color+';color:white">L</span><span class="status '+(cfg.active?"confirmed":"canceled")+'">'+(cfg.active?"Активен":"Выключен")+'</span></div><h2 style="margin:22px 0 6px">'+esc(cfg.title)+'</h2><p class="muted">'+esc(cfg.subtitle||"Выберите услугу и удобное время")+'</p><div class="stepbar"><span style="width:'+(previewStep==="start"?"25":previewStep==="time"?"65":"88")+'%"></span></div><div style="padding-top:20px">'+sample+'</div>'+(cfg.show_branding?'<div class="tiny muted" style="text-align:center;margin-top:30px">Powered by Lootly</div>':"")+'</div>';
  }
  async function render(){
    const a=await analytics(),x=selected;
    form.innerHTML='<div class="card-title"><div><h2>Настройки</h2><p class="muted tiny">Preview справа обновляется сразу, публикация — после сохранения</p></div><span class="status '+(x.active?"confirmed":"canceled")+'">'+(x.active?"Активен":"Выключен")+'</span></div>'+
      '<section class="builder-section"><div class="builder-section-head"><span>01</span><div><b>Основное</b><small>Название, статус и тексты формы</small></div></div><div class="grid grid-2"><label class="field"><span>Название в кабинете</span><input name="name" value="'+esc(x.name)+'" required></label><label class="field"><span>Статус</span><select name="active"><option value="true">Активен</option><option value="false">Выключен</option></select></label></div><label class="field"><span>Заголовок формы</span><input name="title" value="'+esc(x.title||"Онлайн-запись")+'"></label><label class="field"><span>Подзаголовок</span><input name="subtitle" value="'+esc(x.subtitle||"")+'"></label></section>'+
      '<section class="builder-section"><div class="builder-section-head"><span>02</span><div><b>Оформление и запуск</b><small>Цвет, кнопка и способ открытия</small></div></div><div class="grid grid-3"><label class="field"><span>Цвет</span><input name="primary_color" type="color" value="'+esc(x.primary_color||"#111827")+'"></label><label class="field"><span>Текст кнопки</span><input name="button_text" value="'+esc(x.button_text||"Записаться")+'"></label><label class="field"><span>Первые шаги</span><select name="step_preset"><option value="location-first">Сначала филиал</option><option value="service-first">Сначала услуга</option></select></label></div><div class="grid grid-3"><label class="field"><span>Положение кнопки</span><select name="button_position"><option value="bottom-right">Справа снизу</option><option value="bottom-left">Слева снизу</option><option value="top-right">Справа сверху</option><option value="top-left">Слева сверху</option></select></label><label class="field"><span>Открытие</span><select name="open_mode"><option value="drawer">Боковая панель</option><option value="modal">Модальное окно</option></select></label><label class="field"><span>Сторона панели</span><select name="panel_side"><option value="right">Справа</option><option value="left">Слева</option></select></label></div></section>'+
      '<section class="builder-section"><div class="builder-section-head"><span>03</span><div><b>Сценарий записи</b><small>Что увидит клиент внутри виджета</small></div></div><div class="toggle-grid"><label class="toggle-card"><input name="button_animation" type="checkbox" '+(x.button_animation?"checked":"")+'><span><b>Анимация кнопки</b><small>Ненавязчиво привлекает внимание</small></span></label><label class="toggle-card"><input name="show_staff_step" type="checkbox" '+(x.show_staff_step?"checked":"")+'><span><b>Выбор специалиста</b><small>Показывать отдельный шаг</small></span></label><label class="toggle-card"><input name="allow_any_staff" type="checkbox" '+(x.allow_any_staff?"checked":"")+'><span><b>«Любой специалист»</b><small>Разрешить подобрать ближайшее время</small></span></label><label class="toggle-card"><input name="show_branding" type="checkbox" '+(x.show_branding?"checked":"")+'><span><b>Powered by Lootly</b><small>Показывать подпись сервиса</small></span></label><label class="toggle-card"><input name="waitlist_enabled" type="checkbox" '+(x.waitlist_enabled!==false?"checked":"")+'><span><b>Лист ожидания</b><small>Предлагать, если свободных окон нет</small></span></label></div></section>'+
      '<section class="builder-section"><div class="builder-section-head"><span>04</span><div><b>Доступность</b><small>Ограничьте содержимое конкретным виджетом</small></div></div><div><b>Филиалы</b><p class="muted tiny">Ничего не выбрано = все активные.</p>'+pills(loc,x.location_ids||[],"locations")+'</div><div><b>Услуги</b><p class="muted tiny">Ничего не выбрано = все активные.</p>'+pills(svc,x.service_ids||[],"services")+'</div><div><b>Сотрудники</b><p class="muted tiny">Ничего не выбрано = все подходящие.</p>'+pills(staff,x.staff_ids||[],"staff")+'</div></section>'+
      '<div class="builder-footer"><div class="cluster"><button class="btn brand">Сохранить изменения</button><button type="button" class="btn secondary" id="discardWidget">Вернуть сохранённые</button><button type="button" class="btn ghost" id="resetWidget">Сбросить оформление</button></div><button type="button" class="btn danger" id="deleteWidget">Удалить</button></div>';
    form.elements.active.value=String(x.active);
    form.elements.button_position.value=x.button_position||"bottom-right";
    form.elements.open_mode.value=x.open_mode||"drawer";
    form.elements.panel_side.value=x.panel_side||"right";
    form.elements.step_preset.value=(x.step_order||[])[0]==="service"?"service-first":"location-first";
    setDirty(false);
    updatePreview();
    await renderShare(a);
  }
  async function renderShare(a){
    const base="https://shevyakovys.github.io/Lootly",link=base+"/#/widget/"+selected.public_key;
    const snippets={
      floating:'<script src="'+base+'/embed.js" data-lootly-widget="'+selected.public_key+'" async><'+'/script>',
      inline:'<iframe src="'+link+'" style="width:100%;min-height:720px;border:0;border-radius:16px" loading="lazy"></iframe>',
      link
    };
    share.innerHTML='<div class="card-title"><div><h2>Публикация</h2><p class="muted tiny">Выберите способ установки</p></div></div><div class="funnel"><div class="funnel-item"><b>'+Number(a.views||0)+'</b><span>просмотров</span></div><div class="funnel-item"><b>'+Number(a.opens||0)+'</b><span>открытий</span></div><div class="funnel-item"><b>'+Number(a.bookings||0)+'</b><span>записей</span></div></div><div class="embed-mode"><button type="button" class="embed-choice '+(embedMode==="floating"?"active":"")+'" data-embed="floating">Плавающая кнопка</button><button type="button" class="embed-choice '+(embedMode==="inline"?"active":"")+'" data-embed="inline">Inline</button><button type="button" class="embed-choice '+(embedMode==="link"?"active":"")+'" data-embed="link">Прямая ссылка</button></div><textarea id="embedCode" class="codebox" readonly>'+esc(snippets[embedMode])+'</textarea><div class="cluster"><button class="btn secondary" id="copyEmbed" type="button">Копировать</button><a class="btn secondary" target="_blank" rel="noopener" href="'+link+'">Открыть форму ↗</a></div><div class="notice info">Конверсия открытия → запись: <b>'+Math.round(Number(a.booking_conversion||0)*100)+'%</b></div>';
    document.querySelectorAll("[data-embed]").forEach(b=>b.addEventListener("click",()=>{embedMode=b.dataset.embed;renderShare(a)}));
    document.querySelector("#copyEmbed")?.addEventListener("click",async()=>{
      const value=document.querySelector("#embedCode").value;
      try{
        if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);
        else{
          const area=document.querySelector("#embedCode");area.focus();area.select();
          if(!document.execCommand("copy"))throw new Error("copy failed");
        }
        toast("Код скопирован");
      }catch{toast("Не удалось скопировать автоматически. Выделите код вручную.","error")}
    });
  }

  select.addEventListener("change",()=>{
    if(dirty&&!confirm("Есть несохранённые изменения. Переключиться без сохранения?")){select.value=selected.id;return}
    selected=list.find(x=>x.id===select.value)||list[0];render();
  });
  form.addEventListener("input",()=>{setDirty(true);updatePreview()});
  form.addEventListener("change",()=>{setDirty(true);updatePreview()});
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const submit=form.querySelector('button[type="submit"]');
    submit.disabled=true;submit.textContent="Сохраняем…";
    const {data,error}=await sb.from("booking_widgets").update(collect()).eq("id",selected.id).select("*").single();
    submit.disabled=false;submit.textContent="Сохранить изменения";
    if(error)return toast(friendlyError(error),"error");
    selected=data;list=list.map(x=>x.id===data.id?data:x);
    const option=select.querySelector('option[value="'+data.id+'"]');if(option)option.textContent=data.name;
    toast("Настройки сохранены");render();
  });
  form.addEventListener("click",async e=>{
    if(e.target.id==="discardWidget"){if(dirty&&confirm("Вернуть последние сохранённые настройки?"))render();return}
    if(e.target.id==="resetWidget"){
      if(!confirm("Сбросить оформление и сценарий к базовым значениям? Изменения не сохранятся автоматически."))return;
      const d=defaultConfig();
      Object.entries(d).forEach(([key,value])=>{
        const el=form.elements[key];if(!el)return;
        if(el.type==="checkbox")el.checked=Boolean(value);else el.value=String(value);
      });
      setDirty(true);updatePreview();toast("Базовые настройки применены. Нажмите «Сохранить изменения».");return;
    }
    if(e.target.id!=="deleteWidget")return;
    if(list.length===1)return toast("Нужен хотя бы один виджет","error");
    if(!confirm("Удалить этот виджет? Код вставки перестанет работать."))return;
    const {error}=await sb.from("booking_widgets").delete().eq("id",selected.id);
    if(error)return toast(friendlyError(error),"error");
    list=list.filter(x=>x.id!==selected.id);selected=list[0];
    select.innerHTML=list.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("");
    select.value=selected.id;toast("Виджет удалён");render();
  });
  document.querySelector("#newWidget").addEventListener("click",async()=>{
    if(dirty&&!confirm("Есть несохранённые изменения. Создать новый виджет без их сохранения?"))return;
    const {data,error}=await sb.from("booking_widgets").insert({organization_id:p.organization_id,name:"Новый виджет",title:"Онлайн-запись",subtitle:"Выберите услугу и удобное время"}).select("*").single();
    if(error)return toast(friendlyError(error),"error");
    list.push(data);selected=data;select.insertAdjacentHTML("beforeend",'<option value="'+data.id+'">'+esc(data.name)+'</option>');select.value=data.id;toast("Новый виджет создан");render();
  });
  document.querySelectorAll("[data-preview-mode]").forEach(b=>b.addEventListener("click",()=>{
    previewMode=b.dataset.previewMode;
    document.querySelectorAll("[data-preview-mode]").forEach(x=>x.classList.toggle("active",x===b));updatePreview();
  }));
  document.querySelectorAll("[data-preview-step]").forEach(b=>b.addEventListener("click",()=>{
    previewStep=b.dataset.previewStep;
    document.querySelectorAll("[data-preview-step]").forEach(x=>x.classList.toggle("active",x===b));updatePreview();
  }));
  addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue=""}});
  render();
}

async function settings(){
  if(!await requireAuth())return;
  const o=await org(),p=await profile(),manager=["owner","admin"].includes(p.role),booking="https://shevyakovys.github.io/Lootly/#/book/"+o.slug;
  const [staffRes,inviteRes,profilesRes]=await Promise.all([
    sb.from("staff_members").select("id,name").eq("active",true).order("name"),
    manager?sb.from("user_invites").select("*").order("created_at",{ascending:false}).limit(20):Promise.resolve({data:[]}),
    sb.from("profiles").select("id,email,role,staff_id,active").order("created_at")
  ]);
  const loadError=staffRes.error||inviteRes.error||profilesRes.error;
  if(loadError)return shell("settings","Настройки",'<div class="notice error">'+esc(friendlyError(loadError))+'</div>');
  const staff=staffRes.data||[],invites=inviteRes.data||[],profiles=profilesRes.data||[];
  const team=profiles.map(x=>'<div class="spread" style="padding:12px 0;border-bottom:1px solid var(--line)"><div class="person"><span class="avatar">'+initials(x.email)+'</span><div><b>'+esc(x.email)+'</b><small>'+esc(x.role)+'</small></div></div><span class="status '+(x.active?"confirmed":"canceled")+'">'+(x.active?"Активен":"Выключен")+'</span></div>').join("");
  const inviteForm=manager?'<form id="inviteForm" class="card stack"><div class="card-title"><div><h2>Пригласить в команду</h2><p class="muted tiny">Создайте одноразовую ссылку для администратора или сотрудника.</p></div></div><div class="grid grid-2"><label class="field"><span>Роль</span><select name="role"><option value="admin">Администратор</option><option value="staff">Сотрудник</option></select></label><label class="field"><span>Связать с сотрудником</span><select name="staff"><option value="">Не связывать</option>'+staff.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")+'</select></label></div><button class="btn brand">Создать ссылку</button><div id="inviteResult"></div></form>':"";
  const inviteList=manager&&invites.length?'<section class="card"><div class="card-title"><h2>Активные приглашения</h2></div>'+invites.map(i=>'<div class="spread" style="padding:10px 0;border-bottom:1px solid var(--line)"><div><b>'+esc(i.role)+'</b><div class="muted tiny">до '+dt(i.expires_at)+'</div></div><button class="btn secondary sm" data-copy-invite="'+i.token+'">Копировать</button></div>').join("")+'</section>':"";
  const intervalPresets=[5,10,15,20,30,45,60];
  const bookingPrefs='<section class="card stack"><div><h2>Правила онлайн-записи</h2><p class="muted tiny">Шаг старта, длительность услуги и сетка календаря — независимые настройки.</p></div><div class="grid grid-3"><label class="field"><span>Шаг начала, мин</span><input id="bookingInterval" type="number" min="1" max="120" step="1" value="'+Number(o.booking_interval_minutes||15)+'" '+(manager?"":"disabled")+'><small>Например, 10 → 09:00, 09:10, 09:20…</small><div class="interval-presets">'+intervalPresets.map(v=>'<button type="button" class="interval-preset" data-interval-preset="'+v+'" '+(manager?"":"disabled")+'>'+v+'</button>').join("")+'</div></label><label class="field"><span>Горизонт, дней</span><input id="bookingHorizon" type="number" min="1" max="365" value="'+Number(o.booking_horizon_days||60)+'" '+(manager?"":"disabled")+'><small>Насколько далеко вперёд можно записаться.</small></label><label class="field"><span>Минимум до записи, мин</span><input id="bookingNotice" type="number" min="0" max="10080" step="1" value="'+Number(o.min_booking_notice_minutes||0)+'" '+(manager?"":"disabled")+'><small>Например, 120 = не позднее чем за 2 часа.</small></label></div><div class="notice info"><b>Пример:</b> услуга длится 1 ч 20 мин, шаг старта 15 мин. Клиент может выбрать 09:00, 09:15, 09:30… Каждая запись при этом занимает полные 80 минут, а пересекающиеся варианты автоматически исключаются.</div>'+(manager?'<button class="btn brand" id="saveBookingPolicy">Сохранить правила записи</button>':'')+'</section>';
  const content='<div class="page-head"><div><h1>Настройки</h1><p>Онлайн-запись, публичные ссылки, команда и доступ.</p></div></div><div class="grid grid-2"><section class="card stack"><div><h2>'+esc(o.name)+'</h2><p class="muted">Организация · '+esc(p.role)+'</p></div><label class="field"><span>Публичная ссылка</span><input id="publicLink" readonly value="'+esc(booking)+'"></label><button class="btn secondary" id="copyPublic">Скопировать ссылку</button></section>'+bookingPrefs+'</div><section class="grid grid-2" style="margin-top:16px"><section class="card"><h2>Быстрый старт</h2><div class="checklist"><a class="checkitem" href="#/catalog"><span class="checkdot">1</span>Настройте услуги и сотрудников</a><a class="checkitem" href="#/schedule"><span class="checkdot">2</span>Заполните рабочее время</a><a class="checkitem" href="#/widgets"><span class="checkdot">3</span>Создайте виджет для сайта</a></div></section><div class="card"><div class="card-title"><h2>Команда</h2></div>'+(team||emptyState("Пока никого","Пригласите первого участника команды."))+'</div></section><section class="grid grid-2" style="margin-top:16px">'+inviteForm+inviteList+'</section>';
  await shell("settings","Настройки",content);
  document.querySelector("#copyPublic")?.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(booking);toast("Ссылка скопирована")}catch{toast("Не удалось скопировать автоматически","error")}});
  document.querySelector("#saveBookingPolicy")?.addEventListener("click",async e=>{
    const btn=e.currentTarget,minutes=Number(document.querySelector("#bookingInterval").value),horizon=Number(document.querySelector("#bookingHorizon").value),notice=Number(document.querySelector("#bookingNotice").value);
    if(!Number.isInteger(minutes)||minutes<1||minutes>120)return toast("Шаг начала должен быть целым числом от 1 до 120 минут","error");
    if(horizon<1||horizon>365)return toast("Горизонт должен быть от 1 до 365 дней","error");
    if(notice<0||notice>10080)return toast("Минимальное время — от 0 до 10080 минут","error");
    btn.disabled=true;btn.textContent="Сохраняем…";
    try{
      await rpcRetry("set_booking_policy",{p_interval_minutes:minutes,p_horizon_days:horizon,p_min_notice_minutes:notice},{attempts:1,timeout:8000});
      Object.assign(o,{booking_interval_minutes:minutes,booking_horizon_days:horizon,min_booking_notice_minutes:notice});
      if(currentOrg)Object.assign(currentOrg,o);
      toast("Правила онлайн-записи сохранены");
    }catch(err){toast(friendlyError(err),"error")}
    finally{btn.disabled=false;btn.textContent="Сохранить правила записи"}
  });
  document.querySelectorAll("[data-interval-preset]").forEach(b=>b.addEventListener("click",()=>{
    const input=document.querySelector("#bookingInterval");if(input)input.value=b.dataset.intervalPreset;
  }));
  document.querySelector("#inviteForm")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget),role=f.get("role"),staffId=f.get("staff")||null;if(role==="staff"&&!staffId)return toast("Для роли сотрудника выберите сотрудника","error");const {data,error}=await sb.from("user_invites").insert({organization_id:p.organization_id,role,staff_id:staffId}).select("token").single();if(error)return toast(friendlyError(error),"error");const link=location.href.split("#")[0]+"#/join/"+data.token;document.querySelector("#inviteResult").innerHTML='<div class="notice success">Ссылка создана. <button type="button" id="copyNewInvite" class="btn ghost sm">Копировать</button></div>';document.querySelector("#copyNewInvite").onclick=async()=>{await navigator.clipboard.writeText(link);toast("Ссылка приглашения скопирована")}});
  document.querySelectorAll("[data-copy-invite]").forEach(b=>b.addEventListener("click",async()=>{const link=location.href.split("#")[0]+"#/join/"+b.dataset.copyInvite;await navigator.clipboard.writeText(link);toast("Ссылка приглашения скопирована")}));
}

async function publicWidget(key){return bookingExperience({widgetKey:key})}
async function publicBook(slug){return bookingExperience({slug})}
async function bookingExperience({widgetKey=null,slug=null}){
  const initial=()=>{app.innerHTML='<div class="booking-shell"><div class="booking-card"><div class="booking-head"><div class="skeleton" style="width:70px;height:12px"></div><div class="skeleton" style="width:55%;height:28px;margin-top:12px"></div></div><div class="booking-body"><div class="skeleton" style="height:4px;margin:8px 0 26px"></div><div class="skeleton" style="height:72px;margin-bottom:10px"></div><div class="skeleton" style="height:72px"></div></div></div></div>'};
  const showError=(title,text,retry=true)=>{app.innerHTML='<div class="booking-shell"><div class="booking-card"><div class="widget-error"><div class="widget-error-icon">!</div><h2>'+esc(title)+'</h2><p class="muted">'+esc(text)+'</p>'+(retry?'<button class="btn secondary" id="widgetRetry">Попробовать снова</button>':'')+'</div></div></div>';if(retry)document.querySelector("#widgetRetry")?.addEventListener("click",()=>bookingExperience({widgetKey,slug}))};
  initial();

  let data;
  try{
    data=widgetKey
      ? await rpcRetry("get_public_widget",{p_public_key:widgetKey},{attempts:3,timeout:8000})
      : await rpcRetry("get_public_catalog",{p_slug:slug},{attempts:3,timeout:8000});
  }catch(err){
    if(widgetKey)window.parent?.postMessage({type:"lootly:error",stage:"init",message:friendlyError(err),widgetKey},"*");
    showError("Не удалось открыть запись",friendlyError(err),true);return;
  }
  if(!data){showError("Форма недоступна","Проверьте ссылку или попробуйте позже.",true);return}

  const cfg=widgetKey?data.widget:{title:data.organization.name,subtitle:"Онлайн-запись",primary_color:"#5b5cf0",show_staff_step:true,allow_any_staff:true,show_branding:true,waitlist_enabled:false,step_order:["location","service","staff","datetime"]};
  const locs=data.locations||[],services=data.services||[],bookingHorizon=Math.max(1,Number(data.organization?.booking_horizon_days||60));
  if(!locs.length){showError("Запись ещё не настроена","У бизнеса пока нет активного филиала для онлайн-записи.",false);return}
  if(!services.length){showError("Запись ещё не настроена","У бизнеса пока нет активных услуг для онлайн-записи.",false);return}

  const sessionKey="lootly_"+(widgetKey||data.organization.slug);
  let sk;try{sk=sessionStorage.getItem(sessionKey);if(!sk){sk=crypto.randomUUID();sessionStorage.setItem(sessionKey,sk)}}catch{sk=crypto.randomUUID()}
  if(widgetKey)rpcRetry("track_widget_event",{p_public_key:widgetKey,p_session_key:sk,p_event_type:"view"},{attempts:1,timeout:4000}).catch(()=>{});
  else rpcRetry("track_public_booking_view",{p_slug:data.organization.slug,p_session_key:sk},{attempts:1,timeout:4000}).catch(()=>{});
  if(widgetKey)window.parent?.postMessage({type:"lootly:ready",widgetKey},"*");

  const isoDateInZone=(date,tz)=>{
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:tz||"UTC",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
    const get=type=>parts.find(x=>x.type===type)?.value;
    return get("year")+"-"+get("month")+"-"+get("day");
  };
  const addIsoDays=(iso,days)=>{const d=new Date(iso+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
  const initialLocation=locs.length===1?locs[0]:null;
  const state={
    location:initialLocation,
    service:services.length===1?services[0]:null,
    staff:null,staffList:[],staffLoaded:false,
    date:initialLocation?isoDateInZone(new Date(),initialLocation.timezone):todayIso(),
    dateOffset:0,slots:[],slotsLoadedFor:null,slot:null,index:0,busy:false,loadError:null,contact:{name:"",phone:"",email:""}
  };
  const bookingTz=()=>state.location?.timezone||locs[0]?.timezone||"UTC";
  const slotTime=value=>new Intl.DateTimeFormat("ru-RU",{timeZone:bookingTz(),hour:"2-digit",minute:"2-digit"}).format(new Date(value));
  const slotHour=value=>{
    const part=new Intl.DateTimeFormat("en-US",{timeZone:bookingTz(),hour:"2-digit",hourCycle:"h23"}).formatToParts(new Date(value)).find(x=>x.type==="hour");
    return Number(part?.value||0);
  };
  const slotDateTime=value=>new Intl.DateTimeFormat("ru-RU",{timeZone:bookingTz(),day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value));

  let steps=(cfg.step_order||["location","service","staff","datetime"]).filter(x=>x!=="staff"||cfg.show_staff_step);
  steps=steps.filter((x,i,a)=>a.indexOf(x)===i);
  ["location","service","datetime"].forEach(x=>{if(!steps.includes(x))steps.push(x)});
  if(locs.length===1)steps=steps.filter(x=>x!=="location");
  if(services.length===1)steps=steps.filter(x=>x!=="service");
  steps.push("contact");

  async function staffLoad(){
    if(!state.location||!state.service)return;
    state.loadError=null;
    try{
      state.staffList=widgetKey
        ? await rpcRetry("get_public_widget_staff",{p_public_key:widgetKey,p_location_id:state.location.id,p_service_id:state.service.id},{attempts:2})
        : await rpcRetry("get_public_staff",{p_slug:data.organization.slug,p_location_id:state.location.id,p_service_id:state.service.id},{attempts:2});
      state.staffLoaded=true;
    }catch(err){state.loadError=friendlyError(err);throw err}
  }
  async function slotsLoad(){
    if(!state.location||!state.service)return;
    state.loadError=null;state.slot=null;
    const loadKey=[state.date,state.location?.id,state.service?.id,state.staff?.id||"any"].join("|");
    const args=widgetKey
      ? {p_public_key:widgetKey,p_location_id:state.location.id,p_service_id:state.service.id,p_day:state.date,p_staff_id:state.staff?.id||null}
      : {p_slug:data.organization.slug,p_location_id:state.location.id,p_service_id:state.service.id,p_day:state.date,p_staff_id:state.staff?.id||null};
    try{
      state.slots=widgetKey
        ? await rpcRetry("get_public_widget_availability",args,{attempts:2})
        : await rpcRetry("get_public_availability",args,{attempts:2});
      state.slotsLoadedFor=loadKey;
    }catch(err){state.loadError=friendlyError(err);state.slots=[];throw err}
  }
  const dateChips=()=>{
    const base=addIsoDays(isoDateInZone(new Date(),bookingTz()),state.dateOffset);
    return Array.from({length:7},(_,i)=>i).filter(i=>state.dateOffset+i<=bookingHorizon).map(i=>{const iso=addIsoDays(base,i),x=new Date(iso+"T12:00:00Z");return '<button type="button" class="date-chip '+(state.date===iso?"active":"")+'" data-date="'+iso+'"><span>'+x.toLocaleDateString("ru-RU",{weekday:"short",timeZone:"UTC"})+'</span><b>'+x.getUTCDate()+'</b></button>'}).join("");
  };
  const staffVisual=x=>x.avatar_url?'<img class="staff-photo" src="'+esc(x.avatar_url)+'" alt="" loading="lazy">':'<span class="avatar">'+initials(x.name)+'</span>';
  const groupedServices=()=>{
    const groups=new Map();
    services.forEach(s=>{const key=s.category_name||"Услуги";if(!groups.has(key))groups.set(key,[]);groups.get(key).push(s)});
    return [...groups.entries()].map(([name,items])=>'<div style="margin-bottom:18px"><div class="tiny muted" style="font-weight:800;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">'+esc(name)+'</div><div class="option-grid">'+items.map(x=>'<button type="button" class="option '+(state.service?.id===x.id?"active":"")+'" data-service="'+x.id+'"><b>'+esc(x.name)+'</b><small>'+durationLabel(x.duration_minutes)+' · '+money(x.price)+'</small></button>').join("")+'</div></div>').join("");
  };

  async function render(){
    const step=steps[state.index];
    try{
      if(step==="staff"&&state.location&&state.service&&!state.staffLoaded)await staffLoad();
      const slotKey=[state.date,state.location?.id,state.service?.id,state.staff?.id||"any"].join("|");
      if(step==="datetime"&&state.location&&state.service&&state.slotsLoadedFor!==slotKey&&!state.loadError)await slotsLoad();
    }catch(err){/* render localized error below */}

    let body="";
    if(step==="location"){
      body='<div class="option-grid">'+locs.map(x=>'<button type="button" class="option '+(state.location?.id===x.id?"active":"")+'" data-location="'+x.id+'"><b>'+esc(x.name)+'</b><small>'+esc(x.address||"Адрес не указан")+'</small></button>').join("")+'</div>';
    }
    if(step==="service")body=groupedServices();
    if(step==="staff"){
      if(state.loadError)body='<div class="notice error">'+esc(state.loadError)+'</div><button type="button" class="btn secondary" id="retryStaff">Повторить</button>';
      else if(!state.staffList.length&&!cfg.allow_any_staff)body='<div class="empty-specialists"><b>Нет доступных специалистов</b><span class="muted tiny">Для выбранных услуги и филиала сейчас никто не доступен. Вернитесь назад и измените выбор.</span></div>';
      else body='<div class="option-grid">'+(cfg.allow_any_staff?'<button type="button" class="option '+(!state.staff?"active":"")+'" data-staff=""><div class="person"><span class="avatar">★</span><div><b>Любой специалист</b><small>Подберём ближайшее время</small></div></div></button>':"")+state.staffList.map(x=>'<button type="button" class="option '+(state.staff?.id===x.id?"active":"")+'" data-staff="'+x.id+'"><div class="person">'+staffVisual(x)+'<div><b>'+esc(x.name)+'</b><small>Специалист · '+durationLabel(x.duration_minutes||state.service?.duration_minutes)+'</small></div></div></button>').join("")+'</div>';
    }
    if(step==="datetime"){
      let slotsPart="";
      if(state.loadError)slotsPart='<div class="notice error">'+esc(state.loadError)+'</div><button type="button" class="btn secondary" id="retrySlots">Повторить загрузку</button>';
      else if(state.slots.length){
        const groups=[["Утро",x=>slotHour(x.start_at)<12],["Днём",x=>{const h=slotHour(x.start_at);return h>=12&&h<17}],["Вечером",x=>slotHour(x.start_at)>=17]];
        slotsPart=groups.map(([title,test])=>{const items=state.slots.map((x,i)=>({x,i})).filter(({x})=>test(x));return items.length?'<div class="slot-section"><div class="slot-section-title">'+title+'</div><div class="slot-grid">'+items.map(({x,i})=>'<button type="button" class="slot '+(state.slot===i?"active":"")+'" data-slot="'+i+'">'+slotTime(x.start_at)+'</button>').join("")+'</div></div>':""}).join("");
      }
      else slotsPart='<div class="muted" style="padding:18px 0">На этот день свободных окон нет.</div>'+(widgetKey&&cfg.waitlist_enabled?'<div class="waitlist-box"><b>Хотите, чтобы вам написали при появлении окна?</b><p class="muted tiny">Оставьте контакты — заявка попадёт администратору.</p><form id="waitlistForm" class="stack"><input name="name" placeholder="Имя" required><input name="phone" type="tel" placeholder="Телефон" required><input name="email" type="email" placeholder="Email — необязательно"><button class="btn secondary">Встать в лист ожидания</button><div id="waitlistResult"></div></form></div>':"");
      const windowStart=addIsoDays(isoDateInZone(new Date(),bookingTz()),state.dateOffset),windowEnd=addIsoDays(isoDateInZone(new Date(),bookingTz()),Math.min(bookingHorizon,state.dateOffset+6));
      const windowLabel=new Date(windowStart+"T12:00:00Z").toLocaleDateString("ru-RU",{day:"numeric",month:"short",timeZone:"UTC"})+" — "+new Date(windowEnd+"T12:00:00Z").toLocaleDateString("ru-RU",{day:"numeric",month:"short",timeZone:"UTC"});
      body='<div class="booking-date-nav"><button type="button" class="btn ghost sm" id="datePrev" '+(state.dateOffset===0?"disabled":"")+'>←</button><b>'+windowLabel+'</b><button type="button" class="btn ghost sm" id="dateNext" '+(state.dateOffset+7>bookingHorizon?"disabled":"")+'>→</button></div><div class="date-strip">'+dateChips()+'</div>'+slotsPart;
    }
    if(step==="contact"){
      const chosen=state.slots[state.slot];
      body='<form id="contactForm" class="stack"><div class="summary"><b>'+esc(state.service?.name||"")+'</b><div class="muted tiny" style="margin-top:4px">'+esc(state.location?.name||"")+' · '+(chosen?slotDateTime(chosen.start_at):"")+(state.staff?" · "+esc(state.staff.name):"")+'</div></div><label class="field"><span>Ваше имя</span><input name="name" autocomplete="name" value="'+esc(state.contact.name)+'" required><span class="field-error" data-error="name"></span></label><label class="field"><span>Телефон</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" value="'+esc(state.contact.phone)+'" placeholder="+7 999 000-00-00" required><span class="field-error" data-error="phone"></span></label><label class="field"><span>Email <span class="muted">(необязательно)</span></span><input name="email" type="email" autocomplete="email" value="'+esc(state.contact.email)+'"><span class="field-error" data-error="email"></span></label><div class="contact-actions"><button type="button" class="btn secondary" id="contactBack">Назад</button><button class="btn brand" id="bookSubmit" style="background:'+cfg.primary_color+'">Подтвердить запись</button></div><div id="bookResult"></div></form>';
    }

    const titles={location:"Выберите филиал",service:"Выберите услугу",staff:"К кому записаться?",datetime:"Выберите время",contact:"Контактные данные"};
    const subs={location:"Где вам удобнее?",service:"Что хотите записать?",staff:"Можно выбрать специалиста или ближайшее доступное время.",datetime:"Показываем только реально свободные окна.",contact:"Проверьте детали и подтвердите запись."};
    app.innerHTML='<div class="booking-shell" style="--accent:'+esc(cfg.primary_color)+'"><div class="booking-card"><div class="booking-head"><div class="spread"><div><div class="tiny muted">'+esc(data.organization.name)+'</div><h2 style="margin:5px 0 0">'+esc(cfg.title||"Онлайн-запись")+'</h2></div><span class="tiny muted">'+(state.index+1)+'/'+steps.length+'</span></div><p class="muted tiny" style="margin-top:7px">'+esc(cfg.subtitle||"")+'</p></div><div class="stepbar"><span style="width:'+Math.round((state.index+1)/steps.length*100)+'%"></span></div><div class="booking-body"><div style="padding-top:22px"><h2>'+titles[step]+'</h2><p class="muted">'+subs[step]+'</p>'+body+'</div>'+(step!=="contact"?'<div class="booking-actions">'+(state.index?'<button class="btn secondary" id="back">Назад</button>':'<span></span>')+'<button class="btn brand" id="next" style="background:'+cfg.primary_color+'" '+((step==="datetime"&&!state.slots.length)?"disabled":"")+'>Продолжить</button></div>':'')+(cfg.show_branding?'<div class="tiny muted" style="text-align:center;margin-top:24px">Powered by Lootly</div>':'')+'</div></div></div>';

    document.querySelector("#back")?.addEventListener("click",()=>{state.index=Math.max(0,state.index-1);state.loadError=null;render()});
    document.querySelectorAll("[data-location]").forEach(b=>b.addEventListener("click",()=>{state.location=locs.find(x=>x.id===b.dataset.location);state.dateOffset=0;state.date=isoDateInZone(new Date(),bookingTz());state.staff=null;state.staffList=[];state.staffLoaded=false;state.slots=[];state.slotsLoadedFor=null;state.loadError=null;render()}));
    document.querySelectorAll("[data-service]").forEach(b=>b.addEventListener("click",()=>{state.service=services.find(x=>x.id===b.dataset.service);state.staff=null;state.staffList=[];state.staffLoaded=false;state.slots=[];state.slotsLoadedFor=null;state.loadError=null;render()}));
    document.querySelectorAll("[data-staff]").forEach(b=>b.addEventListener("click",()=>{state.staff=b.dataset.staff?state.staffList.find(x=>x.id===b.dataset.staff):null;state.slots=[];state.slotsLoadedFor=null;state.loadError=null;render()}));
    document.querySelector("#datePrev")?.addEventListener("click",()=>{state.dateOffset=Math.max(0,state.dateOffset-7);state.date=addIsoDays(isoDateInZone(new Date(),bookingTz()),state.dateOffset);state.slots=[];state.slotsLoadedFor=null;state.loadError=null;render()});
    document.querySelector("#dateNext")?.addEventListener("click",()=>{state.dateOffset=Math.min(bookingHorizon,state.dateOffset+7);state.date=addIsoDays(isoDateInZone(new Date(),bookingTz()),state.dateOffset);state.slots=[];state.slotsLoadedFor=null;state.loadError=null;render()});
    document.querySelectorAll("[data-date]").forEach(b=>b.addEventListener("click",async()=>{state.date=b.dataset.date;state.slots=[];state.slotsLoadedFor=null;state.loadError=null;try{await slotsLoad()}catch{}render()}));
    document.querySelectorAll("[data-slot]").forEach(b=>b.addEventListener("click",()=>{state.slot=Number(b.dataset.slot);render()}));
    document.querySelector("#retryStaff")?.addEventListener("click",async()=>{state.loadError=null;state.staffList=[];state.staffLoaded=false;render()});
    document.querySelector("#retrySlots")?.addEventListener("click",async()=>{state.loadError=null;state.slots=[];state.slotsLoadedFor=null;render()});

    document.querySelector("#next")?.addEventListener("click",async()=>{
      if(step==="location"&&!state.location)return toast("Выберите филиал","error");
      if(step==="service"&&!state.service)return toast("Выберите услугу","error");
      if(step==="staff"&&!cfg.allow_any_staff&&!state.staff)return toast("Выберите специалиста","error");
      if(step==="datetime"&&state.slot===null)return toast("Выберите время","error");
      state.index=Math.min(steps.length-1,state.index+1);state.loadError=null;render();
    });

    document.querySelector("#contactBack")?.addEventListener("click",()=>{state.index=Math.max(0,state.index-1);state.loadError=null;render()});
    document.querySelector("#contactForm")?.addEventListener("input",e=>{
      if(!e.target?.name)return;
      state.contact[e.target.name]=e.target.value;
      e.target.classList.remove("input-invalid");
      const error=document.querySelector('[data-error="'+e.target.name+'"]');if(error)error.textContent="";
    });

    document.querySelector("#waitlistForm")?.addEventListener("submit",async e=>{
      e.preventDefault();const form=e.currentTarget,out=document.querySelector("#waitlistResult"),btn=form.querySelector("button"),fd=new FormData(form);
      btn.disabled=true;btn.textContent="Отправляем…";
      try{
        await rpcRetry("create_public_widget_waitlist",{p_public_key:widgetKey,p_location_id:state.location.id,p_service_id:state.service.id,p_staff_id:state.staff?.id||null,p_customer_name:fd.get("name"),p_customer_phone:fd.get("phone"),p_customer_email:fd.get("email")||null,p_desired_date:state.date,p_note:null},{attempts:1,timeout:9000});
        out.innerHTML='<div class="notice success">Готово. Администратор увидит вашу заявку.</div>';btn.remove();
      }catch(err){out.innerHTML='<div class="notice error">'+esc(friendlyError(err))+'</div>';btn.disabled=false;btn.textContent="Встать в лист ожидания"}
    });

    document.querySelector("#contactForm")?.addEventListener("submit",async e=>{
      e.preventDefault();
      const form=e.currentTarget,fd=new FormData(form),chosen=state.slots[state.slot],staffId=state.staff?.id||chosen?.staff_id,btn=document.querySelector("#bookSubmit"),out=document.querySelector("#bookResult");
      if(!chosen)return;
      state.contact={name:String(fd.get("name")||"").trim(),phone:String(fd.get("phone")||"").trim(),email:String(fd.get("email")||"").trim()};
      const errors={};
      if(state.contact.name.length<2)errors.name="Укажите имя.";
      const digits=state.contact.phone.replace(/\D/g,"");
      if(digits.length<10)errors.phone="Проверьте номер телефона.";
      if(state.contact.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.contact.email))errors.email="Проверьте email.";
      Object.entries(errors).forEach(([name,message])=>{const input=form.elements[name],error=form.querySelector('[data-error="'+name+'"]');input?.classList.add("input-invalid");if(error)error.textContent=message});
      if(Object.keys(errors).length){out.innerHTML='<div class="notice error">Проверьте отмеченные поля.</div>';return}
      btn.disabled=true;btn.textContent="Создаём запись…";out.innerHTML="";
      const bookingKey=crypto.randomUUID();
      const args=widgetKey
        ? {p_public_key:widgetKey,p_location_id:state.location.id,p_service_id:state.service.id,p_staff_id:staffId,p_start_at:chosen.start_at,p_customer_name:fd.get("name"),p_customer_phone:fd.get("phone"),p_customer_email:fd.get("email")||null,p_note:null,p_booking_key:bookingKey}
        : {p_slug:data.organization.slug,p_location_id:state.location.id,p_service_id:state.service.id,p_staff_id:staffId,p_start_at:chosen.start_at,p_customer_name:fd.get("name"),p_customer_phone:fd.get("phone"),p_customer_email:fd.get("email")||null,p_note:null,p_booking_key:bookingKey};
      try{
        const booking=widgetKey
          ? await rpcRetry("create_public_widget_booking",args,{attempts:1,timeout:12000})
          : await rpcRetry("create_public_booking",args,{attempts:1,timeout:12000});
        if(widgetKey)rpcRetry("track_widget_event",{p_public_key:widgetKey,p_session_key:sk,p_event_type:"booking"},{attempts:1,timeout:4000}).catch(()=>{});
        if(widgetKey)window.parent?.postMessage({type:"lootly:booking-complete",widgetKey,bookingId:booking.id,startAt:booking.start_at},"*");
        app.innerHTML='<div class="booking-shell" style="--accent:'+esc(cfg.primary_color)+'"><div class="booking-card"><div class="booking-body" style="padding-top:60px;text-align:center"><div style="width:64px;height:64px;border-radius:50%;background:var(--success-soft);color:var(--success);display:grid;place-items:center;font-size:30px;margin:0 auto 18px">✓</div><h1>Вы записаны</h1><p class="muted">'+esc(state.service.name)+' · '+slotDateTime(booking.start_at)+'</p><div class="summary" style="margin-top:22px;text-align:left"><b>'+esc(data.organization.name)+'</b><div class="muted tiny" style="margin-top:5px">'+esc(state.location.name)+'</div></div>'+(cfg.show_branding?'<div class="tiny muted" style="margin-top:26px">Powered by Lootly</div>':'')+'</div></div></div>';
      }catch(err){
        const message=friendlyError(err);
        if(String(err?.message||"").toLowerCase().includes("no longer available")){
          try{state.slots=[];state.slotsLoadedFor=null;state.loadError=null;await slotsLoad()}catch{}
          state.index=Math.max(0,steps.indexOf("datetime"));toast(message,"error");render();return;
        }
        out.innerHTML='<div class="notice error">'+esc(message)+'</div><button type="button" class="btn secondary" id="bookRetry">Повторить</button>';
        btn.disabled=false;btn.textContent="Подтвердить запись";
        document.querySelector("#bookRetry")?.addEventListener("click",()=>btn.click());
        if(widgetKey)window.parent?.postMessage({type:"lootly:error",stage:"booking",message,widgetKey},"*");
      }
    });
  }
  render().catch(err=>{showError("Не удалось загрузить форму",friendlyError(err),true)});
}

async function route(){
  const parts=(location.hash||"#/").replace(/^#\//,"").split("/").filter(Boolean);
  try{
    if(!parts.length)return landing();
    if(parts[0]==="setup")return setup();
    if(parts[0]==="login")return login();
    if(parts[0]==="join"&&parts[1])return join(parts[1]);
    if(parts[0]==="widget"&&parts[1])return publicWidget(parts[1]);
    if(parts[0]==="book"&&parts[1])return publicBook(parts[1]);
    if(parts[0]==="dashboard")return dashboard();
    if(parts[0]==="calendar")return calendar();
    if(parts[0]==="client"&&parts[1])return clientDetail(parts[1]);
    if(parts[0]==="catalog")return catalog();
    if(parts[0]==="schedule")return schedule();
    if(parts[0]==="widgets")return widgets();
    if(parts[0]==="settings")return settings();
    return landing();
  }catch(e){console.error(e);app.innerHTML='<div class="booking-shell"><div class="booking-card"><div class="booking-body" style="padding-top:28px">'+emptyState("Что-то пошло не так",e?.message||"Попробуйте обновить страницу.")+'</div></div></div>'}
}
addEventListener("hashchange",route);route();