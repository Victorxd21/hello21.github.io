(function(){
  const SB_URL="https://makmmhmsssfhbfpzqfcj.supabase.co";
  const SB_KEY="sb_publishable_QPZuusUtLAqEz2gRuvbrlQ_ZlrzBII6";
  const FALLBACK_PASS="papivictor";

  const SETUP_SQL=`-- Run once in Supabase → SQL Editor\n\ncreate table if not exists public.featured_games (\n  id uuid primary key default gen_random_uuid(),\n  folder text not null unique,\n  name text not null,\n  file text default 'index.html',\n  icon text default '🎮',\n  images text[] not null default '{}',\n  video_url text default null,\n  sort_order int not null default 0,\n  created_at timestamptz not null default now()\n);\nalter table public.featured_games add column if not exists video_url text;\n\nalter table public.featured_games enable row level security;\ndrop policy if exists "Public read featured" on public.featured_games;\ndrop policy if exists "Public insert featured" on public.featured_games;\ndrop policy if exists "Public update featured" on public.featured_games;\ndrop policy if exists "Public delete featured" on public.featured_games;\ncreate policy "Public read featured" on public.featured_games for select using (true);\ncreate policy "Public insert featured" on public.featured_games for insert with check (true);\ncreate policy "Public update featured" on public.featured_games for update using (true);\ncreate policy "Public delete featured" on public.featured_games for delete using (true);\n\ncreate table if not exists public.hub_settings (\n  key text primary key,\n  value text not null,\n  updated_at timestamptz not null default now()\n);\nalter table public.hub_settings enable row level security;\ndrop policy if exists "Public read settings" on public.hub_settings;\ndrop policy if exists "Public write settings" on public.hub_settings;\ncreate policy "Public read settings" on public.hub_settings for select using (true);\ncreate policy "Public write settings" on public.hub_settings for insert with check (true);\ncreate policy "Public update settings" on public.hub_settings for update using (true);\n\ninsert into public.hub_settings (key, value)\n  values ('admin_password', 'papivictor')\n  on conflict (key) do nothing;\n\ninsert into storage.buckets (id, name, public)\n  values ('featured-banners','featured-banners',true)\n  on conflict (id) do update set public = true;\ninsert into storage.buckets (id, name, public)\n  values ('featured-videos','featured-videos',true)\n  on conflict (id) do update set public = true;\n\ndrop policy if exists "Public read banners" on storage.objects;\ndrop policy if exists "Public upload banners" on storage.objects;\ndrop policy if exists "Public update banners" on storage.objects;\ndrop policy if exists "Public delete banners" on storage.objects;\ncreate policy "Public read banners" on storage.objects for select using (bucket_id in ('featured-banners','featured-videos'));\ncreate policy "Public upload banners" on storage.objects for insert with check (bucket_id in ('featured-banners','featured-videos'));\ncreate policy "Public update banners" on storage.objects for update using (bucket_id in ('featured-banners','featured-videos'));\ncreate policy "Public delete banners" on storage.objects for delete using (bucket_id in ('featured-banners','featured-videos'));\n`;

  let FEATURED=[];
  let adminUnlocked=false;
  let pendingFiles=[];
  let pendingVideo=null;
  let carouselTimers=[];
  let currentDetail=null;
  let cachedAdminPass=null;

  function encodePathSeg(s){
    return String(s||"").split("/").map(function(p){
      try{return encodeURIComponent(decodeURIComponent(p));}catch(e){return encodeURIComponent(p);}
    }).join("/");
  }
  function fixImgUrl(src){
    if(!src)return src;
    try{
      var u=new URL(src);
      u.pathname=u.pathname.split("/").map(function(seg){
        if(!seg)return seg;
        try{return encodeURIComponent(decodeURIComponent(seg));}catch(e){return encodeURIComponent(seg);}
      }).join("/");
      return u.toString();
    }catch(e){
      return String(src).replace(/ /g,"%20");
    }
  }
  function storageFolderKey(folder){
    return String(folder||"game").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"")||"game";
  }

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

  async function loadAdminPassword(){
    if(cachedAdminPass!==null) return cachedAdminPass;
    try{
      const res=await sbFetch("/rest/v1/hub_settings?key=eq.admin_password&select=value");
      if(res.ok && Array.isArray(res.data) && res.data.length && res.data[0].value){
        cachedAdminPass=String(res.data[0].value);
        return cachedAdminPass;
      }
    }catch(e){}
    cachedAdminPass=FALLBACK_PASS;
    return cachedAdminPass;
  }

  async function saveAdminPassword(newPass){
    const body={key:"admin_password",value:newPass,updated_at:new Date().toISOString()};
    const res=await sbFetch("/rest/v1/hub_settings?on_conflict=key",{
      method:"POST",
      headers:{"Prefer":"resolution=merge-duplicates,return=representation"},
      body:JSON.stringify(body)
    });
    if(!res.ok){
      const res2=await sbFetch("/rest/v1/hub_settings?key=eq.admin_password",{
        method:"PATCH",
        body:JSON.stringify({value:newPass,updated_at:new Date().toISOString()})
      });
      if(!res2.ok) throw new Error((res2.data&&res2.data.message)||"Could not save password");
    }
    cachedAdminPass=newPass;
  }

  async function loadFeatured(){
    const res=await sbFetch("/rest/v1/featured_games?select=*&order=sort_order.asc,created_at.desc");
    if(!res.ok){ FEATURED=[]; return {ok:false,error:res.data}; }
    FEATURED=Array.isArray(res.data)?res.data:[];
    return {ok:true};
  }

  function pathOfFeat(f){
    var file=f.file||"index.html";
    if(f.folder){
      return "games/"+encodePathSeg(f.folder)+"/"+encodePathSeg(file);
    }
    return "games/"+encodePathSeg(file);
  }

  function openGameDetail(f){
    currentDetail=f;
    const modal=document.getElementById("gameDetailModal");
    if(!modal)return;
    const path=pathOfFeat(f);
    const imgs=Array.isArray(f.images)?f.images.filter(Boolean):[];
    const hero=document.getElementById("gdHero");
    const title=document.getElementById("gdTitle");
    const pathEl=document.getElementById("gdPath");
    const photos=document.getElementById("gdPhotos");
    const playBtn=document.getElementById("gdPlay");
    const videoBox=document.getElementById("gdVideoBox");
    const videoPrev=document.getElementById("gdVideoPreview");

    if(title) title.textContent=(f.icon?f.icon+" ":"")+(f.name||f.folder||"Game");
    if(pathEl) pathEl.textContent=path;

    if(hero){
      if(imgs.length){
        hero.innerHTML='<img src="'+fixImgUrl(imgs[0])+'" alt=""/><div class="gd-grad"></div>';
      }else{
        hero.innerHTML='<div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(167,139,250,.4),rgba(99,102,241,.25))"></div><div class="gd-grad"></div>';
      }
    }

    if(photos){
      if(imgs.length){
        photos.innerHTML=imgs.map(function(src,i){
          return '<img src="'+fixImgUrl(src)+'" alt="" data-i="'+i+'"/>';
        }).join("");
        photos.querySelectorAll("img").forEach(function(img){
          img.addEventListener("click",function(){
            if(hero) hero.innerHTML='<img src="'+img.src+'" alt=""/><div class="gd-grad"></div>';
          });
        });
      }else{
        photos.innerHTML='<span style="color:var(--muted);font-size:12px">No photos yet — add them in Admin</span>';
      }
    }

    if(playBtn){
      playBtn.onclick=function(){
        if(window.__recordView) window.__recordView(path);
        setTimeout(function(){ location.href=path; },80);
      };
    }

    const vurl=(f.video_url||"").trim();
    if(videoBox) videoBox.style.display=vurl?"":"none";
    renderVideoPreview(vurl, videoPrev);

    modal.classList.add("on");
  }

  function renderVideoPreview(url, el){
    if(!el)return;
    if(!url){ el.innerHTML=""; return; }
    var yt=url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
    if(yt){
      el.innerHTML='<iframe src="https://www.youtube.com/embed/'+yt[1]+'?rel=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%;height:220px;border-radius:12px;margin-top:8px;background:#000"></iframe>';
      return;
    }
    if(/\.(mp4|webm|ogg)(\?|$)/i.test(url) || url.includes("featured-videos") || url.includes("supabase")){
      el.innerHTML='<video src="'+url+'" controls playsinline preload="metadata" style="width:100%;max-height:240px;border-radius:12px;margin-top:8px;background:#000"></video>';
      return;
    }
    el.innerHTML='<a href="'+url+'" target="_blank" style="color:var(--a);font-size:13px">Open video link →</a>';
  }

  function wireDetailModal(){
    const modal=document.getElementById("gameDetailModal");
    const closeBtn=document.getElementById("gdClose");
    if(closeBtn) closeBtn.addEventListener("click",function(){ if(modal) modal.classList.remove("on"); });
    if(modal) modal.addEventListener("click",function(e){ if(e.target===modal) modal.classList.remove("on"); });
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
        imgs.forEach((src,i)=>{h+='<img src="'+fixImgUrl(src)+'" alt="" class="'+(i===0?'on':'')+'" loading="'+(i===0?'eager':'lazy')+'"/>';});
      }else{
        h+='<div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(167,139,250,.35),rgba(99,102,241,.2))"></div>';
      }
      h+='</div><div class="feat-grad"></div>';
      h+='<div class="feat-body"><span class="feat-badge">Featured</span>';
      h+='<div class="feat-title">'+(f.icon?f.icon+" ":"")+(f.name||f.folder)+'</div>';
      h+='<div class="feat-sub">'+p+'</div>';
      h+='<span class="feat-play">View →</span></div>';
      if(imgs.length>1){
        h+='<div class="feat-dots">';
        imgs.forEach((_,i)=>{h+='<span class="'+(i===0?'on':'')+'"></span>';});
        h+='</div>';
      }
      h+='</div>';
    });
    root.innerHTML=h;
    root.querySelectorAll(".feat-card").forEach(el=>{
      el.addEventListener("click",function(){
        const idx=parseInt(el.getAttribute("data-feat"),10);
        const f=FEATURED[idx];
        if(f) openGameDetail(f);
      });
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
    setupEl.innerHTML="<strong>Supabase setup needed.</strong> Run this once in Supabase → SQL Editor, then try again.<br><br><textarea readonly style=\"width:100%;height:140px;margin-top:8px;font-size:10px;background:#0a0a12;color:#e2e8f0;border:1px solid #333;border-radius:8px;padding:8px\">"+SETUP_SQL.replace(/</g,"&lt;")+"</textarea>";
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
      const hasVid=f.video_url?' · 🎬':'';
      return '<div class="admin-item" data-id="'+f.id+'"><span class="nm">'+(f.icon||"🎮")+" "+f.name+'</span><span style="color:var(--muted);font-size:11px">'+n+' img'+hasVid+'</span><button type="button" class="rm" data-id="'+f.id+'">Remove</button></div>';
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

  async function uploadToBucket(file, folder, idx, bucket){
    const ext=(file.name.split(".").pop()||"bin").toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,5)||"bin";
    const key=storageFolderKey(folder);
    const objectPath=key+"/"+Date.now()+"_"+idx+"."+ext;
    const r=await fetch(SB_URL+"/storage/v1/object/"+bucket+"/"+objectPath,{
      method:"POST",
      headers:{
        "apikey":SB_KEY,
        "Authorization":"Bearer "+SB_KEY,
        "Content-Type":file.type||"application/octet-stream",
        "x-upsert":"true"
      },
      body:file
    });
    if(!r.ok){
      const t=await r.text();
      throw new Error("Upload failed ("+r.status+"): "+t.slice(0,200));
    }
    return SB_URL+"/storage/v1/object/public/"+bucket+"/"+objectPath.split("/").map(encodeURIComponent).join("/");
  }

  async function uploadImage(file, folder, idx){
    return uploadToBucket(file, folder, idx, "featured-banners");
  }

  async function uploadVideo(file, folder){
    return uploadToBucket(file, folder, "vid", "featured-videos");
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
    const videoInput=document.getElementById("adminVideo");
    const videoUrlInput=document.getElementById("adminVideoUrl");
    const previews=document.getElementById("adminPreviews");
    const submitBtn=document.getElementById("adminSubmitFeat");
    const cancelAdd=document.getElementById("adminCancelAdd");
    const lockBtn=document.getElementById("adminLockBtn");
    const changePassBtn=document.getElementById("adminChangePassBtn");
    const newPassInput=document.getElementById("adminNewPass");
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

    async function tryUnlock(){
      const v=(passInput&&passInput.value)||"";
      const realPass=await loadAdminPassword();
      if(v===realPass){
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

    if(changePassBtn&&newPassInput){
      changePassBtn.addEventListener("click",async()=>{
        const np=(newPassInput.value||"").trim();
        if(np.length<4){showAdminMsg(false,"Password must be at least 4 characters.");return;}
        changePassBtn.disabled=true;changePassBtn.textContent="Saving…";
        try{
          await saveAdminPassword(np);
          newPassInput.value="";
          showAdminMsg(true,"Password updated in Supabase.");
        }catch(e){
          showAdminMsg(false,String(e.message||e));
          showSetup();
        }finally{
          changePassBtn.disabled=false;changePassBtn.textContent="Change password";
        }
      });
    }

    addBtn&&addBtn.addEventListener("click",()=>{
      addBox.classList.add("on");fillGameSelect();
      pendingFiles=[];pendingVideo=null;
      if(filesInput)filesInput.value="";
      if(videoInput)videoInput.value="";
      if(videoUrlInput)videoUrlInput.value="";
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

    videoInput&&videoInput.addEventListener("change",()=>{
      pendingVideo=videoInput.files&&videoInput.files[0]?videoInput.files[0]:null;
    });

    submitBtn&&submitBtn.addEventListener("click",async()=>{
      const sel=document.getElementById("adminGameSelect");
      const opt=sel&&sel.selectedOptions[0];
      if(!opt||!opt.value){showAdminMsg(false,"Select a game.");return;}
      if(!pendingFiles.length){showAdminMsg(false,"Upload 1–5 photos.");return;}
      if(pendingFiles.length>5){showAdminMsg(false,"Max 5 photos.");return;}
      submitBtn.disabled=true;submitBtn.textContent="Uploading…";
      showAdminMsg(true,"Uploading…");
      try{
        const folder=opt.value;
        const name=opt.getAttribute("data-name")||folder;
        const file=opt.getAttribute("data-file")||"index.html";
        const icon=opt.getAttribute("data-icon")||"🎮";
        const urls=[];
        for(let i=0;i<pendingFiles.length;i++){
          urls.push(await uploadImage(pendingFiles[i],folder,i));
        }
        let videoUrl=null;
        const typedUrl=(videoUrlInput&&videoUrlInput.value||"").trim();
        if(pendingVideo){
          showAdminMsg(true,"Uploading video…");
          videoUrl=await uploadVideo(pendingVideo,folder);
        }else if(typedUrl){
          videoUrl=typedUrl;
        }
        const body={folder,name,file,icon,images:urls,video_url:videoUrl,sort_order:FEATURED.length};
        const res=await sbFetch("/rest/v1/featured_games",{method:"POST",body:JSON.stringify(body)});
        if(!res.ok){
          throw new Error((res.data&&(res.data.message||res.data.error_description))||("HTTP "+res.status));
        }
        await loadFeatured();renderFeatured();renderAdminList();fillGameSelect();
        addBox.classList.remove("on");
        pendingFiles=[];pendingVideo=null;
        if(filesInput)filesInput.value="";
        if(videoInput)videoInput.value="";
        if(videoUrlInput)videoUrlInput.value="";
        if(previews)previews.innerHTML="";
        showAdminMsg(true,"Featured game added!");
      }catch(e){
        showAdminMsg(false,String(e.message||e));
        const msg=String(e.message||e).toLowerCase();
        if(msg.includes("schema")||msg.includes("404")||msg.includes("bucket")||msg.includes("not find")||msg.includes("column")) showSetup();
      }finally{
        submitBtn.disabled=false;submitBtn.textContent="Submit";
      }
    });
  }

  loadFeatured().then(()=>renderFeatured());
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",function(){ wireAdmin(); wireDetailModal(); });
  }else{
    wireAdmin();
    wireDetailModal();
  }

  const ref=document.getElementById("refresh");
  if(ref) ref.addEventListener("click",()=>loadFeatured().then(()=>renderFeatured()));
})();
