(() => {
  const cfg = window.APP_CONFIG || {};
  const ready = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes("YOUR_") && !cfg.SUPABASE_ANON_KEY.includes("YOUR_") &&
    window.supabase;
  const $ = id => document.getElementById(id);
  let db = null, currentUser = null, currentView = "dashboard";
  let clients = [], followups = [], communications = [], notes = [], monthCursor = new Date();
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtDate = d => d ? new Date(d+"T00:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}) : "—";
  const dateKey = d => { const x=new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`; };
  const today = () => dateKey(new Date());
  const toast = (msg,error=false) => { const el=$("toast"); el.textContent=msg; el.classList.toggle("error",error); el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),3200); };
  const err = e => { console.error(e); toast(e?.message || "Something went wrong. Please try again.",true); };
  const open = id => $(id).showModal();
  const close = id => $(id).close();
  const clientName = id => clients.find(c=>c.id===id)?.full_name || "Unknown client";
  const setView = view => { currentView=view; document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===view)); const titles={dashboard:"Dashboard",calendar:"Calendar",clients:"Clients",followups:"Follow-ups",communications:"Conversation history",reports:"Reports & analytics",settings:"Settings"}; $("page-title").textContent=titles[view]||"Dashboard"; $("top-eyebrow").textContent=view==="communications"?"CLIENT RELATIONSHIPS":"WORKSPACE"; render(); $("sidebar").classList.remove("open"); };
  async function loadAll(){
    const [c,f,m,n]=await Promise.all([
      db.from("clients").select("*").order("created_at",{ascending:false}),
      db.from("followups").select("*").order("scheduled_date",{ascending:true}).order("scheduled_time",{ascending:true}),
      db.from("communications").select("*").order("occurred_at",{ascending:false}).limit(250),
      db.from("client_notes").select("*").order("created_at",{ascending:false}).limit(250)
    ]);
    for(const r of [c,f,m,n]) if(r.error) throw r.error;
    clients=c.data||[]; followups=f.data||[]; communications=m.data||[]; notes=n.data||[];
  }
  async function refresh(){ await loadAll(); render(); }
  function stat(label,value,hint){return `<article class="stat-card"><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-hint">${hint}</div></article>`;}
  function tempBadge(t){return `<span class="badge ${esc(t||"warm")}">${esc(t||"warm")}</span>`;}
  function priorityBadge(p){return `<span class="badge priority-${esc(p||"normal")}">${esc(p||"normal")}</span>`;}
  function clientRow(c){return `<article class="client-row"><div><h4>${esc(c.full_name)} ${tempBadge(c.temperature)}</h4><p>${esc(c.interested_model||"No model recorded")} · ${esc(c.email||c.phone||"No contact details")}</p></div><div class="row-actions"><button class="tiny-btn" data-action="brief" data-id="${c.id}">Briefing</button><button class="tiny-btn" data-action="edit-client" data-id="${c.id}">Edit</button><button class="tiny-btn" data-action="log" data-id="${c.id}">Log conversation</button></div></article>`;}
  function eventRow(f){return `<article class="event-row"><div><h4>${esc(clientName(f.client_id))}</h4><p>${fmtDate(f.scheduled_date)} · ${esc((f.scheduled_time||"").slice(0,5))} · ${esc(f.purpose||"")}</p></div><div class="row-actions">${priorityBadge(f.priority)}<span class="badge">${esc(f.status||"scheduled")}</span><button class="tiny-btn" data-action="complete" data-id="${f.id}">Complete</button><button class="tiny-btn" data-action="reschedule" data-id="${f.id}">Reschedule</button></div></article>`;}
  function dashboard(){
    const due=followups.filter(f=>f.status==="scheduled"&&f.scheduled_date===today());
    const overdue=followups.filter(f=>f.status==="scheduled"&&f.scheduled_date<today());
    const upcoming=followups.filter(f=>f.status==="scheduled"&&f.scheduled_date>=today()).slice(0,7);
    const hot=clients.filter(c=>c.temperature==="hot").length;
    return `<div class="grid stats-grid">${stat("Registered clients",clients.length,"Total client records")}${stat("Today's follow-ups",due.length,"Scheduled for today")}${stat("Overdue follow-ups",overdue.length,"Requires attention")}${stat("Hot clients",hot,"High-interest prospects")}</div>
    <div class="grid content-grid"><section class="panel"><div class="panel-head"><div><h3>Upcoming follow-ups</h3><p>Your next scheduled client touchpoints</p></div><button class="secondary" data-goto="followups">View all</button></div><div class="event-list">${upcoming.length?upcoming.map(eventRow).join(""):'<div class="empty-state">No upcoming follow-ups. Schedule your next client touchpoint.</div>'}</div></section>
    <section class="panel"><div class="panel-head"><div><h3>Client temperature</h3><p>Current relationship distribution</p></div></div>${["hot","warm","cold"].map(t=>{let n=clients.filter(c=>c.temperature===t).length;let pct=clients.length?Math.round(n/clients.length*100):0;return `<p class="muted-line">${t.toUpperCase()} · ${n}</p><div class="metric-bar"><span style="width:${pct}%"></span></div>`}).join("")}<div style="height:16px"></div><div class="panel-head"><div><h3>Recently added</h3><p>Latest client registrations</p></div></div><div class="client-list">${clients.slice(0,4).map(clientRow).join("")||'<p class="muted-line">No clients registered yet.</p>'}</div></section></div>`;
  }
  function calendar(){
    const y=monthCursor.getFullYear(),m=monthCursor.getMonth(),first=new Date(y,m,1),start=new Date(y,m,1-first.getDay()),days=[];
    for(let i=0;i<42;i++){let d=new Date(start);d.setDate(start.getDate()+i);days.push(d);}
    return `<section class="panel"><div class="calendar-head"><div class="row-actions"><button class="tiny-btn" data-action="month-prev">←</button><button class="tiny-btn" data-action="month-today">Today</button><button class="tiny-btn" data-action="month-next">→</button></div><h3>${monthCursor.toLocaleDateString(undefined,{month:"long",year:"numeric"})}</h3><button class="primary" data-action="new-followup">＋ Follow-up</button></div><div class="calendar-grid">${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>`<div class="calendar-day-name">${d}</div>`).join("")}${days.map(d=>{let k=dateKey(d),items=followups.filter(f=>f.scheduled_date===k&&f.status==="scheduled");return `<div class="calendar-cell ${d.getMonth()!==m?"outside":""} ${k===today()?"today":""}"><div class="day-num">${d.getDate()}</div>${items.slice(0,3).map(f=>`<button class="cal-event" data-action="event-detail" data-id="${f.id}">${esc((f.scheduled_time||"").slice(0,5))} ${esc(clientName(f.client_id))}</button>`).join("")}${items.length>3?`<div class="muted-line">+${items.length-3} more</div>`:""}</div>`}).join("")}</div></section>`;
  }
  function clientsView(){
    return `<div class="toolbar"><input class="search" id="client-search" placeholder="Search clients by name, email, phone or model"><select class="filter" id="client-filter"><option value="">All temperatures</option><option value="hot">Hot</option><option value="warm">Warm</option><option value="cold">Cold</option></select><button class="primary" data-action="new-client">＋ Register client</button></div><div class="client-list" id="client-results">${clients.map(clientRow).join("")||'<div class="empty-state">No clients yet. Register your first client.</div>'}</div>`;
  }
  function followupsView(){
    let rows=followups.filter(f=>f.status==="scheduled");
    return `<div class="toolbar"><button class="primary" data-action="new-followup">＋ Schedule follow-up</button><select class="filter" id="follow-filter"><option value="scheduled">Scheduled</option><option value="missed">Missed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="rescheduled">Rescheduled</option><option value="">All statuses</option></select></div><div class="event-list" id="follow-results">${rows.map(eventRow).join("")||'<div class="empty-state">No scheduled follow-ups.</div>'}</div>`;
  }
  function communicationsView(){
    return `<div class="toolbar"><button class="primary" data-action="new-communication">＋ Log conversation</button><input class="search" id="comm-search" placeholder="Search notes, client names or channels"></div><div class="history-list" id="comm-results">${communications.map(c=>`<article class="history-row"><div><h4>${esc(clientName(c.client_id))} · ${esc(c.channel||"Other")}</h4><p>${new Date(c.occurred_at).toLocaleString()} · ${esc(c.notes||"No notes")}</p>${c.client_questions?`<p><strong>Concerns:</strong> ${esc(c.client_questions)}</p>`:""}${c.agreed_next_steps?`<p><strong>Next steps:</strong> ${esc(c.agreed_next_steps)}</p>`:""}</div></article>`).join("")||'<div class="empty-state">No conversation history yet.</div>'}</div>`;
  }
  function reports(){
    const completed=followups.filter(f=>f.status==="completed").length, missed=followups.filter(f=>f.status==="missed").length, scheduled=followups.filter(f=>f.status==="scheduled").length;
    const conversion=clients.length?Math.round((completed/clients.length)*100):0;
    const models={}; clients.forEach(c=>{if(c.interested_model)models[c.interested_model]=(models[c.interested_model]||0)+1;});
    return `<div class="grid stats-grid">${stat("Completed follow-ups",completed,"Recorded as completed")}${stat("Missed follow-ups",missed,"Require review")}${stat("Currently scheduled",scheduled,"Upcoming touchpoints")}${stat("Follow-up / client ratio",`${conversion}%`,"Completed follow-ups relative to clients")}</div><section class="panel"><div class="panel-head"><div><h3>Popular Toyota models</h3><p>Based on registered client interests</p></div></div>${Object.entries(models).sort((a,b)=>b[1]-a[1]).map(([name,n])=>`<p class="muted-line">${esc(name)} · ${n} client(s)</p><div class="metric-bar"><span style="width:${clients.length?100*n/clients.length:0}%"></span></div>`).join("")||'<p class="muted-line">No model-interest data yet.</p>'}</section>`;
  }
  function settings(){return `<section class="panel"><div class="panel-head"><div><h3>Workspace settings</h3><p>Personal preferences for your private account</p></div></div><p class="muted-line">Appearance</p><button class="secondary" id="settings-theme">Toggle light / dark mode</button><hr style="border:0;border-top:1px solid var(--line);margin:20px 0"><h3>Account</h3><p class="muted-line">${esc(currentUser?.email||"")}</p><p class="muted-line">This workspace is configured for one authorized user. Confirm Row Level Security and account policies in Supabase before entering real customer information.</p></section>`;}
  function render(){
    const views={dashboard,calendar,clients:clientsView,followups:followupsView,communications:communicationsView,reports,settings};
    $("page-content").innerHTML=(views[currentView]||dashboard)();
    bindViewControls();
  }
  function bindViewControls(){
    document.querySelectorAll("[data-goto]").forEach(b=>b.onclick=()=>setView(b.dataset.goto));
    const search=$("client-search"); if(search) search.oninput=()=>{let q=search.value.toLowerCase(),t=$("client-filter").value;let list=clients.filter(c=>(!t||c.temperature===t)&&[c.full_name,c.email,c.phone,c.interested_model].some(v=>(v||"").toLowerCase().includes(q)));$("client-results").innerHTML=list.map(clientRow).join("")||'<div class="empty-state">No matching clients.</div>';};
    const filter=$("client-filter");if(filter)filter.onchange=()=>search.dispatchEvent(new Event("input"));
    const ff=$("follow-filter");if(ff)ff.onchange=()=>{let v=ff.value;let rows=followups.filter(f=>!v||f.status===v);$("follow-results").innerHTML=rows.map(eventRow).join("")||'<div class="empty-state">No follow-ups found.</div>';};
    const cs=$("comm-search");if(cs)cs.oninput=()=>{let q=cs.value.toLowerCase();let rows=communications.filter(c=>(clientName(c.client_id)+" "+(c.channel||"")+" "+(c.notes||"")).toLowerCase().includes(q));$("comm-results").innerHTML=rows.map(c=>`<article class="history-row"><div><h4>${esc(clientName(c.client_id))} · ${esc(c.channel||"Other")}</h4><p>${new Date(c.occurred_at).toLocaleString()} · ${esc(c.notes||"No notes")}</p></div></article>`).join("")||'<div class="empty-state">No matching conversations.</div>';};
  }
  function fillClientSelect(id,selected){$(id).innerHTML='<option value="">Choose a client</option>'+clients.map(c=>`<option value="${c.id}" ${selected===c.id?"selected":""}>${esc(c.full_name)}</option>`).join("");}
  function newClient(){ $("client-form").reset();$("client-id").value="";$("client-dialog-title").textContent="Register client";$("client-temperature").value="warm";open("client-dialog");}
  function editClient(id){let c=clients.find(x=>x.id===id);if(!c)return;$("client-form").reset();$("client-id").value=c.id;$("client-name").value=c.full_name||"";$("client-email").value=c.email||"";$("client-phone").value=c.phone||"";$("client-temperature").value=c.temperature||"warm";$("client-model").value=c.interested_model||"";$("client-needs").value=c.needs||"";$("client-general-notes").value=c.general_notes||"";$("client-dialog-title").textContent="Edit client";open("client-dialog");}
  function newFollowup(clientId){$("followup-form").reset();$("followup-id").value="";fillClientSelect("followup-client",clientId);$("followup-date").value=today();$("followup-time").value="10:00";$("followup-dialog-title").textContent="Schedule follow-up";open("followup-dialog");}
  function newComm(clientId){$("communication-form").reset();fillClientSelect("comm-client",clientId);$("comm-date").value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);open("communication-dialog");}
  async function briefing(id){
    const c=clients.find(x=>x.id===id);if(!c)return;
    const history=communications.filter(x=>x.client_id===id).slice(0,6);
    const clientNotes=notes.filter(x=>x.client_id===id).slice(0,6);
    const next=followups.filter(x=>x.client_id===id&&x.status==="scheduled").sort((a,b)=>(a.scheduled_date||"").localeCompare(b.scheduled_date||""))[0];
    const html=`<div class="briefing"><h4>Pre-follow-up briefing · ${esc(c.full_name)}</h4><p><strong>Temperature:</strong> ${esc(c.temperature||"warm")} · <strong>Interested model:</strong> ${esc(c.interested_model||"Not recorded")}</p><p><strong>Needs:</strong> ${esc(c.needs||"No specific needs recorded.")}</p><p><strong>General notes:</strong> ${esc(c.general_notes||"None")}</p><p><strong>Next scheduled:</strong> ${next?fmtDate(next.scheduled_date)+" "+esc(next.scheduled_time||""):"No scheduled follow-up"}</p><strong>Recent outgoing conversations</strong>${history.length?`<ul>${history.map(h=>`<li>${new Date(h.occurred_at).toLocaleDateString()} · ${esc(h.channel)}: ${esc(h.notes||"No notes")} ${h.agreed_next_steps?"Next: "+esc(h.agreed_next_steps):""}</li>`).join("")}</ul>`:"<p>No conversation history yet.</p>"}<strong>Client notes</strong>${clientNotes.length?`<ul>${clientNotes.map(n=>`<li>${esc(n.note||n.content||"")}</li>`).join("")}</ul>`:"<p>No additional notes.</p>"}</div>`;
    const wrap=document.createElement("div");wrap.innerHTML=html;
    const old=document.querySelector(".briefing-modal");if(old)old.remove();
    const d=document.createElement("dialog");d.className="modal briefing-modal";d.innerHTML=`<div class="modal-card">${wrap.innerHTML}<div class="modal-actions"><button class="primary" id="brief-close">Close briefing</button><button class="secondary" id="brief-log">Log conversation</button></div></div>`;document.body.append(d);d.showModal();d.querySelector("#brief-close").onclick=()=>d.close();d.querySelector("#brief-log").onclick=()=>{d.close();newComm(id);};d.addEventListener("close",()=>d.remove());
  }
  async function saveClient(e){
    e.preventDefault();const id=$("client-id").value;const payload={user_id:currentUser.id,full_name:$("client-name").value.trim(),email:$("client-email").value.trim()||null,phone:$("client-phone").value.trim()||null,temperature:$("client-temperature").value,interested_model:$("client-model").value.trim()||null,needs:$("client-needs").value.trim()||null,general_notes:$("client-general-notes").value.trim()||null};
    if(!payload.full_name)return;
    const duplicate=clients.find(c=>c.id!==id&&((payload.email&&c.email?.toLowerCase()===payload.email.toLowerCase())||(payload.phone&&c.phone===payload.phone)));
    if(duplicate&&!confirm(`Possible duplicate: ${duplicate.full_name}. Save anyway?`))return;
    const q=id?db.from("clients").update(payload).eq("id",id):db.from("clients").insert(payload);
    const {error}=await q;if(error)return err(error);close("client-dialog");toast("Client saved.");await refresh();
  }
  async function saveFollowup(e){
    e.preventDefault();const id=$("followup-id").value;const payload={user_id:currentUser.id,client_id:$("followup-client").value,scheduled_date:$("followup-date").value,scheduled_time:$("followup-time").value+":00",priority:$("followup-priority").value,reminder_minutes:Number($("followup-reminder").value||0),purpose:$("followup-purpose").value.trim(),status:"scheduled"};
    if(!payload.client_id)return toast("Choose a client.",true);
    let q;
    if(id){const old=followups.find(f=>f.id===id);if(old){const {error:historyError}=await db.from("followups").update({status:"rescheduled",updated_at:new Date().toISOString()}).eq("id",id);if(historyError)return err(historyError);}q=db.from("followups").insert(payload);}
    else q=db.from("followups").insert(payload);
    const {error}=await q;if(error)return err(error);close("followup-dialog");toast(id?"Old event preserved; new follow-up scheduled.":"Follow-up scheduled.");await refresh();
  }
  async function saveCommunication(e){
    e.preventDefault();const payload={user_id:currentUser.id,client_id:$("comm-client").value,direction:"outgoing",channel:$("comm-channel").value,occurred_at:new Date($("comm-date").value).toISOString(),notes:$("comm-notes").value.trim()||null,client_questions:$("comm-questions").value.trim()||null,agreed_next_steps:$("comm-next").value.trim()||null,transcript:$("comm-transcript").value.trim()||null,resulting_followup_date:$("comm-follow-date").value||null};
    if(!payload.client_id)return toast("Choose a client.",true);const {error}=await db.from("communications").insert(payload);if(error)return err(error);close("communication-dialog");toast("Conversation saved.");await refresh();
  }
  async function completeFollowup(id){const {error}=await db.from("followups").update({status:"completed",completed_at:new Date().toISOString()}).eq("id",id);if(error)return err(error);toast("Follow-up marked completed.");await refresh();}
  async function rescheduleFollowup(id){let f=followups.find(x=>x.id===id);if(!f)return;$("followup-form").reset();$("followup-id").value=id;fillClientSelect("followup-client",f.client_id);$("followup-date").value=f.scheduled_date;$("followup-time").value=(f.scheduled_time||"10:00").slice(0,5);$("followup-priority").value=f.priority||"normal";$("followup-reminder").value=f.reminder_minutes??60;$("followup-purpose").value=f.purpose||"";$("followup-dialog-title").textContent="Reschedule follow-up";open("followup-dialog");}
  async function cancelFollowup(id){if(!confirm("Cancel this follow-up? Its history will be preserved."))return;const {error}=await db.from("followups").update({status:"cancelled",cancelled_at:new Date().toISOString()}).eq("id",id);if(error)return err(error);toast("Follow-up cancelled and preserved in history.");await refresh();}
  async function deleteClient(id){if(!confirm("Permanently delete this client and their linked records? This cannot be undone."))return;const {error}=await db.from("clients").delete().eq("id",id);if(error)return err(error);toast("Client deleted.");await refresh();}
  document.addEventListener("click",async e=>{
    const closeBtn=e.target.closest("[data-close]");if(closeBtn){close(closeBtn.dataset.close);return;}
    const nav=e.target.closest("[data-view]");if(nav){setView(nav.dataset.view);return;}
    const action=e.target.closest("[data-action]");if(!action)return;const id=action.dataset.id;
    switch(action.dataset.action){
      case "new-client":newClient();break;case "edit-client":editClient(id);break;case "brief":briefing(id);break;case "log":newComm(id);break;case "new-followup":newFollowup();break;case "new-communication":newComm();break;case "complete":await completeFollowup(id);break;case "reschedule":rescheduleFollowup(id);break;case "cancel":await cancelFollowup(id);break;case "delete-client":await deleteClient(id);break;case "month-prev":monthCursor.setMonth(monthCursor.getMonth()-1);render();break;case "month-next":monthCursor.setMonth(monthCursor.getMonth()+1);render();break;case "month-today":monthCursor=new Date();render();break;case "event-detail":{let f=followups.find(x=>x.id===id);if(f&&confirm(`${clientName(f.client_id)}\n${f.purpose}\n\nOK = mark completed\nCancel = reschedule`)){await completeFollowup(id)}else if(f)rescheduleFollowup(id);break;}
    }
  });
  $("client-form").addEventListener("submit",saveClient);$("followup-form").addEventListener("submit",saveFollowup);$("communication-form").addEventListener("submit",saveCommunication);
  $("quick-add").onclick=newClient;$("mobile-menu").onclick=()=>$("sidebar").classList.toggle("open");$("theme-toggle").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("cfm-theme",document.body.classList.contains("dark")?"dark":"light");};$("signout-btn").onclick=async()=>{await db.auth.signOut();location.reload();};
  document.addEventListener("click",e=>{if(e.target.id==="settings-theme")$("theme-toggle").click();});
  $("login-form").addEventListener("submit",async e=>{e.preventDefault();if(!db)return;const {error}=await db.auth.signInWithPassword({email:$("login-email").value,password:$("login-password").value});if(error){$("auth-message").textContent=error.message;return;}await boot();});
  async function boot(){
    const {data:{session}}=await db.auth.getSession();currentUser=session?.user||null;
    if(!currentUser){$("auth-screen").classList.remove("hidden");$("app-shell").classList.add("hidden");return;}
    $("auth-screen").classList.add("hidden");$("app-shell").classList.remove("hidden");
    if(localStorage.getItem("cfm-theme")==="dark")document.body.classList.add("dark");
    try{await refresh();}catch(e){err(e);}
  }
  document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
  if(!ready){$("auth-message").textContent="Setup required: add your Supabase Project URL and Publishable key to config.js, then reload this page.";return;}
  db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  boot();
  if("serviceWorker" in navigator && location.protocol!=="file:")navigator.serviceWorker.register("./service-worker.js").catch(console.warn);
})();
