/*! Game Hub Global Chat v1.0.0 */
(function(){
  const SB_URL="https://makmmhmsssfhbfpzqfcj.supabase.co";
  const SB_KEY="sb_publishable_QPZuusUtLAqEz2gRuvbrlQ_ZlrzBII6";
  const USER_KEY="hub_chat_username_v1";

  // Generate or retrieve username
  let currentUsername = localStorage.getItem(USER_KEY);
  if(!currentUsername){
    currentUsername = "Player_" + Math.floor(1000 + Math.random() * 9000);
    localStorage.setItem(USER_KEY, currentUsername);
  }

  let chatOpen = false;
  let messages = [];
  let lastMessageId = null;
  let unreadCount = 0;
  let pollInterval = null;

  // Insert chat styles
  const css = `
#chatOpenBtn{
  position:fixed;
  bottom:20px;
  right:20px;
  z-index:220;
  height:44px;
  padding:0 16px;
  border-radius:999px;
  border:1px solid var(--border);
  background:rgba(18,16,28,.85);
  backdrop-filter:blur(14px);
  color:var(--text);
  font:700 13px system-ui,sans-serif;
  cursor:pointer;
  display:flex;
  align-items:center;
  gap:8px;
  box-shadow:0 10px 30px rgba(0,0,0,.4),0 0 20px var(--glow);
  transition:transform .3s var(--spring),background .25s,box-shadow .3s;
}
#chatOpenBtn:hover{
  transform:translateY(-3px) scale(1.05);
  background:rgba(167,139,250,.25);
  box-shadow:0 12px 35px rgba(0,0,0,.5),0 0 30px var(--glow);
}
#chatBadge{
  background:linear-gradient(135deg,#f43f5e,#e11d48);
  color:#fff;
  font-size:10px;
  font-weight:900;
  padding:2px 7px;
  border-radius:999px;
  display:none;
}
#chatBadge.on{display:inline-block}

#chatWindow{
  position:fixed;
  bottom:74px;
  right:20px;
  z-index:230;
  width:min(360px,calc(100vw - 40px));
  height:min(520px,calc(100vh - 100px));
  border-radius:20px;
  border:1px solid rgba(167,139,250,.3);
  background:linear-gradient(165deg,rgba(20,18,34,.98),rgba(10,8,18,.99));
  backdrop-filter:blur(24px);
  box-shadow:0 24px 70px rgba(0,0,0,.65),0 0 45px rgba(167,139,250,.15);
  display:flex;
  flex-direction:column;
  overflow:hidden;
  transform:translateY(16px) scale(.95);
  opacity:0;
  pointer-events:none;
  transition:transform .35s cubic-bezier(.34,1.56,.64,1),opacity .25s;
}
#chatWindow.on{
  transform:none;
  opacity:1;
  pointer-events:auto;
}

.chat-header{
  padding:14px 16px;
  border-bottom:1px solid var(--border);
  display:flex;
  align-items:center;
  justify-content:space-between;
  background:rgba(255,255,255,.02);
}
.chat-title{
  font-size:14px;
  font-weight:800;
  display:flex;
  align-items:center;
  gap:6px;
}
.chat-title .live-dot{
  width:7px;
  height:7px;
  border-radius:50%;
  background:#22c55e;
  box-shadow:0 0 8px #22c55e;
}
.chat-close{
  background:transparent;
  border:none;
  color:var(--muted);
  font-size:18px;
  cursor:pointer;
  padding:2px 6px;
  border-radius:6px;
  transition:color .2s;
}
.chat-close:hover{color:var(--text)}

.chat-user-bar{
  padding:8px 14px;
  background:rgba(167,139,250,.08);
  border-bottom:1px solid rgba(167,139,250,.15);
  display:flex;
  align-items:center;
  justify-content:space-between;
  font-size:11px;
}
.chat-username{
  font-weight:700;
  color:var(--a);
  max-width:180px;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.chat-change-name{
  background:none;
  border:1px solid rgba(167,139,250,.3);
  color:var(--text);
  font-size:10px;
  font-weight:700;
  padding:3px 8px;
  border-radius:6px;
  cursor:pointer;
  transition:background .2s;
}
.chat-change-name:hover{
  background:rgba(167,139,250,.2);
}

.chat-messages{
  flex:1;
  overflow-y:auto;
  padding:14px;
  display:flex;
  flex-direction:column;
  gap:10px;
}
.chat-msg{
  display:flex;
  flex-direction:column;
  gap:3px;
  max-width:85%;
  word-break:break-word;
}
.chat-msg.mine{
  align-self:flex-end;
  align-items:flex-end;
}
.chat-msg.theirs{
  align-self:flex-start;
  align-items:flex-start;
}
.chat-msg-meta{
  font-size:10px;
  font-weight:700;
  color:var(--muted);
  display:flex;
  gap:6px;
}
.chat-msg.mine .chat-msg-meta{
  color:var(--a);
}
.chat-bubble{
  padding:8px 12px;
  border-radius:14px;
  font-size:13px;
  line-height:1.45;
}
.chat-msg.mine .chat-bubble{
  background:linear-gradient(135deg,var(--b),var(--a));
  color:#fff;
  border-bottom-right-radius:4px;
}
.chat-msg.theirs .chat-bubble{
  background:rgba(255,255,255,.07);
  border:1px solid var(--border);
  color:var(--text);
  border-bottom-left-radius:4px;
}

.chat-input-bar{
  padding:10px 12px;
  border-top:1px solid var(--border);
  display:flex;
  gap:8px;
  background:rgba(0,0,0,.25);
}
.chat-input-bar input{
  flex:1;
  padding:9px 12px;
  border-radius:10px;
  border:1px solid var(--border);
  background:rgba(255,255,255,.05);
  color:var(--text);
  font-size:13px;
  outline:none;
}
.chat-input-bar input:focus{
  border-color:var(--a);
}
.chat-send-btn{
  padding:0 14px;
  border-radius:10px;
  border:none;
  background:linear-gradient(135deg,var(--a),var(--b));
  color:#fff;
  font-weight:800;
  cursor:pointer;
  transition:transform .2s;
}
.chat-send-btn:hover{transform:scale(1.05)}
.chat-send-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
`;
  const styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // Insert chat HTML structure
  const chatHTML = `
<button id="chatOpenBtn" type="button" aria-label="Open Chat">
  <span>💬</span>
  <span>Chat</span>
  <span id="chatBadge">0</span>
</button>
<div id="chatWindow" role="dialog" aria-label="Global Chat">
  <div class="chat-header">
    <div class="chat-title"><span class="live-dot"></span> Global Chat</div>
    <button class="chat-close" id="chatCloseBtn">✕</button>
  </div>
  <div class="chat-user-bar">
    <div>You: <span class="chat-username" id="chatUserDisplay"></span></div>
    <button class="chat-change-name" id="chatChangeNameBtn">Edit Name</button>
  </div>
  <div class="chat-messages" id="chatMessagesBox">
    <div style="text-align:center;padding:20px;color:var(--muted);font-size:12px">Loading messages…</div>
  </div>
  <form class="chat-input-bar" id="chatForm">
    <input type="text" id="chatInput" placeholder="Say something…" maxlength="250" autocomplete="off"/>
    <button type="submit" class="chat-send-btn" id="chatSendBtn">Send</button>
  </form>
</div>`;

  const container = document.createElement("div");
  container.innerHTML = chatHTML;
  while(container.firstChild) document.body.appendChild(container.firstChild);

  const openBtn = document.getElementById("chatOpenBtn");
  const win = document.getElementById("chatWindow");
  const closeBtn = document.getElementById("chatCloseBtn");
  const badge = document.getElementById("chatBadge");
  const userDisplay = document.getElementById("chatUserDisplay");
  const changeNameBtn = document.getElementById("chatChangeNameBtn");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("chatSendBtn");
  const box = document.getElementById("chatMessagesBox");

  function updateUserDisplay(){
    userDisplay.textContent = currentUsername;
  }
  updateUserDisplay();

  changeNameBtn.addEventListener("click", ()=>{
    const next = prompt("Enter a nickname:", currentUsername);
    if(next && next.trim()){
      currentUsername = next.trim().slice(0, 20);
      localStorage.setItem(USER_KEY, currentUsername);
      updateUserDisplay();
      renderMessages();
    }
  });

  function escapeHtml(str){
    return String(str||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function formatTime(iso){
    try{
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
    }catch(e){return "";}
  }

  function renderMessages(){
    if(!messages.length){
      box.innerHTML = '<div style="text-align:center;padding:30px 10px;color:var(--muted);font-size:12px">No messages yet. Be the first to say hi! 👋</div>';
      return;
    }
    box.innerHTML = messages.map(m => {
      const isMine = m.user_name === currentUsername;
      return `
        <div class="chat-msg ${isMine ? "mine" : "theirs"}">
          <div class="chat-msg-meta">
            <span>${escapeHtml(m.user_name)}</span>
            <span>${formatTime(m.created_at)}</span>
          </div>
          <div class="chat-bubble">${escapeHtml(m.content)}</div>
        </div>
      `;
    }).join("");
    box.scrollTop = box.scrollHeight;
  }

  async function fetchMessages(){
    try{
      const r = await fetch(SB_URL + "/rest/v1/chat_messages?select=*&order=created_at.asc&limit=60", {
        headers: {
          "apikey": SB_KEY,
          "Authorization": "Bearer " + SB_KEY
        },
        cache: "no-store"
      });
      if(!r.ok) return;
      const data = await r.json();
      if(!Array.isArray(data)) return;

      if(data.length && (!messages.length || data[data.length-1].id !== lastMessageId)){
        if(!chatOpen && messages.length > 0){
          unreadCount += Math.max(1, data.length - messages.length);
          badge.textContent = unreadCount;
          badge.classList.add("on");
        }
        messages = data;
        lastMessageId = data[data.length - 1].id;
        renderMessages();
      }
    }catch(e){}
  }

  async function sendMessage(text){
    sendBtn.disabled = true;
    try{
      const r = await fetch(SB_URL + "/rest/v1/chat_messages", {
        method: "POST",
        headers: {
          "apikey": SB_KEY,
          "Authorization": "Bearer " + SB_KEY,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify({
          user_name: currentUsername,
          content: text
        })
      });
      if(r.ok){
        input.value = "";
        await fetchMessages();
      }
    }catch(e){
      console.error("Chat send failed", e);
    }finally{
      sendBtn.disabled = false;
      input.focus();
    }
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    const val = input.value.trim();
    if(val) sendMessage(val);
  });

  function toggleChat(state){
    chatOpen = typeof state === "boolean" ? state : !chatOpen;
    win.classList.toggle("on", chatOpen);
    if(chatOpen){
      unreadCount = 0;
      badge.classList.remove("on");
      badge.textContent = "0";
      fetchMessages();
      setTimeout(() => input.focus(), 150);
    }
  }

  openBtn.addEventListener("click", () => toggleChat());
  closeBtn.addEventListener("click", () => toggleChat(false));

  addEventListener("keydown", e => {
    if(e.key === "Escape" && chatOpen) toggleChat(false);
  });

  // Start polling every 2.5 seconds
  fetchMessages();
  pollInterval = setInterval(fetchMessages, 2500);
})();
