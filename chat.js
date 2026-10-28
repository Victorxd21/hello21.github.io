/*! Game Hub AI Chat v2.0.0 — General-purpose assistant */
(function () {
  "use strict";

  const SB_URL = "https://makmmhmsssfhbfpzqfcj.supabase.co";
  const SB_ANON = "sb_publishable_QPZuusUtLAqEz2gRuvbrlQ_ZlrzBII6";
  const AI_ENDPOINT = SB_URL + "/functions/v1/ai-chat";
  const WELCOME_KEY = "hub_ai_chat_welcome_seen_v1";
  const HISTORY_KEY = "hub_ai_chat_history_v1";
  const CLIENT_ID_KEY = "hub_ai_client_id_v1";
  const COOLDOWN_MS = 10000;

  let clientId = localStorage.getItem(CLIENT_ID_KEY);
  if (!clientId) {
    clientId = "c_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(CLIENT_ID_KEY, clientId);
  }

  let chatOpen = false;
  let conversation = [];
  let isSending = false;
  let cooldownUntil = 0;
  let cooldownTimer = null;
  let typingEl = null;

  const css = `
#chatOpenBtn{position:fixed;bottom:20px;right:20px;z-index:220;height:44px;padding:0 16px;border-radius:999px;border:1px solid var(--border);background:rgba(18,16,28,.85);backdrop-filter:blur(14px);color:var(--text);font:700 13px system-ui,sans-serif;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 10px 30px rgba(0,0,0,.4),0 0 20px var(--glow);transition:transform .3s var(--spring),background .25s,box-shadow .3s}
#chatOpenBtn:hover{transform:translateY(-3px) scale(1.05);background:rgba(167,139,250,.25);box-shadow:0 12px 35px rgba(0,0,0,.5),0 0 30px var(--glow)}
#chatBadge{background:linear-gradient(135deg,#f43f5e,#e11d48);color:#fff;font-size:10px;font-weight:900;padding:2px 7px;border-radius:999px;display:none}
#chatBadge.on{display:inline-block}
#chatWindow{position:fixed;bottom:74px;right:20px;z-index:230;width:min(380px,calc(100vw - 40px));height:min(560px,calc(100vh - 100px));border-radius:20px;border:1px solid rgba(167,139,250,.3);background:linear-gradient(165deg,rgba(20,18,34,.98),rgba(10,8,18,.99));backdrop-filter:blur(24px);box-shadow:0 24px 70px rgba(0,0,0,.65),0 0 45px rgba(167,139,250,.15);display:flex;flex-direction:column;overflow:hidden;transform:translateY(16px) scale(.95);opacity:0;pointer-events:none;transition:transform .35s cubic-bezier(.34,1.56,.64,1),opacity .25s}
#chatWindow.on{transform:none;opacity:1;pointer-events:auto}
.chat-header{padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,.02)}
.chat-title{font-size:14px;font-weight:800;display:flex;align-items:center;gap:6px}
.chat-title .ai-dot{width:7px;height:7px;border-radius:50%;background:#22d3ee;box-shadow:0 0 8px #22d3ee}
.chat-header-actions{display:flex;align-items:center;gap:6px}
.chat-new-btn,.chat-close{background:transparent;border:1px solid transparent;color:var(--muted);font-size:12px;font-weight:700;cursor:pointer;padding:4px 8px;border-radius:8px;transition:color .2s,background .2s,border-color .2s}
.chat-new-btn:hover,.chat-close:hover{color:var(--text);background:rgba(255,255,255,.06);border-color:var(--border)}
.chat-close{font-size:16px;padding:2px 8px}
.chat-welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 20px;text-align:center;gap:12px;overflow-y:auto}
.chat-welcome h3{font-size:18px;font-weight:800;background:linear-gradient(90deg,#fff,var(--a),var(--c));-webkit-background-clip:text;background-clip:text;color:transparent}
.chat-welcome p{color:var(--muted);font-size:13px;line-height:1.55;max-width:300px}
.chat-welcome ul{text-align:left;color:var(--muted);font-size:12px;line-height:1.6;margin:4px 0 8px;padding-left:18px;max-width:300px}
.chat-welcome .start-btn{margin-top:8px;padding:12px 22px;border-radius:999px;border:none;background:linear-gradient(135deg,var(--a),var(--b));color:#fff;font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 8px 24px rgba(167,139,250,.35);transition:transform .2s}
.chat-welcome .start-btn:hover{transform:translateY(-2px)}
.chat-messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:12px}
.chat-msg{display:flex;flex-direction:column;gap:4px;max-width:92%;word-break:break-word}
.chat-msg.mine{align-self:flex-end;align-items:flex-end}
.chat-msg.theirs{align-self:flex-start;align-items:flex-start}
.chat-msg-meta{font-size:10px;font-weight:700;color:var(--muted);display:flex;gap:6px}
.chat-msg.mine .chat-msg-meta{color:var(--a)}
.chat-bubble{padding:10px 13px;border-radius:14px;font-size:13px;line-height:1.5;white-space:pre-wrap}
.chat-msg.mine .chat-bubble{background:linear-gradient(135deg,var(--b),var(--a));color:#fff;border-bottom-right-radius:4px}
.chat-msg.theirs .chat-bubble{background:rgba(255,255,255,.07);border:1px solid var(--border);color:var(--text);border-bottom-left-radius:4px}
.chat-bubble pre{margin:8px 0 4px;padding:10px 12px;border-radius:10px;background:rgba(0,0,0,.45);overflow-x:auto;font:12px/1.45 ui-monospace,monospace;position:relative}
.chat-bubble code{font-family:ui-monospace,monospace;font-size:12px}
.chat-bubble .code-wrap{position:relative;margin:8px 0}
.chat-bubble .copy-code-btn{position:absolute;top:6px;right:6px;font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.5);color:#e2e8f0;cursor:pointer;opacity:.85;z-index:2}
.chat-bubble .copy-code-btn:hover{opacity:1;background:rgba(167,139,250,.4)}
.chat-typing{align-self:flex-start;padding:8px 14px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid var(--border);color:var(--muted);font-size:12px;display:flex;align-items:center;gap:6px}
.chat-typing .dots span{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--c);animation:chatDot 1.2s ease-in-out infinite}
.chat-typing .dots span:nth-child(2){animation-delay:.2s}
.chat-typing .dots span:nth-child(3){animation-delay:.4s}
@keyframes chatDot{0%,80%,100%{opacity:.3;transform:scale(.8)}40%{opacity:1;transform:scale(1.15)}}
.chat-cooldown{padding:6px 12px;font-size:11px;font-weight:600;color:var(--muted);text-align:center;border-top:1px solid rgba(255,255,255,.05);background:rgba(0,0,0,.2);display:none}
.chat-cooldown.on{display:block}
.chat-input-bar{padding:10px 12px;border-top:1px solid var(--border);display:flex;gap:8px;background:rgba(0,0,0,.25);align-items:flex-end}
.chat-input-bar textarea{flex:1;padding:9px 12px;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,.05);color:var(--text);font-size:13px;outline:none;resize:none;min-height:40px;max-height:120px;line-height:1.4;font-family:inherit}
.chat-input-bar textarea:focus{border-color:var(--a)}
.chat-send-btn{padding:0 14px;height:40px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--a),var(--b));color:#fff;font-weight:800;cursor:pointer;transition:transform .2s,opacity .2s;flex-shrink:0}
.chat-send-btn:hover{transform:scale(1.05)}
.chat-send-btn:disabled{opacity:.45;cursor:not-allowed;transform:none}
.chat-error{padding:8px 12px;margin:4px 14px;border-radius:10px;background:rgba(248,113,113,.12);border:1px solid rgba(248,113,113,.35);color:#fca5a5;font-size:12px;line-height:1.4}
`;

  const styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  const chatHTML = `
<button id="chatOpenBtn" type="button" aria-label="Open AI Chat">
  <span>✨</span><span>AI Chat</span><span id="chatBadge">0</span>
</button>
<div id="chatWindow" role="dialog" aria-label="AI Assistant">
  <div class="chat-header">
    <div class="chat-title"><span class="ai-dot"></span> AI Assistant</div>
    <div class="chat-header-actions">
      <button type="button" class="chat-new-btn" id="chatNewBtn" title="New conversation">New</button>
      <button type="button" class="chat-close" id="chatCloseBtn" aria-label="Close">✕</button>
    </div>
  </div>
  <div id="chatBody"></div>
  <div class="chat-cooldown" id="chatCooldown"></div>
  <form class="chat-input-bar" id="chatForm" style="display:none">
    <textarea id="chatInput" placeholder="Ask anything…" rows="1" maxlength="4000" autocomplete="off"></textarea>
    <button type="submit" class="chat-send-btn" id="chatSendBtn">Send</button>
  </form>
</div>`;

  const container = document.createElement("div");
  container.innerHTML = chatHTML;
  while (container.firstChild) document.body.appendChild(container.firstChild);

  const openBtn = document.getElementById("chatOpenBtn");
  const win = document.getElementById("chatWindow");
  const closeBtn = document.getElementById("chatCloseBtn");
  const newBtn = document.getElementById("chatNewBtn");
  const body = document.getElementById("chatBody");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("chatSendBtn");
  const cooldownEl = document.getElementById("chatCooldown");

  function hasSeenWelcome() { return localStorage.getItem(WELCOME_KEY) === "1"; }
  function markWelcomeSeen() { localStorage.setItem(WELCOME_KEY, "1"); }
  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.slice(-40) : [];
    } catch (_) { return []; }
  }
  function saveHistory() {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(conversation.slice(-40))); } catch (_) {}
  }
  function escapeHtml(str) {
    return String(str || "").replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, """);
  }
  function formatContent(text) {
    if (!text) return "";
    let s = escapeHtml(text);
    s = s.replace(/```(\w*)\n([\s\S]*?)```/g, function (_, lang, code) {
      const id = "code_" + Math.random().toString(36).slice(2, 9);
      return '<div class="code-wrap"><button type="button" class="copy-code-btn" data-code-id="' + id + '">Copy</button><pre id="' + id + '"><code>' + code.replace(/\n$/, "") + "</code></pre></div>";
    });
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    return s;
  }
  function showWelcome() {
    body.innerHTML = '<div class="chat-welcome"><h3>Welcome to the AI Assistant</h3><p>This is a general-purpose AI assistant. You can ask about a wide variety of appropriate topics — explanations, ideas, technology, writing help, and more.</p><ul><li>Responses need a network connection and may take a few seconds.</li><li>There is a short cooldown between messages and usage limits may apply.</li><li>Availability depends on the AI provider; the service is not guaranteed to be free of cost on the provider side.</li></ul><button type="button" class="start-btn" id="chatStartBtn">Start Chatting</button></div>';
    form.style.display = "none";
    const start = document.getElementById("chatStartBtn");
    if (start) start.addEventListener("click", function () { markWelcomeSeen(); showConversationUI(); });
  }
  function showConversationUI() {
    body.innerHTML = '<div class="chat-messages" id="chatMessagesBox"></div>';
    form.style.display = "flex";
    conversation = loadHistory();
    renderMessages();
    setTimeout(function () { input.focus(); }, 120);
  }
  function renderMessages() {
    const box = document.getElementById("chatMessagesBox");
    if (!box) return;
    if (!conversation.length) {
      box.innerHTML = '<div style="text-align:center;padding:28px 12px;color:var(--muted);font-size:12px">Ask me anything to get started.</div>';
      return;
    }
    box.innerHTML = conversation.map(function (m) {
      const isMine = m.role === "user";
      return '<div class="chat-msg ' + (isMine ? "mine" : "theirs") + '"><div class="chat-msg-meta"><span>' + (isMine ? "You" : "AI") + '</span></div><div class="chat-bubble">' + (isMine ? escapeHtml(m.content) : formatContent(m.content)) + "</div></div>";
    }).join("");
    box.scrollTop = box.scrollHeight;
    box.querySelectorAll(".copy-code-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const id = btn.getAttribute("data-code-id");
        const pre = id && document.getElementById(id);
        if (!pre) return;
        navigator.clipboard.writeText(pre.textContent || "").then(function () {
          btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy"; }, 1500);
        }, function () { btn.textContent = "Failed"; });
      });
    });
  }
  function showTyping(on) {
    const box = document.getElementById("chatMessagesBox");
    if (!box) return;
    if (typingEl) { typingEl.remove(); typingEl = null; }
    if (on) {
      typingEl = document.createElement("div");
      typingEl.className = "chat-typing";
      typingEl.innerHTML = '<span class="dots"><span></span><span></span><span></span></span> Thinking…';
      box.appendChild(typingEl);
      box.scrollTop = box.scrollHeight;
    }
  }
  function updateCooldownUI() {
    const now = Date.now();
    const left = Math.max(0, cooldownUntil - now);
    if (left <= 0) {
      cooldownEl.classList.remove("on"); cooldownEl.textContent = "";
      sendBtn.disabled = isSending;
      if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
      return;
    }
    const secs = Math.ceil(left / 1000);
    cooldownEl.classList.add("on");
    cooldownEl.textContent = "You can send another message in " + secs + " second" + (secs === 1 ? "" : "s") + ".";
    sendBtn.disabled = true;
  }
  function startCooldown(fromServerMs) {
    const wait = typeof fromServerMs === "number" && fromServerMs > 0 ? fromServerMs : COOLDOWN_MS;
    cooldownUntil = Date.now() + wait;
    updateCooldownUI();
    if (cooldownTimer) clearInterval(cooldownTimer);
    cooldownTimer = setInterval(updateCooldownUI, 1000);
  }
  function showError(msg) {
    const box = document.getElementById("chatMessagesBox");
    if (!box) return;
    const el = document.createElement("div");
    el.className = "chat-error"; el.textContent = msg;
    box.appendChild(el); box.scrollTop = box.scrollHeight;
    setTimeout(function () { el.remove(); }, 8000);
  }
  async function sendToAI(userText) {
    if (isSending) return;
    if (Date.now() < cooldownUntil) { updateCooldownUI(); return; }
    isSending = true; sendBtn.disabled = true; input.value = ""; autoResize();
    conversation.push({ role: "user", content: userText, ts: Date.now() });
    saveHistory(); renderMessages(); showTyping(true); startCooldown(COOLDOWN_MS);
    try {
      const historyPayload = conversation.slice(-12).map(function (m) { return { role: m.role, content: m.content }; });
      const r = await fetch(AI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SB_ANON, Authorization: "Bearer " + SB_ANON },
        body: JSON.stringify({ messages: historyPayload, client_id: clientId }),
      });
      let data = null;
      try { data = await r.json(); } catch (_) { data = null; }
      showTyping(false);
      if (r.status === 429) {
        startCooldown((data && data.retry_after_ms) || COOLDOWN_MS);
        showError((data && data.error) || "Please wait before sending another message.");
        isSending = false; updateCooldownUI(); return;
      }
      if (!r.ok) {
        showError((data && (data.error || data.message)) || "Request failed (" + r.status + "). Please try again later.");
        isSending = false; updateCooldownUI(); return;
      }
      const reply = (data && data.reply) || "";
      if (!reply) { showError("Empty response from the assistant. Please try again."); isSending = false; updateCooldownUI(); return; }
      conversation.push({ role: "assistant", content: reply, ts: Date.now() });
      saveHistory(); renderMessages();
      if (data && typeof data.cooldown_ms === "number") startCooldown(data.cooldown_ms);
    } catch (e) {
      showTyping(false); showError("Network error. Check your connection and try again.");
    } finally {
      isSending = false; updateCooldownUI(); input.focus();
    }
  }
  function autoResize() {
    input.style.height = "auto";
    input.style.height = Math.min(120, Math.max(40, input.scrollHeight)) + "px";
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (isSending || Date.now() < cooldownUntil) return;
    const val = input.value.trim();
    if (val) sendToAI(val);
  });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isSending && Date.now() >= cooldownUntil) {
        const val = input.value.trim();
        if (val) sendToAI(val);
      }
    }
  });
  input.addEventListener("input", autoResize);
  function toggleChat(state) {
    chatOpen = typeof state === "boolean" ? state : !chatOpen;
    win.classList.toggle("on", chatOpen);
    if (chatOpen) {
      if (!hasSeenWelcome()) showWelcome();
      else showConversationUI();
    }
  }
  openBtn.addEventListener("click", function () { toggleChat(); });
  closeBtn.addEventListener("click", function () { toggleChat(false); });
  newBtn.addEventListener("click", function () {
    conversation = []; saveHistory();
    if (hasSeenWelcome()) showConversationUI(); else showWelcome();
  });
  addEventListener("keydown", function (e) {
    if (e.key === "Escape" && chatOpen) toggleChat(false);
  });
})();
