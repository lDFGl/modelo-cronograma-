const STORAGE_KEY = "fg_cronogramas_fase1_v1";
const AREAS = ["ADM","Obras","Demandas","Gerenciamento de Riscos","Governança","Compliance"];
const AREA_LABELS = {ADM:"Administrativo / Central",Obras:"Operacional / Obras",Demandas:"Demandas da Alta Administração","Gerenciamento de Riscos":"Gerenciamento de Riscos",Governança:"Governança",Compliance:"Compliance"};
const STATUS = {
  planejamento:{label:"Em planejamento",className:"planejamento"},
  andamento:{label:"Em andamento",className:"andamento"},
  concluido:{label:"Concluído",className:"concluido"},
  replanejado:{label:"Replanejado",className:"replanejado"},
  demanda:{label:"Demanda da alta gestão",className:"demanda"},
  novo:{label:"Novo / não iniciado",className:"novo"}
};
const MONTH_NAMES = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
let sourceData = null;
let works = [];
let currentView = "dashboard";
let toastTimer;

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value="") => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const monthLabel = key => { const [year,month] = key.split("-"); return MONTH_NAMES[Number(month)-1] + "/" + year; };
const monthDate = key => key + "-01";
const sortedMonths = obj => Object.keys(obj || {}).sort();
const latestMarkStatus = marks => {
  const keys = sortedMonths(marks);
  for(let i=keys.length-1;i>=0;i--){
    const mark = marks[keys[i]];
    if(mark === "✔") return "concluido";
    if(mark === "A") return "andamento";
    if(mark === "R") return "replanejado";
    if(mark === "D") return "demanda";
    if(mark === "P") return "planejamento";
  }
  return "novo";
};
const makeId = () => "fg-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2,7);
function buildInitialData(data){
  const list = [];
  (data.schedule2025_2027 || []).forEach((row,index)=>{
    const [title,area,marks] = row;
    list.push({id:"legacy-2527-"+index,title,area,type:"Histórico importado",status:latestMarkStatus(marks),priority:"media",months:marks,owner:"",code:(title.match(/\b(?:AI|AR|AD)-?\d{3}[_/-]?\d{4}\b/i)||[])[0]||"",notes:"Registro importado da planilha original. Marcações mensais preservadas.",source:"2025-2027",lockedSource:true});
  });
  (data.schedule2027 || []).forEach((row,index)=>{
    const [title,area,type,months] = row;
    const monthMap = {};
    months.forEach(key=>monthMap[key]="P");
    list.push({id:"legacy-2027-"+index,title,area,type,status:"planejamento",priority:"media",months:monthMap,owner:"",code:(title.match(/\b(?:AI|AR|AD)-?\d{3}[_/-]?\d{4}\b/i)||[])[0]||"",notes:"Planejamento conforme cronograma 2027 da planilha original. Marcações P preservadas.",source:"2027",lockedSource:true});
  });
  return list;
}
async function initialize(){
  try{
    const response = await fetch("data/historico.json");
    if(!response.ok) throw new Error("Não foi possível carregar o histórico.");
    sourceData = await response.json();
  }catch(error){
    sourceData = {legacy2023:[],schedule2025_2027:[],schedule2027:[],legend:{}};
    showToast("Não foi possível carregar o histórico de origem. Verifique a publicação do Pages.");
  }
  const initial = buildInitialData(sourceData);
  try{
    const stored = localStorage.getItem(STORAGE_KEY);
    if(stored){
      const parsed = JSON.parse(stored);
      works = Array.isArray(parsed.works) ? parsed.works : initial;
    }else{
      works = initial;
      persist();
    }
  }catch(error){
    works = initial;
    showToast("Não foi possível ler os dados locais. A carga histórica foi restaurada nesta sessão.");
  }
  $("#today-label").textContent = new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date());
  populateAreaFilter();
  renderAll();
}
function persist(){
  localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,updatedAt:new Date().toISOString(),works}));
}
function showToast(message){
  const el=$("#toast"); if(!el) return;
  el.textContent=message; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),3000);
}
function populateAreaFilter(){
  $("#filter-area").innerHTML='<option value="">Todas as áreas</option>'+AREAS.map(a=>'<option value="'+escapeHtml(a)+'">'+escapeHtml(AREA_LABELS[a]||a)+'</option>').join("");
}
function setView(view){
  currentView=view;
  document.querySelectorAll(".view").forEach(el=>el.classList.toggle("active",el.id===view+"-view"));
  document.querySelectorAll(".nav-link[data-view]").forEach(el=>el.classList.toggle("active",el.dataset.view===view));
  const titles={dashboard:["Painel executivo","Visão consolidada dos trabalhos, prazos e entregáveis."],schedules:["Cronogramas por área","Consulte, crie e atualize os trabalhos e suas programações."],history:["Histórico importado","Consulta das estruturas e etapas legadas da planilha de origem."]};
  $("#page-title").textContent=titles[view][0]; $("#page-subtitle").textContent=titles[view][1];
  if(view==="schedules") renderSchedules();
}
function getFilters(){
  return {area:$("#filter-area").value,year:$("#filter-year").value,status:$("#filter-status").value,search:$("#search-work").value.trim().toLowerCase()};
}
function filteredWorks(){
  const f=getFilters();
  return works.filter(w=>{
    const matchesArea=!f.area||w.area===f.area;
    const matchesYear=!f.year||Object.keys(w.months||{}).some(m=>m.startsWith(f.year))||(!Object.keys(w.months||{}).length&&String(w.year||"")===f.year);
    const matchesStatus=!f.status||w.status===f.status;
    const haystack=[w.title,w.code,w.type,w.owner,w.area].join(" ").toLowerCase();
    return matchesArea&&matchesYear&&matchesStatus&&(!f.search||haystack.includes(f.search));
  }).sort((a,b)=>a.title.localeCompare(b.title,"pt-BR"));
}
function renderAll(){renderDashboard();renderSchedules();renderHistory();}
function renderDashboard(){
  const total=works.length;
  const count=s=>works.filter(w=>w.status===s).length;
  const kpis=[
    ["Trabalhos cadastrados",total,"Carteira total de trabalhos","▤","#135c6c"],
    ["Concluídos",count("concluido"),"Com marcação de conclusão","✓","#25836b"],
    ["Em andamento",count("andamento"),"Trabalhos com execução indicada","↗","#4d789c"],
    ["Planejamento / replanejamento",count("planejamento")+count("replanejado"),"Itens planejados ou reprogramados","◷","#c58a31"]
  ];
  $("#kpi-grid").innerHTML=kpis.map(([label,value,foot,icon,color])=>'<article class="kpi" style="--accent:'+color+'"><span class="kpi-icon">'+icon+'</span><div class="kpi-label">'+label+'</div><div class="kpi-value">'+value+'</div><div class="kpi-foot">'+foot+'</div></article>').join("");
  const areaCounts=AREAS.map(a=>({area:a,count:works.filter(w=>w.area===a).length})).filter(x=>x.count).sort((a,b)=>b.count-a.count);
  const max=Math.max(1,...areaCounts.map(x=>x.count));
  $("#area-breakdown").innerHTML=areaCounts.length?areaCounts.map(x=>'<div><div class="area-row-top"><strong>'+escapeHtml(AREA_LABELS[x.area]||x.area)+'</strong><span>'+x.count+' trabalho(s) · '+Math.round(x.count/Math.max(1,total)*100)+'%</span></div><div class="bar-track"><div class="bar-fill" style="width:'+Math.round(x.count/max*100)+'%"></div></div></div>').join(""):'<div class="empty-state">Nenhum trabalho cadastrado.</div>';
  const statuses=[["concluido","Concluído","#25836b"],["andamento","Em andamento","#4d789c"],["planejamento","Em planejamento","#c58a31"],["replanejado","Replanejado","#bd5b57"],["demanda","Demanda da alta gestão","#78639b"],["novo","Novo / não iniciado","#9aa7ac"]];
  $("#status-breakdown").innerHTML=statuses.map(([key,label,color])=>'<div class="status-row"><span class="status-dot-small" style="--c:'+color+'"></span><span>'+label+'</span><strong>'+count(key)+'</strong></div>').join("");
  const upcoming=works.flatMap(w=>sortedMonths(w.months).filter(m=>w.months[m]!=="✔"&&m>="2026-11").map(m=>({work:w,month:m,mark:w.months[m]}))).sort((a,b)=>a.month.localeCompare(b.month)).slice(0,5);
  $("#upcoming-list").innerHTML=upcoming.length?upcoming.map(x=>'<div class="work-mini"><div class="date-chip">'+monthLabel(x.month).split("/")[0]+'<br>'+x.month.slice(0,4)+'</div><div><b>'+escapeHtml(x.work.title)+'</b><small>'+escapeHtml(AREA_LABELS[x.work.area]||x.work.area)+' · '+escapeHtml(x.mark==="P"?"Planejamento":x.mark==="R"?"Replanejado":x.mark==="A"?"Em andamento":x.mark)+'</small></div></div>').join(""):'<div class="empty-state">Não há marcos futuros importados. Adicione datas aos novos trabalhos para visualizar esta seção.</div>';
  const attention=works.filter(w=>["andamento","replanejado","demanda"].includes(w.status)).sort((a,b)=>a.title.localeCompare(b.title,"pt-BR")).slice(0,5);
  $("#attention-list").innerHTML=attention.length?attention.map(w=>'<div class="work-mini"><div class="date-chip">'+(w.status==="andamento"?"AND":w.status==="replanejado"?"REP":"DEM")+'</div><div><b>'+escapeHtml(w.title)+'</b><small>'+escapeHtml(AREA_LABELS[w.area]||w.area)+' · '+STATUS[w.status].label+'</small></div></div>').join(""):'<div class="empty-state">Nenhum item classificado como em andamento, replanejado ou demanda.</div>';
}
function renderSchedules(){
  const list=filteredWorks();
  const area=$("#filter-area").value;
  $("#schedule-area-title").textContent=area?(AREA_LABELS[area]||area):"Todos os trabalhos";
  $("#schedule-count").textContent=list.length+" registro(s) exibido(s)";
  $("#schedule-list").innerHTML=list.length?list.map(w=>{
    const months=sortedMonths(w.months).map(m=>'<span class="month-pill">'+monthLabel(m)+' · '+escapeHtml(w.months[m])+'</span>').join("");
    const status=STATUS[w.status]||STATUS.novo;
    return '<article class="schedule-card"><div><h3>'+escapeHtml(w.title)+'</h3><div class="schedule-meta"><span>'+escapeHtml(AREA_LABELS[w.area]||w.area)+'</span>'+(w.code?'<span>'+escapeHtml(w.code)+'</span>':'')+(w.type?'<span>'+escapeHtml(w.type)+'</span>':'')+(w.owner?'<span>Responsável: '+escapeHtml(w.owner)+'</span>':'')+'</div>'+(months?'<div class="month-pills">'+months+'</div>':'')+'</div><div class="schedule-right"><span class="badge '+status.className+'">'+status.label+'</span><div class="card-actions"><button class="icon-btn" data-edit="'+escapeHtml(w.id)+'" title="Editar">✎</button><button class="icon-btn" data-delete="'+escapeHtml(w.id)+'" title="Excluir">×</button></div></div></article>';
  }).join(""):'<div class="empty-box"><b>Nenhum trabalho encontrado</b>Ajuste os filtros ou cadastre um novo trabalho.</div>';
}
function renderHistory(){
  const legacy=sourceData?.legacy2023||[];
  $("#history-count").textContent=works.filter(w=>w.source).length+legacy.reduce((n,x)=>n+x.stages.length,0);
  $("#legacy-list").innerHTML=legacy.map(item=>'<article class="legacy-card"><b>'+escapeHtml(item.area)+'</b><small>'+escapeHtml(item.unit)+' · '+item.year+'</small><ol>'+item.stages.map(s=>'<li>'+escapeHtml(s)+'</li>').join("")+'</ol><p>'+escapeHtml(item.note)+'</p></article>').join("");
}
function openModal(work=null){
  $("#work-form").reset(); $("#work-id").value=work?.id||"";
  $("#modal-title").textContent=work?"Editar trabalho":"Novo trabalho";
  $("#work-name").value=work?.title||""; $("#work-area").value=work?.area||"ADM";
  $("#work-type").value=work?.type||"Novo escopo"; $("#work-status").value=work?.status||"novo";
  $("#work-priority").value=work?.priority||"media"; $("#work-owner").value=work?.owner||"";
  $("#work-code").value=work?.code||""; $("#work-notes").value=work?.notes||"";
  const months=sortedMonths(work?.months||{});
  $("#work-start").value=work?.start|| (months[0]?monthDate(months[0]):"");
  $("#work-end").value=work?.end|| (months.at(-1)?monthDate(months.at(-1)):"");
  $("#work-modal").classList.add("open"); $("#work-modal").setAttribute("aria-hidden","false");
  setTimeout(()=>$("#work-name").focus(),50);
}
function closeModal(){ $("#work-modal").classList.remove("open"); $("#work-modal").setAttribute("aria-hidden","true"); }
function saveWork(event){
  event.preventDefault();
  const id=$("#work-id").value;
  const previous=works.find(w=>w.id===id);
  const start=$("#work-start").value,end=$("#work-end").value;
  if(start&&end&&end<start){showToast("A data final não pode ser anterior à data inicial.");return;}
  const months={...(previous?.months||{})};
  if(start&&end){
    let cursor=new Date(start+"T12:00:00"),last=new Date(end+"T12:00:00"),guard=0;
    while(cursor<=last&&guard++<60){const key=cursor.getFullYear()+"-"+String(cursor.getMonth()+1).padStart(2,"0");if(!months[key])months[key]="P";cursor.setMonth(cursor.getMonth()+1);}
  }else if(start){const key=start.slice(0,7);if(!months[key])months[key]="P";}
  const item={id:id||makeId(),title:$("#work-name").value.trim(),area:$("#work-area").value,type:$("#work-type").value,status:$("#work-status").value,priority:$("#work-priority").value,start,end,owner:$("#work-owner").value.trim(),code:$("#work-code").value.trim(),notes:$("#work-notes").value.trim(),months,source:previous?.source||"cadastro",lockedSource:false};
  if(previous){works=works.map(w=>w.id===id?item:w);}else{works.unshift(item);}
  persist();closeModal();renderAll();showToast(previous?"Trabalho atualizado.":"Trabalho cadastrado.");
}
function deleteWork(id){
  const work=works.find(w=>w.id===id); if(!work)return;
  if(!confirm('Excluir o trabalho "'+work.title+'"? Esta ação será aplicada aos dados locais deste navegador.'))return;
  works=works.filter(w=>w.id!==id);persist();renderAll();showToast("Trabalho excluído.");
}
function exportBackup(){
  const backup={application:"Cronogramas FG",version:1,exportedAt:new Date().toISOString(),source:sourceData?.source||"Cronograma_FG_Empreendimentos_2025-2027.xlsx",works};
  downloadFile("backup-cronogramas-fg-"+new Date().toISOString().slice(0,10)+".json",JSON.stringify(backup,null,2),"application/json");
  showToast("Backup JSON gerado.");
}
function restoreBackup(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const parsed=JSON.parse(reader.result);
      const imported=Array.isArray(parsed)?parsed:parsed.works;
      if(!Array.isArray(imported)||!imported.every(w=>w&&typeof w.title==="string"&&typeof w.area==="string"))throw new Error("Formato inválido");
      if(!confirm("A restauração substituirá os dados locais atuais por "+imported.length+" registro(s). Deseja continuar?"))return;
      works=imported;persist();populateAreaFilter();renderAll();showToast("Backup restaurado com sucesso.");
    }catch(error){showToast("Arquivo inválido. Selecione um backup JSON gerado pelo sistema.");}
    $("#restore-file").value="";
  };
  reader.readAsText(file);
}
function downloadFile(name,content,type){
  const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
function exportCsv(){
  const rows=[["Trabalho","Área","Tipo","Status","Prioridade","Responsável","Código","Meses","Observações"]];
  filteredWorks().forEach(w=>rows.push([w.title,AREA_LABELS[w.area]||w.area,w.type||"",STATUS[w.status]?.label||w.status,w.priority||"",w.owner||"",w.code||"",sortedMonths(w.months).map(m=>monthLabel(m)+":"+w.months[m]).join(" | "),w.notes||""]));
  const csv="\ufeff"+rows.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(";")).join("\r\n");
  downloadFile("cronogramas-fg.csv",csv,"text/csv;charset=utf-8");showToast("CSV exportado.");
}
document.addEventListener("click",event=>{
  const view=event.target.closest("[data-view]");if(view){setView(view.dataset.view);return;}
  if(event.target.closest("#new-work")||event.target.closest("#new-work-2")){openModal();return;}
  const edit=event.target.closest("[data-edit]");if(edit){openModal(works.find(w=>w.id===edit.dataset.edit));return;}
  const del=event.target.closest("[data-delete]");if(del){deleteWork(del.dataset.delete);return;}
  const close=event.target.closest('[data-close="modal"]');if(close){closeModal();return;}
  const action=event.target.closest("[data-action]")?.dataset.action;
  if(action==="backup"){const choice=confirm("OK para exportar backup JSON. Cancelar para restaurar um backup existente.");if(choice)exportBackup();else $("#restore-file").click();}
  if(action==="about"){alert("Sistema Executivo de Gestão de Cronogramas FG — Fase 1.\n\nOs dados são armazenados localmente no navegador. Não há sincronização, login ou banco de dados nesta versão. Exporte backups regularmente.");}
});
$("#work-form").addEventListener("submit",saveWork);
["filter-area","filter-year","filter-status","search-work"].forEach(id=>$("#"+id).addEventListener("input",renderSchedules));
$("#export-csv").addEventListener("click",exportCsv);
$("#restore-file").addEventListener("change",event=>{if(event.target.files[0])restoreBackup(event.target.files[0]);});
$("#work-modal").addEventListener("click",event=>{if(event.target.classList.contains("modal-backdrop"))closeModal();});
document.addEventListener("keydown",event=>{if(event.key==="Escape")closeModal();});
initialize();