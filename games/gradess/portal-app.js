const SUPABASE_URL='https://cfwsxpdbmefnnxrunoue.supabase.co';
const SUPABASE_ANON_KEY='sb_publishable_ByXgX6dPutVaTbluUs2fwg_p1A6Gc8I';
const supabase=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const DEFAULT_GRADES=[
{pd:'01',rot:'A',course:'WORLD HISTORY',teacher:'default',ex:0,unx:0,tardy:0,grade:'x'},
{pd:'02',rot:'A',course:'ENG 2',teacher:'default',ex:0,unx:0,tardy:0,grade:'x'},
{pd:'03',rot:'A',course:'PER CAR SCH DEV 1',teacher:'default',ex:0,unx:0,tardy:0,grade:'x'},
{pd:'04',rot:'A',course:'GEOMETRY',teacher:'default',ex:0,unx:0,tardy:0,grade:'x'},
{pd:'05',rot:'B',course:'MKT APPLCTNS LH',teacher:'default',ex:0,unx:0,tardy:0,grade:'x'},
{pd:'06',rot:'B',course:'NC STUDY HALL 1',teacher:'default',ex:0,unx:0,tardy:0,grade:'x'},
{pd:'07',rot:'B',course:'PERS FIT',teacher:'default',ex:0,unx:0,tardy:0,grade:'x'},
{pd:'08',rot:'B',course:'BIOLOGY 1',teacher:'default',ex:0,unx:0,tardy:0,grade:'x'}
];
const NAV=['🏠 Portal','ℹ️ School Info','👤 My Information','📋 Class Schedule','📄 Class Requests','🅰️ Grades','🏛️ Grad Reqs','📈 Test History','🚫 Absences','🔔 Attendance','🚩 Referrals','✍️ Applications & Forms','📁 Forms'];
document.getElementById('sidebar').innerHTML=NAV.map((n,i)=>{
  const[icon,...rest]=n.split(' ');
  return `<div class="nav-item${i===0?' active':''}"><span class="nav-icon">${icon}</span><span contenteditable="true">${rest.join(' ')}</span></div>`;
}).join('');
let currentUser=null,portalData=null;
async function init(){
  const lock=document.getElementById('lockScreen'),app=document.getElementById('portalApp');
  try{
    const{data:{session}}=await supabase.auth.getSession();
    if(!session||!session.user){
      let n=3;const cd=document.getElementById('countdown');
      const t=setInterval(()=>{n--;if(n<=0){clearInterval(t);window.location.replace('login.html');}else{cd.textContent='Redirecting in '+n+' second'+(n===1?'':'s')+'...';}},1000);
      return;
    }
    currentUser=session.user;
    lock.classList.add('hidden');
    app.style.display='block';
    await loadPortalData();renderGrades();applyMeta();
  }catch(err){
    document.querySelector('#lockScreen h1').textContent='Error';
    document.querySelector('#lockScreen p').innerHTML='Could not verify your session.<br>Please log in again.';
    setTimeout(()=>window.location.replace('login.html'),2500);
  }
}
supabase.auth.onAuthStateChange((event,session)=>{
  if(event==='SIGNED_OUT'||!session){
    document.getElementById('portalApp').style.display='none';
    document.getElementById('lockScreen').classList.remove('hidden');
    window.location.replace('login.html');
  }
});
async function loadPortalData(){
  try{
    const{data,error}=await supabase.from('portal_data').select('*').eq('user_id',currentUser.id).maybeSingle();
    if(error)throw error;
    if(data){portalData=data;}
    else{
      portalData={display_name:currentUser.user_metadata?.display_name||'STUDENT',school:'HOLLYWOOD HILLS HIGH (1661)',year:'2026-2027',grades:DEFAULT_GRADES,colors:{}};
      await supabase.from('portal_data').insert({user_id:currentUser.id,...portalData});
    }
  }catch(e){
    const key='portal_'+currentUser.id,saved=localStorage.getItem(key);
    portalData=saved?JSON.parse(saved):{display_name:currentUser.user_metadata?.display_name||'STUDENT',school:'HOLLYWOOD HILLS HIGH (1661)',year:'2026-2027',grades:DEFAULT_GRADES,colors:{}};
  }
  if(portalData.colors)Object.entries(portalData.colors).forEach(([k,v])=>{
    document.documentElement.style.setProperty(k,v);
    const input=document.querySelector(`input[data-var="${k}"]`);
    if(input)input.value=v;
  });
}
function applyMeta(){
  const name=portalData.display_name||'STUDENT';
  document.getElementById('userBtn').textContent=name;
  document.getElementById('studentName').textContent=name;
  document.getElementById('schoolName').textContent=portalData.school||'HOLLYWOOD HILLS HIGH (1661)';
  document.getElementById('studentSchool').textContent=portalData.school||'HOLLYWOOD HILLS HIGH (1661)';
  document.getElementById('yearText').textContent=portalData.year||'2026-2027';
}
function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function renderGrades(){
  const grades=portalData.grades||DEFAULT_GRADES;
  document.getElementById('gradesBody').innerHTML=grades.map((g,i)=>`<tr data-idx="${i}">
    <td class="col-pd" contenteditable="true">${esc(g.pd)}</td>
    <td class="col-rot" contenteditable="true">${esc(g.rot)}</td>
    <td class="link-blue" contenteditable="true">${esc(g.course)}</td>
    <td class="link-blue" contenteditable="true">${esc(g.teacher)}</td>
    <td class="col-ex" contenteditable="true">${esc(g.ex)}</td>
    <td class="col-unx" contenteditable="true">${esc(g.unx)}</td>
    <td class="col-tardy" contenteditable="true">${esc(g.tardy)}</td>
    <td class="col-grade grade-cell" contenteditable="true">${esc(g.grade)}</td>
  </tr>`).join('');
}
function collectGrades(){
  return[...document.querySelectorAll('#gradesBody tr')].map(tr=>{
    const c=tr.querySelectorAll('td');
    return{pd:c[0].textContent.trim(),rot:c[1].textContent.trim(),course:c[2].textContent.trim(),teacher:c[3].textContent.trim(),ex:c[4].textContent.trim(),unx:c[5].textContent.trim(),tardy:c[6].textContent.trim(),grade:c[7].textContent.trim()};
  });
}
function collectColors(){
  const colors={};
  document.querySelectorAll('#colorPanel input[type=color]').forEach(i=>colors[i.dataset.var]=i.value);
  return colors;
}
async function saveAll(){
  portalData.display_name=document.getElementById('studentName').textContent.trim();
  portalData.school=document.getElementById('studentSchool').textContent.trim();
  portalData.year=document.getElementById('yearText').textContent.trim();
  portalData.grades=collectGrades();
  portalData.colors=collectColors();
  document.getElementById('userBtn').textContent=portalData.display_name;
  document.getElementById('schoolName').textContent=portalData.school;
  try{
    const{error}=await supabase.from('portal_data').upsert({user_id:currentUser.id,display_name:portalData.display_name,school:portalData.school,year:portalData.year,grades:portalData.grades,colors:portalData.colors,updated_at:new Date().toISOString()});
    if(error)throw error;
  }catch(e){localStorage.setItem('portal_'+currentUser.id,JSON.stringify(portalData));}
  const toast=document.getElementById('saveToast');
  toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1500);
}
let saveTimer;
document.addEventListener('focusout',e=>{if(e.target.isContentEditable){clearTimeout(saveTimer);saveTimer=setTimeout(saveAll,800);}});
document.querySelectorAll('.tab,.student-tab,.quarter').forEach(el=>{
  el.addEventListener('click',function(e){
    if(e.target.isContentEditable&&document.activeElement===e.target)return;
    const cls=[...this.classList].find(c=>['tab','student-tab','quarter'].includes(c));
    this.parentElement.querySelectorAll('.'+cls).forEach(s=>s.classList.remove('active'));
    this.classList.add('active');
  });
});
document.getElementById('sidebar').addEventListener('click',e=>{
  const item=e.target.closest('.nav-item');
  if(!item)return;
  document.querySelectorAll('.nav-item').forEach(s=>s.classList.remove('active'));
  item.classList.add('active');
});
function toggleColors(){document.getElementById('colorPanel').classList.toggle('open');}
document.addEventListener('keydown',e=>{if(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==='k'){e.preventDefault();toggleColors();}});
document.querySelectorAll('#colorPanel input[type=color]').forEach(input=>{
  input.addEventListener('input',()=>document.documentElement.style.setProperty(input.dataset.var,input.value));
});
function resetColors(){
  const d={'--header-bg':'#1e4d7b','--header-btn':'#2a5f8f','--sidebar-bg':'#f4f4f4','--sidebar-active':'#d6e4f0','--announcements-header':'#e67e22','--student-header':'#1e4d7b','--quarter-active':'#1e4d7b','--link-blue':'#3a7ab8','--table-header':'#dce4ec','--table-stripe':'#f0f4f8','--body-bg':'#e8e8e8','--content-bg':'#ececec'};
  Object.entries(d).forEach(([k,v])=>{document.documentElement.style.setProperty(k,v);const i=document.querySelector(`input[data-var="${k}"]`);if(i)i.value=v;});
}
document.getElementById('logoutBtn').addEventListener('click',async()=>{await supabase.auth.signOut();window.location.href='login.html';});
init();
