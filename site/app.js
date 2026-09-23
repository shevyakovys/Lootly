import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL="https://tccmnfuwambjbsbmozdl.supabase.co";
const SUPABASE_KEY="sb_publishable_Pk7SN0966fEeJHTmj_b4mQ_U7Vyp8kc";
const sb=createClient(SUPABASE_URL,SUPABASE_KEY);
const app=document.querySelector("#app");
const toastRoot=document.querySelector("#toast-root");
let currentProfile=null,currentOrg=null;

const esc=(v="")=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>new Intl.NumberFormat("ru-RU",{style:"currency",currency:"RUB",maximumFractionDigits:0}).format(Number(v||0));
const dt=v=>v?new Date(v).toLocaleString("ru-RU",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"";
const day=v=>v?new Date(v).toLocaleDateString("ru-RU",{weekday:"short",day:"numeric",month:"short"}):"";
const initials=v=>String(v||"?").trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()).join("");
const todayIso=()=>new Date().toISOString().slice(0,10);
const icon=n=>({dashboard:"⌂",catalog:"▦",schedule:"◫",widgets:"◇",settings:"⚙",plus:"+",calendar:"▣",client:"◎",service:"✦",staff:"♙"}[n]||"•");
const slugify=(value="")=>{const m={а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"c",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya"};return String(value).trim().toLowerCase().split("").map(c=>m[c]??c).join("").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,100)};

function toast(text,type="success"){const el=document.createElement("div");el.className="toast "+type;el.textContent=text;toastRoot.append(el);setTimeout(()=>el.remove(),3200)}
function friendlyError(error){
  const raw=String(error?.message||error||"").toLowerCase();
  if(raw.includes("rate limit"))return "Слишком много запросов. Подождите минуту и попробуйте снова.";
  if(raw.includes("no longer available")||raw.includes("exclusion"))return "Это время только что заняли. Мы обновили свободные слоты.";
  if(raw.includes("outside working hours"))return "Это время уже недоступно. Выберите другое.";
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
  const start=new Date();start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+1);
  const [aRes,apptRes,locRes,svcRes,staffRes,hoursRes,widgetRes,waitRes]=await Promise.all([
    sb.rpc("get_admin_analytics"),
    sb.from("appointments").select("*,customers(name,phone),services(name),staff_members(name),locations(name)").gte("start_at",start.toISOString()).order("start_at",{ascending:true}).limit(150),
    sb.from("locations").select("id",{count:"exact"}).eq("active",true),
    sb.from("services").select("id",{count:"exact"}).eq("active",true),
    sb.from("staff_members").select("id",{count:"exact"}).eq("active",true),
    sb.from("working_hours").select("id",{count:"exact"}).limit(1),
    sb.from("booking_widgets").select("id",{count:"exact"}).eq("active",true),
    sb.from("waitlist_entries").select("*,services(name),staff_members(name),locations(name)").eq("status","waiting").order("desired_date",{ascending:true}).limit(30)
  ]);
  if(aRes.error||apptRes.error){await shell("dashboard","Журнал",'<div class="notice error">'+esc((aRes.error||apptRes.error).message)+'</div>');return}
  const metrics=aRes.data||{},all=apptRes.data||[],today=all.filter(x=>new Date(x.start_at)<end),upcoming=all.filter(x=>new Date(x.start_at)>=new Date()).slice(0,30),waitlist=waitRes.data||[];
  const checklist=[
    [locRes.count>0,"Добавьте филиал","#/catalog"],
    [svcRes.count>0,"Создайте услуги","#/catalog"],
    [staffRes.count>0,"Добавьте сотрудников","#/catalog"],
    [hoursRes.count>0,"Настройте расписание","#/schedule"],
    [widgetRes.count>0,"Создайте виджет","#/widgets"]
  ],done=checklist.filter(x=>x[0]).length;
  const onboarding=done<checklist.length?'<section class="card onboarding"><div class="spread"><div><h2>Настройка '+done+'/'+checklist.length+'</h2><p>Ещё немного — и клиенты смогут записываться сами.</p></div><span style="font-size:34px;font-weight:850">'+Math.round(done/checklist.length*100)+'%</span></div><div class="checklist">'+checklist.map(x=>'<a href="'+x[2]+'" class="checkitem '+(x[0]?"done":"")+'"><span class="checkdot">'+(x[0]?"✓":"•")+'</span><span>'+esc(x[1])+'</span></a>').join("")+'</div></section>':"";
  const rows=upcoming.map(x=>appointmentRow(x)).join("");
  const content='<div class="page-head"><div><h1>Добрый день 👋</h1><p>'+esc(o.name)+' · '+new Date().toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long"})+'</p></div><div class="cluster"><a class="btn secondary" href="#/widgets">Поделиться записью</a><button class="btn brand" id="focusNewBooking">+ Новая запись</button></div></div>'+
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
function appointmentRow(x){return '<tr><td><b>'+dt(x.start_at)+'</b><div class="muted tiny">'+esc(x.locations?.name||"")+'</div></td><td><div class="person"><span class="avatar">'+initials(x.customers?.name)+'</span><div><a href="#/client/'+x.customer_id+'"><b>'+esc(x.customers?.name||"Клиент")+'</b></a><small>'+esc(x.customers?.phone||"")+'</small></div></div></td><td>'+esc(x.services?.name||"—")+'</td><td>'+esc(x.staff_members?.name||"—")+'</td><td><span class="status '+esc(x.status)+'">'+esc(statusLabel(x.status))+'</span></td><td><div class="cluster">'+(["booked","confirmed"].includes(x.status)?'<button class="btn secondary sm" data-status="'+x.id+'" data-to="confirmed">✓</button><button class="btn secondary sm" data-status="'+x.id+'" data-to="completed">Готово</button><button class="btn danger sm" data-status="'+x.id+'" data-to="canceled">Отмена</button>':"")+'</div></td></tr>'}
function bindAppointmentActions(){document.querySelectorAll("[data-status]").forEach(b=>b.addEventListener("click",async()=>{const {error}=await sb.rpc("set_appointment_status",{p_appointment_id:b.dataset.status,p_status:b.dataset.to});if(error)toast(error.message,"error");else{toast("Статус обновлён");dashboard()}}))}
async function renderQuickBooking(){
  const root=document.querySelector("#newBooking");if(!root)return;
  const [l,s,st,c]=await Promise.all([sb.from("locations").select("*").eq("active",true).order("name"),sb.from("services").select("*").eq("active",true).order("name"),sb.from("staff_members").select("*").eq("active",true).order("name"),sb.from("customers").select("*").order("name")]);
  const loc=l.data||[],svc=s.data||[],staff=st.data||[],cust=c.data||[];
  if(!loc.length||!svc.length||!staff.length||!cust.length){root.innerHTML='<div class="card"><h2>Новая запись</h2><p class="muted">Сначала добавьте филиал, услугу, сотрудника и клиента в справочниках.</p><a class="btn secondary" href="#/catalog">Открыть справочники</a></div>';return}
  root.innerHTML='<form id="quickBook" class="card stack"><div class="card-title"><div><h2>Новая запись</h2><p class="muted tiny">Создание записи администратором</p></div></div><div class="grid grid-4"><label class="field"><span>Филиал</span><select name="location">'+loc.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")+'</select></label><label class="field"><span>Услуга</span><select name="service">'+svc.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")+'</select></label><label class="field"><span>Сотрудник</span><select name="staff">'+staff.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")+'</select></label><label class="field"><span>Клиент</span><select name="customer">'+cust.map(x=>'<option value="'+x.id+'">'+esc(x.name)+' · '+esc(x.phone)+'</option>').join("")+'</select></label></div><div class="grid grid-2"><label class="field"><span>Дата</span><input type="date" name="day" min="'+todayIso()+'" value="'+todayIso()+'"></label><label class="field"><span>Свободное время</span><select name="slot"><option value="">Загрузка...</option></select></label></div><div><button class="btn brand">Создать запись</button></div></form>';
  const f=document.querySelector("#quickBook"),load=async()=>{const fd=new FormData(f),o=await org();const {data,error}=await sb.rpc("get_public_availability",{p_slug:o.slug,p_location_id:fd.get("location"),p_service_id:fd.get("service"),p_day:fd.get("day"),p_staff_id:fd.get("staff")});f.elements.slot.innerHTML=error?'<option value="">'+esc(error.message)+'</option>':'<option value="">Выберите время</option>'+((data||[]).map(x=>'<option value="'+x.start_at+'">'+new Date(x.start_at).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})+'</option>').join(""))};
  ["location","service","staff","day"].forEach(n=>f.elements[n].addEventListener("change",load));await load();
  f.addEventListener("submit",async e=>{e.preventDefault();const fd=new FormData(f);if(!fd.get("slot"))return toast("Выберите свободное время","error");const {error}=await sb.rpc("create_admin_booking",{p_location_id:fd.get("location"),p_service_id:fd.get("service"),p_staff_id:fd.get("staff"),p_customer_id:fd.get("customer"),p_start_at:fd.get("slot"),p_note:null,p_booking_key:crypto.randomUUID()});if(error)toast(error.message,"error");else{toast("Запись создана");dashboard()}});
}

async function catalog(){
  if(!await requireAuth())return;
  const p=await profile(),manager=["owner","admin"].includes(p.role);
  const [l,s,st,c,cat]=await Promise.all([
    sb.from("locations").select("*").order("name"),
    sb.from("services").select("*,service_categories(name)").order("name"),
    sb.from("staff_members").select("*").order("name"),
    sb.from("customers").select("*").order("created_at",{ascending:false}),
    sb.from("service_categories").select("*").order("sort_order").order("name")
  ]);
  const content='<div class="page-head"><div><h1>Справочники</h1><p>Услуги, команда, филиалы и клиентская база.</p></div></div><div class="tabs" id="catalogTabs"><button class="tab active" data-tab="services">Услуги '+(s.data?.length||0)+'</button><button class="tab" data-tab="staff">Сотрудники '+(st.data?.length||0)+'</button><button class="tab" data-tab="locations">Филиалы '+(l.data?.length||0)+'</button><button class="tab" data-tab="customers">Клиенты '+(c.data?.length||0)+'</button></div><section id="catalogPane" style="margin-top:16px"></section>';
  await shell("catalog","Справочники",content);
  const data={services:s.data||[],staff:st.data||[],locations:l.data||[],customers:c.data||[],categories:cat.data||[]};

  const render=tab=>{
    document.querySelectorAll("#catalogTabs .tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===tab));
    const pane=document.querySelector("#catalogPane");
    const categoryOptions='<option value="">Без категории</option>'+data.categories.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("");
    const forms={
      services:'<div class="grid grid-2"><form id="addEntity" class="card stack"><div class="card-title"><div><h2>Новая услуга</h2><p class="muted tiny">Цена и длительность фиксируются в записи как snapshot.</p></div></div><div class="grid grid-2"><label class="field"><span>Название</span><input name="name" required></label><label class="field"><span>Категория</span><select name="category">'+categoryOptions+'</select></label><label class="field"><span>Длительность</span><input name="duration" type="number" value="60" min="1"></label><label class="field"><span>Цена</span><input name="price" type="number" value="0" min="0" step=".01"></label></div><button class="btn brand">Добавить услугу</button></form><form id="categoryForm" class="card stack"><div><h2>Категории</h2><p class="muted tiny">Помогают структурировать каталог и форму онлайн-записи.</p></div><label class="field"><span>Название категории</span><input name="name" placeholder="Стрижки, массаж, консультации" required></label><button class="btn secondary">Добавить категорию</button><div class="scope-pills">'+data.categories.map(x=>'<span class="category-label">'+esc(x.name)+'</span>').join("")+'</div></form></div>',
      staff:'<div class="grid grid-2"><form id="addEntity" class="card stack"><h2>Новый сотрудник</h2><label class="field"><span>Имя</span><input name="name" required></label><label class="field"><span>Филиал</span><select name="location">'+data.locations.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")+'</select></label><label class="field"><span>Фото — URL</span><input name="avatar_url" type="url" placeholder="https://..."><small>Можно оставить пустым — покажем инициалы.</small></label><button class="btn brand">Добавить сотрудника</button></form><form id="assignService" class="card stack"><h2>Назначить услугу</h2><label class="field"><span>Сотрудник</span><select name="staff">'+data.staff.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")+'</select></label><label class="field"><span>Услуга</span><select name="service">'+data.services.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")+'</select></label><button class="btn secondary">Назначить</button><p class="muted tiny">Без назначения сотрудник не появится для этой услуги в онлайн-записи.</p></form></div>',
      locations:'<form id="addEntity" class="card stack"><h2>Новый филиал</h2><div class="grid grid-3"><label class="field"><span>Название</span><input name="name" required></label><label class="field"><span>Timezone</span><input name="timezone" value="Europe/Moscow"></label><label class="field"><span>Адрес</span><input name="address"></label></div><button class="btn brand">Добавить филиал</button></form>',
      customers:'<form id="addEntity" class="card stack"><h2>Новый клиент</h2><div class="grid grid-3"><label class="field"><span>Имя</span><input name="name" required></label><label class="field"><span>Телефон</span><input name="phone" required></label><label class="field"><span>Email</span><input name="email" type="email"></label></div><label class="field"><span>Заметка</span><textarea name="note"></textarea></label><button class="btn brand">Добавить клиента</button></form>'
    };
    const filters=tab==="services"?'<div class="cluster"><div class="search"><input id="entitySearch" placeholder="Поиск"></div><select id="categoryFilter" style="width:auto"><option value="">Все категории</option>'+data.categories.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")+'</select></div>':'<div class="search"><input id="entitySearch" placeholder="Поиск"></div>';
    const renderRows=()=>{
      const q=(document.querySelector("#entitySearch")?.value||"").toLowerCase(),catId=document.querySelector("#categoryFilter")?.value||"";
      const rows=data[tab].filter(x=>JSON.stringify(x).toLowerCase().includes(q)&&(!catId||x.category_id===catId));
      document.querySelector("#entityList").innerHTML=rows.length?rows.map(x=>entityCard(tab,x)).join(""):emptyState("Ничего не найдено","Измените поиск или фильтр.");
    };
    const cards=data[tab].map(x=>entityCard(tab,x)).join("");
    pane.innerHTML=(manager?forms[tab]:"")+'<div class="card" style="margin-top:16px"><div class="card-title"><h2>'+({services:"Услуги",staff:"Сотрудники",locations:"Филиалы",customers:"Клиенты"}[tab])+'</h2>'+filters+'</div><div id="entityList">'+(cards||emptyState("Пока пусто","Добавьте первую запись в этот справочник."))+'</div></div>';
    document.querySelector("#entitySearch")?.addEventListener("input",renderRows);
    document.querySelector("#categoryFilter")?.addEventListener("change",renderRows);
    if(manager){
      bindAddEntity(tab,p,data);
      if(tab==="services"){
        document.querySelector("#categoryForm")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget),name=String(f.get("name")).trim();if(!name)return;const {error}=await sb.from("service_categories").insert({organization_id:p.organization_id,name});if(error)toast(error.message,"error");else{toast("Категория добавлена");catalog()}});
      }
      if(tab==="staff"){
        document.querySelector("#assignService")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const {error}=await sb.from("staff_services").insert({staff_id:f.get("staff"),service_id:f.get("service")});if(error&&error.code!=="23505")toast(error.message,"error");else toast("Услуга назначена")});
      }
    }
  };
  document.querySelectorAll("#catalogTabs .tab").forEach(b=>b.addEventListener("click",()=>render(b.dataset.tab)));
  render("services");
}
function entityCard(tab,x){
  if(tab==="customers")return '<div class="spread" style="padding:13px 0;border-bottom:1px solid var(--line)"><div class="person"><span class="avatar">'+initials(x.name)+'</span><div><a href="#/client/'+x.id+'"><b>'+esc(x.name)+'</b></a><small>'+esc(x.phone)+' · '+esc(x.email||"без email")+'</small></div></div><span class="muted tiny">'+esc(x.note||"")+'</span></div>';
  if(tab==="services")return '<div class="spread" style="padding:13px 0;border-bottom:1px solid var(--line)"><div><div class="cluster"><b>'+esc(x.name)+'</b>'+(x.service_categories?.name?'<span class="category-label">'+esc(x.service_categories.name)+'</span>':"")+'</div><div class="muted tiny">'+x.duration_minutes+' мин</div></div><b>'+money(x.price)+'</b></div>';
  if(tab==="staff"){const avatar=x.avatar_url?'<img class="staff-photo" src="'+esc(x.avatar_url)+'" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'avatar\',textContent:\''+initials(x.name)+'\'}))">':'<span class="avatar">'+initials(x.name)+'</span>';return '<div class="spread" style="padding:13px 0;border-bottom:1px solid var(--line)"><div class="person">'+avatar+'<div><b>'+esc(x.name)+'</b><small>'+(x.active?"Активен":"Неактивен")+'</small></div></div></div>'}
  return '<div class="spread" style="padding:13px 0;border-bottom:1px solid var(--line)"><div><b>'+esc(x.name)+'</b><div class="muted tiny">'+esc(x.address||"Адрес не указан")+' · '+esc(x.timezone||"")+'</div></div></div>';
}
function bindAddEntity(tab,p,data){
  document.querySelector("#addEntity")?.addEventListener("submit",async e=>{
    e.preventDefault();const f=new FormData(e.currentTarget);let table,payload;
    if(tab==="services"){table="services";payload={organization_id:p.organization_id,name:f.get("name"),duration_minutes:Number(f.get("duration")),price:f.get("price"),category_id:f.get("category")||null}}
    else if(tab==="staff"){table="staff_members";payload={organization_id:p.organization_id,name:f.get("name"),location_id:f.get("location"),avatar_url:f.get("avatar_url")||null}}
    else if(tab==="locations"){table="locations";payload={organization_id:p.organization_id,name:f.get("name"),timezone:f.get("timezone"),address:f.get("address")||null}}
    else{table="customers";payload={organization_id:p.organization_id,name:f.get("name"),phone:f.get("phone"),email:f.get("email")||null,note:f.get("note")||null}}
    const {error}=await sb.from(table).insert(payload);if(error)toast(error.message,"error");else{toast("Добавлено");catalog()}
  })
}

function localDateParts(value,timeZone){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(value));
  const get=t=>parts.find(x=>x.type===t)?.value||"";
  return {date:get("year")+"-"+get("month")+"-"+get("day"),hour:Number(get("hour")),minute:Number(get("minute"))};
}
function addDaysIso(iso,delta){const d=new Date(iso+"T12:00:00");d.setDate(d.getDate()+delta);return d.toISOString().slice(0,10)}
function weekStartIso(iso){const d=new Date(iso+"T12:00:00"),wd=(d.getDay()+6)%7;d.setDate(d.getDate()-wd);return d.toISOString().slice(0,10)}

async function calendar(){
  if(!await requireAuth())return;
  const p=await profile(),manager=["owner","admin"].includes(p.role);
  const [apptRes,staffRes,locRes]=await Promise.all([
    sb.from("appointments").select("*,customers(name,phone),services(name),staff_members(name),locations(name,timezone)").order("start_at",{ascending:true}).limit(500),
    sb.from("staff_members").select("id,name").eq("active",true).order("name"),
    sb.from("locations").select("id,name,timezone").eq("active",true).order("name")
  ]);
  if(apptRes.error)return shell("calendar","Календарь",'<div class="notice error">'+esc(apptRes.error.message)+'</div>');
  const all=apptRes.data||[],staff=staffRes.data||[],locations=locRes.data||[];
  let mode="week",anchor=todayIso(),staffFilter="",locationFilter="";

  const content='<div class="page-head"><div><h1>Календарь</h1><p>Рабочая неделя, загрузка команды и быстрый перенос записей.</p></div><div class="cluster"><select id="calendarMode" style="width:auto"><option value="week">Неделя</option><option value="day">День</option></select><select id="calendarLocation" style="width:auto"><option value="">Все филиалы</option>'+locations.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")+'</select><select id="calendarStaff" style="width:auto"><option value="">Все сотрудники</option>'+staff.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")+'</select></div></div><div class="calendar-toolbar"><div class="cluster"><button class="btn secondary sm" id="calPrev">←</button><button class="btn secondary sm" id="calToday">Сегодня</button><button class="btn secondary sm" id="calNext">→</button></div><b id="calendarPeriod"></b><span class="muted tiny">'+(manager?"Перетащите запись на другой час, чтобы перенести.":"Календарь доступен только для просмотра.")+'</span></div><div class="calendar-grid week" id="calendarGrid"></div>';
  await shell("calendar","Календарь",content);

  function render(){
    const grid=document.querySelector("#calendarGrid");
    const start=mode==="week"?weekStartIso(anchor):anchor;
    const days=Array.from({length:mode==="week"?7:1},(_,i)=>addDaysIso(start,i));
    const hours=Array.from({length:13},(_,i)=>8+i);
    grid.className="calendar-grid "+mode;
    document.querySelector("#calendarPeriod").textContent=mode==="week"
      ? new Date(days[0]+"T12:00:00").toLocaleDateString("ru-RU",{day:"numeric",month:"short"})+" — "+new Date(days[days.length-1]+"T12:00:00").toLocaleDateString("ru-RU",{day:"numeric",month:"short",year:"numeric"})
      : new Date(anchor+"T12:00:00").toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long"});

    let html='<div class="cal-head"></div>'+days.map(x=>'<div class="cal-head">'+new Date(x+"T12:00:00").toLocaleDateString("ru-RU",{weekday:"short",day:"numeric",month:"short"})+'</div>').join("");
    for(const hour of hours){
      html+='<div class="cal-time">'+String(hour).padStart(2,"0")+':00</div>';
      for(const date of days)html+='<div class="cal-cell" data-date="'+date+'" data-hour="'+hour+'"></div>';
    }
    grid.innerHTML=html;

    const filtered=all.filter(a=>(!staffFilter||a.staff_id===staffFilter)&&(!locationFilter||a.location_id===locationFilter));
    filtered.forEach(a=>{
      const tz=a.locations?.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone;
      const lp=localDateParts(a.start_at,tz);
      if(!days.includes(lp.date)||lp.hour<8||lp.hour>20)return;
      const cell=grid.querySelector('.cal-cell[data-date="'+lp.date+'"][data-hour="'+lp.hour+'"]');
      if(!cell)return;
      const ev=document.createElement("div");
      ev.className="cal-event "+a.status;
      ev.draggable=manager&&["booked","confirmed"].includes(a.status);
      ev.dataset.appointment=a.id;
      const height=Math.max(42,Math.min(180,(Number(a.duration_minutes||60)/60)*64-7));
      ev.style.top=(4+(lp.minute/60)*64)+"px";ev.style.height=height+"px";
      ev.innerHTML='<b>'+String(lp.hour).padStart(2,"0")+':'+String(lp.minute).padStart(2,"0")+' · '+esc(a.customers?.name||"Клиент")+'</b><span>'+esc(a.services?.name||"")+' · '+esc(a.staff_members?.name||"")+'</span>';
      ev.title=(a.customers?.name||"")+" · "+(a.services?.name||"")+" · "+statusLabel(a.status);
      cell.append(ev);
    });

    if(manager){
      grid.querySelectorAll(".cal-event[draggable=true]").forEach(ev=>ev.addEventListener("dragstart",e=>{e.dataTransfer.setData("text/plain",ev.dataset.appointment);e.dataTransfer.effectAllowed="move"}));
      grid.querySelectorAll(".cal-cell").forEach(cell=>{
        cell.addEventListener("dragover",e=>{e.preventDefault();cell.classList.add("drag-over")});
        cell.addEventListener("dragleave",()=>cell.classList.remove("drag-over"));
        cell.addEventListener("drop",async e=>{
          e.preventDefault();cell.classList.remove("drag-over");
          const id=e.dataTransfer.getData("text/plain");if(!id)return;
          const hour=String(cell.dataset.hour).padStart(2,"0")+":00:00";
          try{
            await rpcRetry("reschedule_appointment_local",{p_appointment_id:id,p_local_date:cell.dataset.date,p_local_time:hour});
            toast("Запись перенесена");calendar();
          }catch(err){toast(friendlyError(err),"error")}
        });
      });
    }
  }
  document.querySelector("#calendarMode").addEventListener("change",e=>{mode=e.target.value;render()});
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
    sb.from("appointments").select("*,services(name),staff_members(name),locations(name)").eq("customer_id",id).order("start_at",{ascending:false}).limit(200)
  ]);
  if(custRes.error)return shell("catalog","Клиент",'<div class="notice error">'+esc(custRes.error.message)+'</div>');
  const c=custRes.data,visits=apptRes.data||[],completed=visits.filter(x=>x.status==="completed"),spent=completed.reduce((s,x)=>s+Number(x.price||0),0),next=visits.filter(x=>new Date(x.start_at)>new Date()&&["booked","confirmed"].includes(x.status)).sort((a,b)=>new Date(a.start_at)-new Date(b.start_at))[0];
  const rows=visits.map(x=>'<tr><td>'+dt(x.start_at)+'</td><td>'+esc(x.services?.name||"—")+'</td><td>'+esc(x.staff_members?.name||"—")+'</td><td>'+money(x.price)+'</td><td><span class="status '+x.status+'">'+statusLabel(x.status)+'</span></td></tr>').join("");
  const content='<div class="page-head"><div><a class="muted tiny" href="#/catalog">← Назад к клиентам</a></div></div><section class="card"><div class="client-hero"><div class="client-avatar">'+initials(c.name)+'</div><div><h1 style="margin-bottom:6px">'+esc(c.name)+'</h1><div class="muted">'+esc(c.phone)+(c.email?" · "+esc(c.email):"")+'</div></div><div class="cluster"><a class="btn brand" href="#/dashboard">+ Новая запись</a></div></div><div class="stat-row" style="margin-top:20px"><div class="stat-box"><b>'+visits.length+'</b><span>визитов всего</span></div><div class="stat-box"><b>'+money(spent)+'</b><span>сумма завершённых</span></div><div class="stat-box"><b>'+(next?day(next.start_at):"—")+'</b><span>следующий визит</span></div></div></section><div class="grid grid-2" style="margin-top:16px"><section class="card stack"><div class="card-title"><h2>Заметка</h2></div><textarea id="clientNote" '+(manager?"":"readonly")+' placeholder="Предпочтения, важные детали...">'+esc(c.note||"")+'</textarea>'+(manager?'<button class="btn secondary" id="saveClientNote">Сохранить заметку</button>':"")+'</section><section class="card"><div class="card-title"><h2>Контакты</h2></div><div class="stack"><div><span class="muted tiny">Телефон</span><div><b>'+esc(c.phone)+'</b></div></div><div><span class="muted tiny">Email</span><div><b>'+esc(c.email||"Не указан")+'</b></div></div><div><span class="muted tiny">Клиент с</span><div><b>'+new Date(c.created_at).toLocaleDateString("ru-RU")+'</b></div></div></div></section></div><section class="card flush" style="margin-top:16px"><div class="card-title" style="padding:18px 18px 0"><h2>История визитов</h2></div><div class="table-wrap"><table class="table"><thead><tr><th>Дата</th><th>Услуга</th><th>Сотрудник</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>'+(rows||'<tr><td colspan="5">'+emptyState("Истории пока нет","После первой записи здесь появится история клиента.")+'</td></tr>')+'</tbody></table></div></section>';
  await shell("catalog","Карточка клиента",content);
  document.querySelector("#saveClientNote")?.addEventListener("click",async()=>{const note=document.querySelector("#clientNote").value.trim();const {error}=await sb.from("customers").update({note}).eq("id",id);if(error)toast(error.message,"error");else toast("Заметка сохранена")});
}

async function schedule(){
  if(!await requireAuth())return;const p=await profile(),manager=["owner","admin"].includes(p.role);const {data:staff,error}=await sb.from("staff_members").select("*").eq("active",true).order("name");if(error)return shell("schedule","Расписание",'<div class="notice error">'+esc(error.message)+'</div>');
  const content='<div class="page-head"><div><h1>Расписание</h1><p>Рабочие часы и исключения по каждому сотруднику.</p></div></div>'+(staff?.length?'<div class="grid grid-3" id="staffSelector">'+staff.map((x,i)=>'<button class="card '+(i===0?"soft":"")+'" data-staff="'+x.id+'" style="text-align:left"><div class="person"><span class="avatar">'+initials(x.name)+'</span><div><b>'+esc(x.name)+'</b><small>Открыть график</small></div></div></button>').join("")+'</div><section id="schedulePane" style="margin-top:16px"></section>':emptyState("Нет сотрудников","Добавьте сотрудника в справочниках.","<a class='btn brand' href='#/catalog'>Добавить сотрудника</a>"));
  await shell("schedule","Расписание",content);if(!staff?.length)return;
  const load=async id=>{const target=staff.find(x=>x.id===id);document.querySelectorAll("[data-staff]").forEach(b=>b.classList.toggle("soft",b.dataset.staff===id));const [h,o]=await Promise.all([sb.from("working_hours").select("*").eq("staff_id",id).order("weekday"),sb.from("time_off").select("*").eq("staff_id",id).order("start_at")]);const hours=h.data||[],off=o.data||[],days=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];document.querySelector("#schedulePane").innerHTML='<div class="grid grid-2"><div class="card"><div class="card-title"><div><h2>'+esc(target.name)+'</h2><p class="muted tiny">Регулярная неделя</p></div></div>'+days.map((d,i)=>{const row=hours.find(x=>x.weekday===i);return '<div class="spread" style="padding:10px 0;border-bottom:1px solid var(--line)"><b>'+d+'</b><div class="cluster"><span>'+(row?row.start_time.slice(0,5)+' – '+row.end_time.slice(0,5):'<span class="muted">Выходной</span>')+'</span>'+(manager&&row?'<button class="btn ghost sm" data-hour="'+row.id+'">×</button>':"")+'</div></div>'}).join("")+'</div><div class="stack">'+(manager?'<form id="hoursForm" class="card stack"><h3>Добавить рабочие часы</h3><div class="grid grid-3"><label class="field"><span>День</span><select name="weekday">'+days.map((x,i)=>'<option value="'+i+'">'+x+'</option>').join("")+'</select></label><label class="field"><span>С</span><input name="start" type="time" value="09:00"></label><label class="field"><span>До</span><input name="end" type="time" value="18:00"></label></div><button class="btn brand">Добавить</button></form><form id="offForm" class="card stack"><h3>Исключение / Time off</h3><div class="grid grid-2"><label class="field"><span>Начало</span><input name="start" type="datetime-local" required></label><label class="field"><span>Конец</span><input name="end" type="datetime-local" required></label></div><label class="field"><span>Причина</span><input name="reason" placeholder="Отпуск, обучение..."></label><button class="btn secondary">Добавить исключение</button></form>':"")+'<div class="card"><h3>Исключения</h3>'+(off.length?off.map(x=>'<div class="spread" style="padding:10px 0;border-bottom:1px solid var(--line)"><span>'+dt(x.start_at)+' → '+dt(x.end_at)+'</span>'+(manager?'<button class="btn danger sm" data-off="'+x.id+'">Удалить</button>':"")+'</div>').join(""):'<p class="muted tiny">Исключений нет.</p>')+'</div></div></div>';
    if(manager){document.querySelector("#hoursForm")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget),{error}=await sb.from("working_hours").insert({staff_id:id,weekday:Number(f.get("weekday")),start_time:f.get("start"),end_time:f.get("end")});if(error)toast(error.message,"error");else{toast("График обновлён");load(id)}});document.querySelector("#offForm")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget),{error}=await sb.from("time_off").insert({staff_id:id,start_at:new Date(String(f.get("start"))).toISOString(),end_at:new Date(String(f.get("end"))).toISOString(),reason:f.get("reason")||null});if(error)toast(error.message,"error");else{toast("Исключение добавлено");load(id)}});document.querySelectorAll("[data-off]").forEach(b=>b.addEventListener("click",async()=>{await sb.from("time_off").delete().eq("id",b.dataset.off);load(id)}));document.querySelectorAll("[data-hour]").forEach(b=>b.addEventListener("click",async()=>{await sb.from("working_hours").delete().eq("id",b.dataset.hour);toast("Рабочий интервал удалён");load(id)}))}
  };
  document.querySelectorAll("[data-staff]").forEach(b=>b.addEventListener("click",()=>load(b.dataset.staff)));load(staff[0].id);
}

async function widgets(){
  if(!await requireAuth())return;const p=await profile();if(!["owner","admin"].includes(p.role))return shell("widgets","Виджеты",'<div class="notice error">Конструктор доступен владельцу и администратору.</div>');
  const [w,l,s,st]=await Promise.all([sb.from("booking_widgets").select("*").order("created_at"),sb.from("locations").select("id,name").eq("active",true).order("name"),sb.from("services").select("id,name").eq("active",true).order("name"),sb.from("staff_members").select("id,name").eq("active",true).order("name")]);
  let list=w.data||[];if(!list.length){const {data,error}=await sb.from("booking_widgets").insert({organization_id:p.organization_id,name:"Основной виджет",title:"Онлайн-запись",subtitle:"Выберите услугу и удобное время"}).select("*").single();if(error)return shell("widgets","Виджеты",'<div class="notice error">'+esc(error.message)+'</div>');list=[data]}
  const content='<div class="page-head"><div><h1>Виджеты</h1><p>Создавайте отдельные формы под сайт, филиалы и рекламные кампании.</p></div><button class="btn brand" id="newWidget">+ Новый виджет</button></div><div class="widget-builder"><div class="stack"><div class="card"><label class="field"><span>Редактируемый виджет</span><select id="widgetSelect">'+list.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")+'</select></label></div><form id="widgetForm" class="card stack"></form><section id="widgetShare" class="card stack"></section></div><aside class="preview-device"><div class="preview-screen" id="widgetPreview"></div></aside></div>';
  await shell("widgets","Виджеты",content);
  let selected=list[0],embedMode="floating";const loc=l.data||[],svc=s.data||[],staff=st.data||[];
  const form=document.querySelector("#widgetForm"),preview=document.querySelector("#widgetPreview"),share=document.querySelector("#widgetShare"),select=document.querySelector("#widgetSelect");
  const analytics=async()=>{const {data}=await sb.rpc("get_widget_analytics",{p_widget_id:selected.id});return data||{}};
  const pills=(items,ids,scope)=>'<div class="scope-pills" data-scope="'+scope+'">'+items.map(x=>'<label class="scope-pill"><input type="checkbox" value="'+x.id+'" '+(ids.includes(x.id)?"checked":"")+'>'+esc(x.name)+'</label>').join("")+'</div>';
  function collect(){const check=s=>[...form.querySelectorAll('[data-scope="'+s+'"] input:checked')].map(x=>x.value);return{organization_id:p.organization_id,name:form.elements.name.value.trim(),active:form.elements.active.value==="true",title:form.elements.title.value.trim()||"Онлайн-запись",subtitle:form.elements.subtitle.value.trim()||null,primary_color:form.elements.primary_color.value,button_text:form.elements.button_text.value.trim()||"Записаться",button_position:form.elements.button_position.value,panel_side:form.elements.panel_side.value,open_mode:form.elements.open_mode.value,button_animation:form.elements.button_animation.checked,show_staff_step:form.elements.show_staff_step.checked,allow_any_staff:form.elements.allow_any_staff.checked,show_branding:form.elements.show_branding.checked,location_ids:check("locations"),service_ids:check("services"),staff_ids:check("staff"),step_order:form.elements.step_preset.value==="service-first"?["service","location","staff","datetime"]:["location","service","staff","datetime"],updated_at:new Date().toISOString()}}
  async function render(){
    const a=await analytics(),x=selected;form.innerHTML='<div class="card-title"><div><h2>Настройки</h2><p class="muted tiny">Изменения применяются после сохранения</p></div><span class="status '+(x.active?"confirmed":"canceled")+'">'+(x.active?"Активен":"Выключен")+'</span></div><div class="grid grid-2"><label class="field"><span>Название в кабинете</span><input name="name" value="'+esc(x.name)+'"></label><label class="field"><span>Статус</span><select name="active"><option value="true">Активен</option><option value="false">Выключен</option></select></label></div><label class="field"><span>Заголовок формы</span><input name="title" value="'+esc(x.title||"Онлайн-запись")+'"></label><label class="field"><span>Подзаголовок</span><input name="subtitle" value="'+esc(x.subtitle||"")+'"></label><div class="grid grid-3"><label class="field"><span>Цвет</span><input name="primary_color" type="color" value="'+esc(x.primary_color||"#111827")+'"></label><label class="field"><span>Кнопка</span><input name="button_text" value="'+esc(x.button_text||"Записаться")+'"></label><label class="field"><span>Первые шаги</span><select name="step_preset"><option value="location-first">Сначала филиал</option><option value="service-first">Сначала услуга</option></select></label></div><div class="grid grid-3"><label class="field"><span>Положение кнопки</span><select name="button_position"><option value="bottom-right">Справа снизу</option><option value="bottom-left">Слева снизу</option><option value="top-right">Справа сверху</option><option value="top-left">Слева сверху</option></select></label><label class="field"><span>Открытие</span><select name="open_mode"><option value="drawer">Боковая панель</option><option value="modal">Модальное окно</option></select></label><label class="field"><span>Сторона панели</span><select name="panel_side"><option value="right">Справа</option><option value="left">Слева</option></select></label></div><div class="grid grid-2"><label class="scope-pill"><input name="button_animation" type="checkbox" '+(x.button_animation?"checked":"")+'>Анимация кнопки</label><label class="scope-pill"><input name="show_staff_step" type="checkbox" '+(x.show_staff_step?"checked":"")+'>Показывать специалиста</label><label class="scope-pill"><input name="allow_any_staff" type="checkbox" '+(x.allow_any_staff?"checked":"")+'>Разрешить «любой специалист»</label><label class="scope-pill"><input name="show_branding" type="checkbox" '+(x.show_branding?"checked":"")+'>Powered by Lootly</label></div><div><b>Филиалы</b><p class="muted tiny">Ничего не выбрано = все активные.</p>'+pills(loc,x.location_ids||[],"locations")+'</div><div><b>Услуги</b><p class="muted tiny">Ничего не выбрано = все активные.</p>'+pills(svc,x.service_ids||[],"services")+'</div><div><b>Сотрудники</b><p class="muted tiny">Ничего не выбрано = все подходящие.</p>'+pills(staff,x.staff_ids||[],"staff")+'</div><div class="cluster"><button class="btn brand">Сохранить</button><button type="button" class="btn danger" id="deleteWidget">Удалить</button></div>';
    form.elements.active.value=String(x.active);form.elements.button_position.value=x.button_position||"bottom-right";form.elements.open_mode.value=x.open_mode||"drawer";form.elements.panel_side.value=x.panel_side||"right";form.elements.step_preset.value=(x.step_order||[])[0]==="service"?"service-first":"location-first";
    const cfg=collect();preview.style.setProperty("--accent",cfg.primary_color);preview.innerHTML='<div style="padding:14px"><div class="spread"><span class="avatar" style="background:'+cfg.primary_color+';color:white">L</span><span class="status confirmed">Preview</span></div><h2 style="margin:22px 0 6px">'+esc(cfg.title)+'</h2><p class="muted">'+esc(cfg.subtitle||"Выберите услугу и удобное время")+'</p><div class="stepbar"><span style="width:32%"></span></div><div style="padding-top:20px"><span class="tiny muted">ШАГ 1</span><h3 style="margin:6px 0 14px">'+(cfg.step_order[0]==="service"?"Выберите услугу":"Выберите филиал")+'</h3><div class="stack"><button class="option active"><b>Основной вариант</b><small>Пример элемента</small></button><button class="option"><b>Другой вариант</b><small>Пример элемента</small></button></div><button class="btn brand" style="width:100%;margin-top:18px;background:'+cfg.primary_color+'">Продолжить</button></div>'+(cfg.show_branding?'<div class="tiny muted" style="text-align:center;margin-top:38px">Powered by Lootly</div>':"")+'</div>';
    await renderShare(a);
  }
  async function renderShare(a){const base="https://shevyakovys.github.io/Lootly",link=base+"/#/widget/"+selected.public_key;const snippets={floating:'<script src="'+base+'/embed.js" data-lootly-widget="'+selected.public_key+'" async><'+'/script>',inline:'<iframe src="'+link+'" style="width:100%;min-height:720px;border:0;border-radius:16px" loading="lazy"></iframe>',link};share.innerHTML='<div class="card-title"><div><h2>Публикация</h2><p class="muted tiny">Выберите способ установки</p></div></div><div class="funnel"><div class="funnel-item"><b>'+Number(a.views||0)+'</b><span>просмотров</span></div><div class="funnel-item"><b>'+Number(a.opens||0)+'</b><span>открытий</span></div><div class="funnel-item"><b>'+Number(a.bookings||0)+'</b><span>записей</span></div></div><div class="embed-mode"><button type="button" class="embed-choice '+(embedMode==="floating"?"active":"")+'" data-embed="floating">Плавающая кнопка</button><button type="button" class="embed-choice '+(embedMode==="inline"?"active":"")+'" data-embed="inline">Inline</button><button type="button" class="embed-choice '+(embedMode==="link"?"active":"")+'" data-embed="link">Прямая ссылка</button></div><textarea id="embedCode" class="codebox" readonly>'+esc(snippets[embedMode])+'</textarea><div class="cluster"><button class="btn secondary" id="copyEmbed" type="button">Копировать</button><a class="btn secondary" target="_blank" href="'+link+'">Открыть форму ↗</a></div><div class="notice info">Конверсия открытия → запись: <b>'+Math.round(Number(a.booking_conversion||0)*100)+'%</b></div>';
    document.querySelectorAll("[data-embed]").forEach(b=>b.addEventListener("click",()=>{embedMode=b.dataset.embed;renderShare(a)}));document.querySelector("#copyEmbed")?.addEventListener("click",async()=>{await navigator.clipboard.writeText(document.querySelector("#embedCode").value);toast("Код скопирован")})
  }
  select.addEventListener("change",()=>{selected=list.find(x=>x.id===select.value)||list[0];render()});form.addEventListener("input",()=>{const cfg=collect();preview.style.setProperty("--accent",cfg.primary_color);const h=preview.querySelector("h2"),p=preview.querySelector("p.muted"),btn=preview.querySelector(".btn.brand");if(h)h.textContent=cfg.title;if(p)p.textContent=cfg.subtitle||"Выберите услугу и удобное время";if(btn){btn.style.background=cfg.primary_color}});form.addEventListener("submit",async e=>{e.preventDefault();const {data,error}=await sb.from("booking_widgets").update(collect()).eq("id",selected.id).select("*").single();if(error)toast(error.message,"error");else{selected=data;list=list.map(x=>x.id===data.id?data:x);toast("Настройки сохранены");render()}});
  form.addEventListener("click",async e=>{if(e.target.id!=="deleteWidget")return;if(list.length===1)return toast("Нужен хотя бы один виджет","error");if(!confirm("Удалить этот виджет?"))return;const {error}=await sb.from("booking_widgets").delete().eq("id",selected.id);if(error)return toast(error.message,"error");list=list.filter(x=>x.id!==selected.id);selected=list[0];select.innerHTML=list.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("");toast("Виджет удалён");render()});
  document.querySelector("#newWidget").addEventListener("click",async()=>{const {data,error}=await sb.from("booking_widgets").insert({organization_id:p.organization_id,name:"Новый виджет",title:"Онлайн-запись",subtitle:"Выберите услугу и удобное время"}).select("*").single();if(error)return toast(error.message,"error");list.push(data);selected=data;select.insertAdjacentHTML("beforeend",'<option value="'+data.id+'">'+esc(data.name)+'</option>');select.value=data.id;toast("Новый виджет создан");render()});render();
}

async function settings(){
  if(!await requireAuth())return;
  const o=await org(),p=await profile(),manager=["owner","admin"].includes(p.role),booking="https://shevyakovys.github.io/Lootly/#/book/"+o.slug;
  const [staffRes,inviteRes,profilesRes]=await Promise.all([
    sb.from("staff_members").select("id,name").eq("active",true).order("name"),
    manager?sb.from("user_invites").select("*").order("created_at",{ascending:false}).limit(20):Promise.resolve({data:[]}),
    sb.from("profiles").select("id,email,role,staff_id,active").order("created_at")
  ]);
  const staff=staffRes.data||[],invites=inviteRes.data||[],profiles=profilesRes.data||[];
  const team=profiles.map(x=>'<div class="spread" style="padding:12px 0;border-bottom:1px solid var(--line)"><div class="person"><span class="avatar">'+initials(x.email)+'</span><div><b>'+esc(x.email)+'</b><small>'+esc(x.role)+'</small></div></div><span class="status '+(x.active?"confirmed":"canceled")+'">'+(x.active?"Активен":"Выключен")+'</span></div>').join("");
  const inviteForm=manager?'<form id="inviteForm" class="card stack"><div class="card-title"><div><h2>Пригласить в команду</h2><p class="muted tiny">Создайте одноразовую ссылку для администратора или сотрудника.</p></div></div><div class="grid grid-2"><label class="field"><span>Роль</span><select name="role"><option value="admin">Администратор</option><option value="staff">Сотрудник</option></select></label><label class="field"><span>Связать с сотрудником</span><select name="staff"><option value="">Не связывать</option>'+staff.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")+'</select></label></div><button class="btn brand">Создать ссылку</button><div id="inviteResult"></div></form>':"";
  const inviteList=manager&&invites.length?'<section class="card"><div class="card-title"><h2>Активные приглашения</h2></div>'+invites.map(i=>'<div class="spread" style="padding:10px 0;border-bottom:1px solid var(--line)"><div><b>'+esc(i.role)+'</b><div class="muted tiny">до '+dt(i.expires_at)+'</div></div><button class="btn secondary sm" data-copy-invite="'+i.token+'">Копировать</button></div>').join("")+'</section>':"";
  const content='<div class="page-head"><div><h1>Настройки</h1><p>Публичные ссылки, команда и доступ.</p></div></div><div class="grid grid-2"><section class="card stack"><div><h2>'+esc(o.name)+'</h2><p class="muted">Организация · '+esc(p.role)+'</p></div><label class="field"><span>Публичная ссылка</span><input id="publicLink" readonly value="'+esc(booking)+'"></label><button class="btn secondary" id="copyPublic">Скопировать ссылку</button></section><section class="card"><h2>Быстрый старт</h2><div class="checklist"><a class="checkitem" href="#/catalog"><span class="checkdot">1</span>Настройте услуги и сотрудников</a><a class="checkitem" href="#/schedule"><span class="checkdot">2</span>Заполните рабочее время</a><a class="checkitem" href="#/widgets"><span class="checkdot">3</span>Создайте виджет для сайта</a></div></section></div><section class="grid grid-2" style="margin-top:16px">'+inviteForm+'<div class="card"><div class="card-title"><h2>Команда</h2></div>'+(team||emptyState("Пока никого","Пригласите первого участника команды."))+'</div></section>'+inviteList;
  await shell("settings","Настройки",content);
  document.querySelector("#copyPublic")?.addEventListener("click",async()=>{await navigator.clipboard.writeText(booking);toast("Ссылка скопирована")});
  document.querySelector("#inviteForm")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget),role=f.get("role"),staffId=f.get("staff")||null;if(role==="staff"&&!staffId)return toast("Для роли сотрудника выберите сотрудника","error");const {data,error}=await sb.from("user_invites").insert({organization_id:p.organization_id,role,staff_id:staffId}).select("token").single();if(error)return toast(error.message,"error");const link=location.href.split("#")[0]+"#/join/"+data.token;document.querySelector("#inviteResult").innerHTML='<div class="notice success">Ссылка создана. <button type="button" id="copyNewInvite" class="btn ghost sm">Копировать</button></div>';document.querySelector("#copyNewInvite").onclick=async()=>{await navigator.clipboard.writeText(link);toast("Ссылка приглашения скопирована")}});
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
  const locs=data.locations||[],services=data.services||[];
  if(!locs.length){showError("Запись ещё не настроена","У бизнеса пока нет активного филиала для онлайн-записи.",false);return}
  if(!services.length){showError("Запись ещё не настроена","У бизнеса пока нет активных услуг для онлайн-записи.",false);return}

  const sessionKey="lootly_"+(widgetKey||data.organization.slug);
  let sk=sessionStorage.getItem(sessionKey);if(!sk){sk=crypto.randomUUID();sessionStorage.setItem(sessionKey,sk)}
  if(widgetKey)rpcRetry("track_widget_event",{p_public_key:widgetKey,p_session_key:sk,p_event_type:"view"},{attempts:1,timeout:4000}).catch(()=>{});
  else rpcRetry("track_public_booking_view",{p_slug:data.organization.slug,p_session_key:sk},{attempts:1,timeout:4000}).catch(()=>{});
  if(widgetKey)window.parent?.postMessage({type:"lootly:ready",widgetKey},"*");

  const state={
    location:locs.length===1?locs[0]:null,
    service:services.length===1?services[0]:null,
    staff:null,staffList:[],date:todayIso(),slots:[],slot:null,index:0,busy:false,loadError:null
  };

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
    }catch(err){state.loadError=friendlyError(err);throw err}
  }
  async function slotsLoad(){
    if(!state.location||!state.service)return;
    state.loadError=null;state.slot=null;
    const args=widgetKey
      ? {p_public_key:widgetKey,p_location_id:state.location.id,p_service_id:state.service.id,p_day:state.date,p_staff_id:state.staff?.id||null}
      : {p_slug:data.organization.slug,p_location_id:state.location.id,p_service_id:state.service.id,p_day:state.date,p_staff_id:state.staff?.id||null};
    try{
      state.slots=widgetKey
        ? await rpcRetry("get_public_widget_availability",args,{attempts:2})
        : await rpcRetry("get_public_availability",args,{attempts:2});
    }catch(err){state.loadError=friendlyError(err);state.slots=[];throw err}
  }
  const dateChips=()=>Array.from({length:7},(_,i)=>{const x=new Date();x.setDate(x.getDate()+i);const iso=x.toISOString().slice(0,10);return '<button type="button" class="date-chip '+(state.date===iso?"active":"")+'" data-date="'+iso+'"><span>'+x.toLocaleDateString("ru-RU",{weekday:"short"})+'</span><b>'+x.getDate()+'</b></button>'}).join("");
  const staffVisual=x=>x.avatar_url?'<img class="staff-photo" src="'+esc(x.avatar_url)+'" alt="" loading="lazy">':'<span class="avatar">'+initials(x.name)+'</span>';
  const groupedServices=()=>{
    const groups=new Map();
    services.forEach(s=>{const key=s.category_name||"Услуги";if(!groups.has(key))groups.set(key,[]);groups.get(key).push(s)});
    return [...groups.entries()].map(([name,items])=>'<div style="margin-bottom:18px"><div class="tiny muted" style="font-weight:800;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">'+esc(name)+'</div><div class="option-grid">'+items.map(x=>'<button type="button" class="option '+(state.service?.id===x.id?"active":"")+'" data-service="'+x.id+'"><b>'+esc(x.name)+'</b><small>'+x.duration_minutes+' мин · '+money(x.price)+'</small></button>').join("")+'</div></div>').join("");
  };

  async function render(){
    const step=steps[state.index];
    try{
      if(step==="staff"&&state.location&&state.service&&!state.staffList.length)await staffLoad();
      if(step==="datetime"&&state.location&&state.service&&!state.slots.length&&!state.loadError)await slotsLoad();
    }catch(err){/* render localized error below */}

    let body="";
    if(step==="location"){
      body='<div class="option-grid">'+locs.map(x=>'<button type="button" class="option '+(state.location?.id===x.id?"active":"")+'" data-location="'+x.id+'"><b>'+esc(x.name)+'</b><small>'+esc(x.address||"Адрес не указан")+'</small></button>').join("")+'</div>';
    }
    if(step==="service")body=groupedServices();
    if(step==="staff"){
      if(state.loadError)body='<div class="notice error">'+esc(state.loadError)+'</div><button type="button" class="btn secondary" id="retryStaff">Повторить</button>';
      else body='<div class="option-grid">'+(cfg.allow_any_staff?'<button type="button" class="option '+(!state.staff?"active":"")+'" data-staff=""><div class="person"><span class="avatar">★</span><div><b>Любой специалист</b><small>Подберём ближайшее время</small></div></div></button>':"")+state.staffList.map(x=>'<button type="button" class="option '+(state.staff?.id===x.id?"active":"")+'" data-staff="'+x.id+'"><div class="person">'+staffVisual(x)+'<div><b>'+esc(x.name)+'</b><small>Специалист</small></div></div></button>').join("")+'</div>';
    }
    if(step==="datetime"){
      let slotsPart="";
      if(state.loadError)slotsPart='<div class="notice error">'+esc(state.loadError)+'</div><button type="button" class="btn secondary" id="retrySlots">Повторить загрузку</button>';
      else if(state.slots.length)slotsPart='<div class="slot-grid">'+state.slots.map((x,i)=>'<button type="button" class="slot '+(state.slot===i?"active":"")+'" data-slot="'+i+'">'+new Date(x.start_at).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})+'</button>').join("")+'</div>';
      else slotsPart='<div class="muted" style="padding:18px 0">На этот день свободных окон нет.</div>'+(widgetKey&&cfg.waitlist_enabled?'<div class="waitlist-box"><b>Хотите, чтобы вам написали при появлении окна?</b><p class="muted tiny">Оставьте контакты — заявка попадёт администратору.</p><form id="waitlistForm" class="stack"><input name="name" placeholder="Имя" required><input name="phone" type="tel" placeholder="Телефон" required><input name="email" type="email" placeholder="Email — необязательно"><button class="btn secondary">Встать в лист ожидания</button><div id="waitlistResult"></div></form></div>':"";
      body='<div class="date-strip">'+dateChips()+'</div>'+slotsPart;
    }
    if(step==="contact"){
      const chosen=state.slots[state.slot];
      body='<form id="contactForm" class="stack"><div class="summary"><b>'+esc(state.service?.name||"")+'</b><div class="muted tiny" style="margin-top:4px">'+esc(state.location?.name||"")+' · '+(chosen?dt(chosen.start_at):"")+(state.staff?" · "+esc(state.staff.name):"")+'</div></div><label class="field"><span>Ваше имя</span><input name="name" autocomplete="name" required></label><label class="field"><span>Телефон</span><input name="phone" type="tel" autocomplete="tel" required></label><label class="field"><span>Email <span class="muted">(необязательно)</span></span><input name="email" type="email" autocomplete="email"></label><button class="btn brand" id="bookSubmit" style="background:'+cfg.primary_color+'">Подтвердить запись</button><div id="bookResult"></div></form>';
    }

    const titles={location:"Выберите филиал",service:"Выберите услугу",staff:"К кому записаться?",datetime:"Выберите время",contact:"Контактные данные"};
    const subs={location:"Где вам удобнее?",service:"Что хотите записать?",staff:"Можно выбрать специалиста или ближайшее доступное время.",datetime:"Показываем только реально свободные окна.",contact:"Проверьте детали и подтвердите запись."};
    app.innerHTML='<div class="booking-shell" style="--accent:'+esc(cfg.primary_color)+'"><div class="booking-card"><div class="booking-head"><div class="spread"><div><div class="tiny muted">'+esc(data.organization.name)+'</div><h2 style="margin:5px 0 0">'+esc(cfg.title||"Онлайн-запись")+'</h2></div><span class="tiny muted">'+(state.index+1)+'/'+steps.length+'</span></div><p class="muted tiny" style="margin-top:7px">'+esc(cfg.subtitle||"")+'</p></div><div class="stepbar"><span style="width:'+Math.round((state.index+1)/steps.length*100)+'%"></span></div><div class="booking-body"><div style="padding-top:22px"><h2>'+titles[step]+'</h2><p class="muted">'+subs[step]+'</p>'+body+'</div>'+(step!=="contact"?'<div class="booking-actions">'+(state.index?'<button class="btn secondary" id="back">Назад</button>':'<span></span>')+'<button class="btn brand" id="next" style="background:'+cfg.primary_color+'" '+((step==="datetime"&&!state.slots.length)?"disabled":"")+'>Продолжить</button></div>':'')+(cfg.show_branding?'<div class="tiny muted" style="text-align:center;margin-top:24px">Powered by Lootly</div>':'')+'</div></div></div>';

    document.querySelector("#back")?.addEventListener("click",()=>{state.index=Math.max(0,state.index-1);state.loadError=null;render()});
    document.querySelectorAll("[data-location]").forEach(b=>b.addEventListener("click",()=>{state.location=locs.find(x=>x.id===b.dataset.location);state.staff=null;state.staffList=[];state.slots=[];state.loadError=null;render()}));
    document.querySelectorAll("[data-service]").forEach(b=>b.addEventListener("click",()=>{state.service=services.find(x=>x.id===b.dataset.service);state.staff=null;state.staffList=[];state.slots=[];state.loadError=null;render()}));
    document.querySelectorAll("[data-staff]").forEach(b=>b.addEventListener("click",()=>{state.staff=b.dataset.staff?state.staffList.find(x=>x.id===b.dataset.staff):null;state.slots=[];state.loadError=null;render()}));
    document.querySelectorAll("[data-date]").forEach(b=>b.addEventListener("click",async()=>{state.date=b.dataset.date;state.slots=[];state.loadError=null;try{await slotsLoad()}catch{}render()}));
    document.querySelectorAll("[data-slot]").forEach(b=>b.addEventListener("click",()=>{state.slot=Number(b.dataset.slot);render()}));
    document.querySelector("#retryStaff")?.addEventListener("click",async()=>{state.loadError=null;state.staffList=[];render()});
    document.querySelector("#retrySlots")?.addEventListener("click",async()=>{state.loadError=null;state.slots=[];render()});

    document.querySelector("#next")?.addEventListener("click",async()=>{
      if(step==="location"&&!state.location)return toast("Выберите филиал","error");
      if(step==="service"&&!state.service)return toast("Выберите услугу","error");
      if(step==="staff"&&!cfg.allow_any_staff&&!state.staff)return toast("Выберите специалиста","error");
      if(step==="datetime"&&state.slot===null)return toast("Выберите время","error");
      state.index=Math.min(steps.length-1,state.index+1);state.loadError=null;render();
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
        app.innerHTML='<div class="booking-shell" style="--accent:'+esc(cfg.primary_color)+'"><div class="booking-card"><div class="booking-body" style="padding-top:60px;text-align:center"><div style="width:64px;height:64px;border-radius:50%;background:var(--success-soft);color:var(--success);display:grid;place-items:center;font-size:30px;margin:0 auto 18px">✓</div><h1>Вы записаны</h1><p class="muted">'+esc(state.service.name)+' · '+dt(booking.start_at)+'</p><div class="summary" style="margin-top:22px;text-align:left"><b>'+esc(data.organization.name)+'</b><div class="muted tiny" style="margin-top:5px">'+esc(state.location.name)+'</div></div>'+(cfg.show_branding?'<div class="tiny muted" style="margin-top:26px">Powered by Lootly</div>':'')+'</div></div></div>';
      }catch(err){
        const message=friendlyError(err);
        if(String(err?.message||"").toLowerCase().includes("no longer available")){
          try{state.slots=[];state.loadError=null;await slotsLoad()}catch{}
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