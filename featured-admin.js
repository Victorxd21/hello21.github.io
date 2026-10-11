(function(){
  const SB_URL="https://makmmhmsssfhbfpzqfcj.supabase.co";
  const SB_KEY="sb_publishable_QPZuusUtLAqEz2gRuvbrlQ_ZlrzBII6";
  const ADMIN_PASS="papivictor";
  const SETUP_SQL=`-- Run once in Supabase → SQL Editor
create table if not exists public.featured_games (
  id uuid primary key default gen_random_uuid(),
  folder text not null unique,
  name text not null,
  file text default 'index.html',
  icon text default '🎮',
  images text[] not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.featured_games enable row level security;
drop policy if exists "Public read featured" on public.featured_games;
drop policy if exists "Public insert featured" on public.featured_games;
drop policy if exists "Public update featured" on public.featured_games;
drop policy if exists "Public delete featured" on public.featured_games;
create policy "Public read featured" on public.featured_games for select using (true);
create policy "Public insert featured" on public.featured_games for insert with check (true);
create policy "Public update featured" on public.featured_games for update using (true);
create policy "Public delete featured" on public.featured_games for delete using (true);
insert into storage.buckets (id, name, public)
  values ('featured-banners','featured-banners',true)
  on conflict (id) do update set public = true;
drop policy if exists "Public read banners" on storage.objects;
drop policy if exists "Public upload banners" on storage.objects;
drop policy if exists "Public update banners" on storage.objects;
drop policy if exists "Public delete banners" on storage.objects;
create policy "Public read banners" on storage.objects for select using (bucket_id = 'featured-banners');
create policy "Public upload banners" on storage.objects for insert with check (bucket_id = 'featured-banners');
create policy "Public update banners" on storage.objects for update using (bucket_id = 'featured-banners');
create policy "Public delete banners" on storage.objects for delete using (bucket_id = 'featured-banners');`;

  let FEATURED=[];
  let adminUnlocked=false;
  let pendingFiles=[];
  let carouselTimers=[];

  const sbHeaders=()=>({"apikey":SB_KEY,"Authorization":"Bearer "+SB_KEY,"Content-Type":"application/json","Accept":"application/json","Prefer":"return=representation"});

  async function sbFetch(path, opts){
    const o=opts||{};
    const headers=Object.assign(sbHeaders(), o.headers||{});
    if(o.body instanceof FormData || o.rawBody){ delete headers["Content-Type"]; }
    const r=await fetch(SB_URL+path,{method:o.method||"GET",headers,body:o.body,cache:"no-store"});
    const text=await r.text();
    let data=null;
    try{data=text?JSON.parse(text):null;}catch(_){data=text;}
    return {ok:r.ok,status:r.status,data};
  }

  async function loadFeatured(){
    const res=await sbFetch("/rest/v1/featured_games?select=*&order=sort_order.asc,created_at.desc");
    if(!res.ok){ FEATURED=[]; return {ok:false,error:res.data}; }
    FEATURED=Array.isArray(res.data)?res.data:[];
    return {ok:true};
  }

  function pathOfFeat(f){
    return f.folder?"games/"+f.folder+"/"+(f.file||"index.html"):"games/"+(f.file||"index.html");
  }

  function renderFeatured(){
    const root=document.getElementById("featuredRoot");
    if(!root)return;
    if(!FEATURED.length){root.innerHTML="";return;}
    let h='<div class="featured-head"><h2>Featured</h2><div class="line"></div></div>';
    FEATURED.forEach((f,fi)=>{
      const imgs=Array.isArray(f.images)?f.images.filter(Boolean):[];
      const p=pathOfFeat(f);
      h+='<div class="feat-card" data-path="'+p+'" data-feat="'+fi+'">';
      h+='<div class="feat-slides">';
      if(imgs.length){
        imgs.forEach((src,i)=>{h+='<img src="'+src+'" alt="" class="'+(i===0?'on':'')+'" loading="'+(i===0?'eager':'lazy')+'"/>';});
      }else{
        h+='<div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(167,139,250,.35),rgba(99,102,241,.2))"></div>';
      }
      h+='</div><div class="feat-grad"></div>';
      h+='<div class="feat-body"><span class="feat-badge">Featured</span>';
      h+='<div class="feat-title">'+(f.icon?f.icon+" ":"")+(f.name||f.folder)+'</div>';
      h+='<div class="feat-sub">'+p+'</div>';
      h+='<span class="feat-play">Play now →</span></div>';
      if(imgs.length>1){
        h+='<div class="feat-dots">';
        imgs.forEach((_,i)=>{h+='<span class="'+(i===0?'on':'')+'"></span>';});
        h+='</div>';
      }
      h+='</div>';
    });
    root.innerHTML=h;
    root.querySelectorAll(".feat-card").forEach(el=>{
      el.addEventListener("click",()=>{location.href=el.getAttribute("data-path");});
    });
    startFeaturedCarousels(root);
  }

  function startFeaturedCarousels(root){
    carouselTimers.forEach(clearInterval);carouselTimers=[];
    root.querySelectorAll(".feat-card").forEach(card=>{
      const imgs=[...card.querySelectorAll(".feat-slides img")];
      const dots=[...card.querySelectorAll(".feat-dots span")];
      if(imgs.length<2)return;
      let i=0;
      const t=setInterval(()=>{
        imgs[i].classList.remove("on");if(dots[i])dots[i].classList.remove("on");
        i=(i+1)%imgs.length;
        imgs[i].classList.add("on");if(dots[i])dots[i].classList.add("on");
      },3500);
      carouselTimers.push(t);
    });
  }

  function showAdminMsg(ok,msg){
    const o=document.getElementById("adminOk");
    const e=document.getElementById("adminPanelErr");
    if(o){o.classList.toggle("on",!!ok);o.textContent=ok?msg:"";}
    if(e){e.classList.toggle("on",!ok&&!!msg);e.textContent=!ok?msg:"";}
  }

  function showSetup(){
    const setupEl=document.getElementById("adminSetup");
    if(!setupEl)return;
    setupEl.classList.add("on");
    setupEl.innerHTML="<strong>Supabase setup needed.</strong> Run this once in Supabase → SQL Editor, then try again.<br><br><textarea readonly style=\"width:100%;height:100px;margin-top:8px;font-size:10px;background:#0a0a12;color:#e2e8f0;border:1px solid #333;border-radius:8px;padding:8px\">"+SETUP_SQL.replace(/</g,"&lt;")+"</textarea>";
  }

  function renderAdminList(){
    const list=document.getElementById("adminList");
    if(!list)return;
    if(!FEATURED.length){
      list.innerHTML='<div style="padding:12px;color:var(--muted);font-size:12px">No featured games yet. Press + Add.</div>';
      return;
    }
    list.innerHTML=FEATURED.map(f=>{
      const n=f.images&&f.images.length?f.images.length:0;
      return '<div class="admin-item" data-id="'+f.id+'"><span class="nm">'+(f.icon||"🎮")+" "+f.name+'</span><span style="color:var(--muted);font-size:11px">'+n+' img</span><button type="button" class="rm" data-id="'+f.id+'">Remove</button></div>';
    }).join("");
    list.querySelectorAll(".rm").forEach(btn=>{
      btn.addEventListener("click",async()=>{
        const id=btn.getAttribute("data-id");
        btn.disabled=true;btn.textContent="…";
        const res=await sbFetch("/rest/v1/featured_games?id=eq."+encodeURIComponent(id),{method:"DELETE"});
        if(!res.ok){showAdminMsg(false,"Delete failed: "+(res.data&&res.data.message||res.status));btn.disabled=false;btn.textContent="Remove";return;}
        await loadFeatured();renderFeatured();renderAdminList();
        showAdminMsg(true,"Removed.");
      });
    });
  }

  function getGamesList(){
    return fetch("https://api.github.com/repos/Victorxd21/hello21.github.io/contents/games",{headers:{"Accept":"application/vnd.github+json"},cache:"no-store"})
      .then(r=>r.json())
      .then(items=>{
        if(!Array.isArray(items))return [];
        return items.filter(x=>x.type==="dir").map(x=>{
          const folder=x.name;
          const pretty=folder.replace(/[-_]+/g," ").replace(/\b\w/g,c=>c.toUpperCase());
          return {folder,name:pretty,file:"index.html",icon:"🎮"};
        });
      })
      .catch(()=>[]);
  }

  async function fillGameSelect(){
    const sel=document.getElementById("adminGameSelect");
    if(!sel)return;
    const games=await getGamesList();
    const featuredFolders=new Set(FEATURED.map(f=>f.folder));
    const opts=['<option value="">Select a game…</option>'];
    games.filter(g=>g.folder!=="NotByMe").forEach(g=>{
      const disabled=featuredFolders.has(g.folder)?" disabled":"";
      opts.push('<option value="'+g.folder+'" data-name="'+g.name.replace(/"/g,"&quot;")+'" data-file="'+(g.file||"index.html")+'" data-icon="'+(g.icon||"🎮")+'"'+disabled+'>'+g.name+(disabled?" (already featured)":"")+'</option>');
    });
    sel.innerHTML=opts.join("");
  }

  async function uploadImage(file, folder, idx){
    const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,5)||"jpg";
    const path=folder+"/"+Date.now()+"_"+idx+"."+ext;
    const r=await fetch(SB_URL+"/storage/v1/object/featured-banners/"+path,{
      method:"POST",
      headers:{
        "apikey":SB_KEY,
        "Authorization":"Bearer "+SB_KEY,
        "Content-Type":file.type||"image/jpeg",
        "x-upsert":"true"
      },
      body:file
    });
    if(!r.ok){
      const t=await r.text();
      throw new Error("Upload failed ("+r.status+"): "+t.slice(0,200));
    }
    return SB_URL+"/storage/v1/object/public/featured-banners/"+path;
  }

  function wireAdmin(){
    const openBtn=document.getElementById("adminOpenBtn");
    const gate=document.getElementById("adminGate");
    const panel=document.getElementById("adminPanel");
    const passInput=document.getElementById("adminPass");
    const unlockBtn=document.getElementById("adminUnlockBtn");
    const cancelGate=document.getElementById("adminCancelGate");
    const err=document.getElementById("adminErr");
    const addBtn=document.getElementById("adminAddBtn");
    const addBox=document.getElementById("adminAddBox");
    const filesInput=document.getElementById("adminFiles");
    const previews=document.getElementById("adminPreviews");
    const submitBtn=document.getElementById("adminSubmitFeat");
    const cancelAdd=document.getElementById("adminCancelAdd");
    const lockBtn=document.getElementById("adminLockBtn");
    if(!openBtn)return;

    openBtn.addEventListener("click",()=>{
      if(adminUnlocked){
        gate.style.display="none";panel.style.display="";
        renderAdminList();fillGameSelect();
        return;
      }
      gate.style.display="";panel.style.display="none";
      if(passInput){passInput.value="";passInput.focus();}
      if(err)err.classList.remove("on");
    });
    cancelGate&&cancelGate.addEventListener("click",()=>{gate.style.display="none";});
    function tryUnlock(){
      const v=(passInput&&passInput.value)||"";
      if(v===ADMIN_PASS){
        adminUnlocked=true;
        if(err)err.classList.remove("on");
        gate.style.display="none";
        panel.style.display="";
        loadFeatured().then(r=>{
          if(!r.ok){ showSetup(); showAdminMsg(false,"Could not load featured table. Run the SQL setup below."); }
          else { showAdminMsg(true,"Admin unlocked."); }
          renderAdminList();fillGameSelect();
        });
      }else{
        if(err)err.classList.add("on");
      }
    }
    unlockBtn&&unlockBtn.addEventListener("click",tryUnlock);
    passInput&&passInput.addEventListener("keydown",e=>{if(e.key==="Enter")tryUnlock();});
    lockBtn&&lockBtn.addEventListener("click",()=>{
      adminUnlocked=false;panel.style.display="none";gate.style.display="none";
      if(passInput)passInput.value="";
    });
    addBtn&&addBtn.addEventListener("click",()=>{
      addBox.classList.add("on");fillGameSelect();pendingFiles=[];
      if(filesInput)filesInput.value="";
      if(previews)previews.innerHTML="";
    });
    cancelAdd&&cancelAdd.addEventListener("click",()=>{addBox.classList.remove("on");});
    filesInput&&filesInput.addEventListener("change",()=>{
      const files=[...filesInput.files].slice(0,5);
      pendingFiles=files;
      if(previews){
        previews.innerHTML="";
        files.forEach(f=>{
          const url=URL.createObjectURL(f);
          const img=document.createElement("img");img.src=url;img.alt="";
          previews.appendChild(img);
        });
      }
    });
    submitBtn&&submitBtn.addEventListener("click",async()=>{
      const sel=document.getElementById("adminGameSelect");
      const opt=sel&&sel.selectedOptions[0];
      if(!opt||!opt.value){showAdminMsg(false,"Select a game.");return;}
      if(!pendingFiles.length){showAdminMsg(false,"Upload 1–5 photos.");return;}
      if(pendingFiles.length>5){showAdminMsg(false,"Max 5 photos.");return;}
      submitBtn.disabled=true;submitBtn.textContent="Uploading…";
      showAdminMsg(true,"Uploading images…");
      try{
        const folder=opt.value;
        const name=opt.getAttribute("data-name")||folder;
        const file=opt.getAttribute("data-file")||"index.html";
        const icon=opt.getAttribute("data-icon")||"🎮";
        const urls=[];
        for(let i=0;i<pendingFiles.length;i++){
          urls.push(await uploadImage(pendingFiles[i],folder,i));
        }
        const body={folder,name,file,icon,images:urls,sort_order:FEATURED.length};
        const res=await sbFetch("/rest/v1/featured_games",{method:"POST",body:JSON.stringify(body)});
        if(!res.ok){
          throw new Error((res.data&&(res.data.message||res.data.error_description))||("HTTP "+res.status));
        }
        await loadFeatured();renderFeatured();renderAdminList();fillGameSelect();
        addBox.classList.remove("on");
        pendingFiles=[];if(filesInput)filesInput.value="";if(previews)previews.innerHTML="";
        showAdminMsg(true,"Featured game added!");
      }catch(e){
        showAdminMsg(false,String(e.message||e));
        const msg=String(e.message||e).toLowerCase();
        if(msg.includes("schema")||msg.includes("404")||msg.includes("bucket")||msg.includes("not find")) showSetup();
      }finally{
        submitBtn.disabled=false;submitBtn.textContent="Submit";
      }
    });
  }

  loadFeatured().then(()=>renderFeatured());
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",wireAdmin);
  else wireAdmin();

  const ref=document.getElementById("refresh");
  if(ref) ref.addEventListener("click",()=>loadFeatured().then(()=>renderFeatured()));
})();
