(function(){
  "use strict";

  const SB_URL="https://makmmhmsssfhbfpzqfcj.supabase.co";
  const SB_KEY="sb_publishable_QPZuusUtLAqEz2gRuvbrlQ_ZlrzBII6";
  const statusEl=document.getElementById("feedbackStatus");
  const form=document.getElementById("feedbackForm");
  const submitBtn=document.getElementById("feedbackSubmit");

  function setStatus(el,message,type){
    if(!el)return;
    el.textContent=message;
    el.classList.remove("error","success");
    if(type)el.classList.add(type);
  }

  window.__openHubFeedback=function(){
    const modal=document.getElementById("feedbackModal");
    if(modal)modal.classList.add("on");
  };

  if(form){
    form.addEventListener("submit",async function(event){
      event.preventDefault();
      if(!form.reportValidity())return;
      const data=new FormData(form);
      const payload={
        kind:String(data.get("kind")||""),
        game_name:String(data.get("game_name")||"").trim(),
        message:String(data.get("message")||"").trim(),
        website:String(data.get("website")||"")
      };
      submitBtn.disabled=true;
      submitBtn.textContent="Sending…";
      setStatus(statusEl,"Sending your feedback…");
      try{
        const response=await fetch(SB_URL+"/functions/v1/hub-feedback",{
          method:"POST",
          headers:{"apikey":SB_KEY,"Authorization":"Bearer "+SB_KEY,"Content-Type":"application/json"},
          body:JSON.stringify(payload)
        });
        const result=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(result.error||"Could not send feedback. Please try again later.");
        form.reset();
        setStatus(statusEl,"Thanks, your feedback was sent.","success");
      }catch(error){
        setStatus(statusEl,error.message||"Could not send feedback. Please try again later.","error");
      }finally{
        submitBtn.disabled=false;
        submitBtn.textContent="Send";
      }
    });
  }

  window.__loadHubFeedbackAdmin=async function(accessToken){
    const list=document.getElementById("feedbackAdminItems");
    const adminStatus=document.getElementById("feedbackAdminStatus");
    if(!list||!accessToken)return;
    list.textContent="Loading submissions…";
    setStatus(adminStatus,"");
    try{
      const response=await fetch(SB_URL+"/rest/v1/hub_feedback?select=id,kind,game_name,message,status,created_at&order=created_at.desc&limit=100",{
        headers:{"apikey":SB_KEY,"Authorization":"Bearer "+accessToken,"Accept":"application/json"},
        cache:"no-store"
      });
      const rows=await response.json().catch(()=>[]);
      if(!response.ok)throw new Error(rows.message||"Could not load submissions. Apply the feedback migration.");
      list.replaceChildren();
      if(!Array.isArray(rows)||!rows.length){list.textContent="No submissions yet.";return;}
      rows.forEach(function(row){
        const item=document.createElement("article");
        item.className="feedback-item";
        const heading=document.createElement("div");
        const kind=document.createElement("span");
        kind.className="feedback-kind";
        kind.textContent=row.kind==="request"?"Game request":"Problem report";
        heading.appendChild(kind);
        if(row.game_name){
          const game=document.createElement("span");
          game.textContent=" · "+row.game_name;
          heading.appendChild(game);
        }
        const time=document.createElement("time");
        time.dateTime=row.created_at||"";
        time.textContent=row.created_at?" · "+new Date(row.created_at).toLocaleString():"";
        heading.appendChild(time);
        const message=document.createElement("p");
        message.textContent=row.message||"";
        const select=document.createElement("select");
        select.setAttribute("aria-label","Submission status");
        [["new","New"],["reviewing","Reviewing"],["resolved","Resolved"]].forEach(function(optionData){
          const option=document.createElement("option");
          option.value=optionData[0];
          option.textContent=optionData[1];
          select.appendChild(option);
        });
        select.value=row.status||"new";
        let savedStatus=select.value;
        select.addEventListener("change",async function(){
          select.disabled=true;
          try{
            const update=await fetch(SB_URL+"/rest/v1/hub_feedback?id=eq."+encodeURIComponent(row.id),{
              method:"PATCH",
              headers:{"apikey":SB_KEY,"Authorization":"Bearer "+accessToken,"Content-Type":"application/json","Prefer":"return=minimal"},
              body:JSON.stringify({status:select.value})
            });
            if(!update.ok)throw new Error("Status update failed.");
            savedStatus=select.value;
            setStatus(adminStatus,"Submission status updated.","success");
          }catch(error){
            select.value=savedStatus;
            setStatus(adminStatus,error.message||"Status update failed.","error");
          }finally{
            select.disabled=false;
          }
        });
        item.append(heading,message,select);
        list.appendChild(item);
      });
      setStatus(adminStatus,rows.length===100?"Showing the latest 100 submissions.":"");
    }catch(error){
      list.textContent="Unable to load submissions.";
      setStatus(adminStatus,error.message||"Could not load submissions.","error");
    }
  };

  function startPresence(){
    const countEl=document.getElementById("onlineCount");
    if(!countEl||!window.supabase||!window.supabase.createClient)return;
    try{
      const client=window.supabase.createClient(SB_URL,SB_KEY,{realtime:{params:{eventsPerSecond:5}}});
      const visitorKey=window.crypto&&crypto.randomUUID?crypto.randomUUID():"visitor-"+Math.random().toString(36).slice(2);
      const channel=client.channel("hub-online-visitors",{config:{presence:{key:visitorKey}}});
      channel.on("presence",{event:"sync"},function(){
        const state=channel.presenceState();
        const count=Object.values(state).reduce(function(total,sessions){return total+(Array.isArray(sessions)?sessions.length:0);},0);
        countEl.textContent="Online now: "+count;
      });
      channel.subscribe(function(state){
        if(state==="SUBSCRIBED")channel.track({online_at:new Date().toISOString()});
        else if(state==="CHANNEL_ERROR"||state==="TIMED_OUT"||state==="CLOSED")countEl.textContent="Online now: unavailable";
      });
    }catch(_){countEl.textContent="Online now: unavailable";}
  }

  startPresence();
})();