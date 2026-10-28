/*! AI Game Guide — recommendations grounded in the real library */
(function () {
  "use strict";
  const SB_URL = "https://makmmhmsssfhbfpzqfcj.supabase.co";
  const SB_ANON = "sb_publishable_QPZuusUtLAqEz2gRuvbrlQ_ZlrzBII6";
  const AI_ENDPOINT = SB_URL + "/functions/v1/ai-chat";
  const CLIENT_ID_KEY = "hub_ai_client_id_v1";
  const COOLDOWN_MS = 10000;
  let clientId = localStorage.getItem(CLIENT_ID_KEY);
  if (!clientId) {
    clientId = "c_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(CLIENT_ID_KEY, clientId);
  }
  const SUGGESTIONS = [
    "Recommend a horror game.",
    "What games can I play on a low-end laptop?",
    "Find me a game with a good story.",
    "What should I play if I only have ten minutes?",
    "Show me games similar to Monochrome.",
    "Recommend a multiplayer game.",
    "What 3D games do you have?",
  ];
  const css = `#gameGuideBtn{position:fixed;bottom:20px;left:20px;z-index:220;height:44px;padding:0 16px;border-radius:999px;border:1px solid var(--border);background:rgba(18,16,28,.85);backdrop-filter:blur(14px);color:var(--text);font:700 13px system-ui,sans-serif;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 10px 30px rgba(0,0,0,.4)}
#gameGuideBtn:hover{transform:translateY(-3px);background:rgba(34,211,238,.15)}
#gameGuideWin{position:fixed;bottom:74px;left:20px;z-index:230;width:min(400px,calc(100vw - 40px));height:min(560px,calc(100vh - 100px));border-radius:20px;border:1px solid rgba(34,211,238,.3);background:linear-gradient(165deg,rgba(20,18,34,.98),rgba(10,8,18,.99));backdrop-filter:blur(24px);box-shadow:0 24px 70px rgba(0,0,0,.65);display:flex;flex-direction:column;overflow:hidden;transform:translateY(16px) scale(.95);opacity:0;pointer-events:none;transition:transform .35s cubic-bezier(.34,1.56,.64,1),opacity .25s}
#gameGuideWin.on{transform:none;opacity:1;pointer-events:auto}
.gg-header{padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.gg-title{font-size:14px;font-weight:800;display:flex;align-items:center;gap:6px}
.gg-title .dot{width:7px;height:7px;border-radius:50%;background:#22d3ee;box-shadow:0 0 8px #22d3ee}
.gg-close{background:transparent;border:none;color:var(--muted);font-size:16px;cursor:pointer;padding:2px 8px;border-radius:8px}
.gg-body{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:12px}
.gg-welcome{text-align:center;padding:12px 8px}
.gg-welcome h3{font-size:16px;font-weight:800;margin-bottom:6px}
.gg-welcome p{font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:12px}
.gg-sugs{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}
.gg-sug{padding:6px 10px;border-radius:999px;border:1px solid var(--border);background:rgba(34,211,238,.08);color:var(--text);font-size:11px;font-weight:600;cursor:pointer}
.gg-sug:hover{background:rgba(34,211,238,.2)}
.gg-msg{max-width:92%;font-size:13px;line-height:1.5}
.gg-msg.user{align-self:flex-end}
.gg-msg.user .gg-bubble{background:linear-gradient(135deg,#0891b2,#22d3ee);color:#041016;border-radius:14px 14px 4px 14px;padding:10px 12px}
.gg-msg.ai{align-self:flex-start}
.gg-msg.ai .gg-bubble{background:rgba(255,255,255,.07);border:1px solid var(--border);border-radius:14px 14px 14px 4px;padding:10px 12px;color:var(--text);white-space:pre-wrap}
.gg-cards{display:flex;flex-direction:column;gap:8px;margin-top:10px}
.gg-card{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;border:1px solid var(--border);background:rgba(0,0,0,.25);cursor:pointer}
.gg-card:hover{border-color:rgba(34,211,238,.45);background:rgba(34,211,238,.08)}
.gg-card .ic{font-size:22px}
.gg-card .nm{font-weight:800;font-size:13px}
.gg-card .meta{font-size:10px;color:var(--muted)}
.gg-card .go{margin-left:auto;font-size:11px;font-weight:800;color:#22d3ee}
.gg-input{padding:10px 12px;border-top:1px solid var(--border);display:flex;gap:8px;background:rgba(0,0,0,.25)}
.gg-input input{flex:1;padding:9px 12px;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,.05);color:var(--text);font-size:13px;outline:none}
.gg-input input:focus{border-color:#22d3ee}
.gg-input button{padding:0 14px;border-radius:10px;border:none;background:linear-gradient(135deg,#0891b2,#22d3ee);color:#041016;font-weight:800;cursor:pointer}
.gg-input button:disabled{opacity:.45;cursor:not-allowed}
.gg-cooldown{padding:6px 12px;font-size:11px;color:var(--muted);text-align:center;display:none;border-top:1px solid rgba(255,255,255,.05)}
.gg-cooldown.on{display:block}`;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  const btn = document.createElement("button");
  btn.id = "gameGuideBtn"; btn.type = "button";
  btn.innerHTML = "<span>🎮</span><span>Game Guide</span>";
  document.body.appendChild(btn);
  const win = document.createElement("div");
  win.id = "gameGuideWin";
  win.innerHTML = '<div class="gg-header"><div class="gg-title"><span class="dot"></span> AI Game Guide</div><button type="button" class="gg-close" id="ggClose">✕</button></div><div class="gg-body" id="ggBody"></div><div class="gg-cooldown" id="ggCooldown"></div><form class="gg-input" id="ggForm"><input type="text" id="ggInput" placeholder="Ask about games in this hub…" maxlength="500" autocomplete="off"/><button type="submit" id="ggSend">Ask</button></form>';
  document.body.appendChild(win);
  const body = document.getElementById("ggBody");
  const form = document.getElementById("ggForm");
  const input = document.getElementById("ggInput");
  const sendBtn = document.getElementById("ggSend");
  const cooldownEl = document.getElementById("ggCooldown");
  let open = false, sending = false, cooldownUntil = 0, cooldownTimer = null;
  function getLibrary() {
    const cards = [...document.querySelectorAll(".game[data-path]")];
    const fromDom = cards.map(function (el) {
      const path = el.getAttribute("data-path") || "";
      const name = (el.querySelector(".name") && el.querySelector(".name").textContent) || path;
      const icon = (el.querySelector(".icon") && el.querySelector(".icon").textContent) || "🎮";
      return { name: name.trim(), path, icon: icon.trim(), tags: [] };
    });
    if (fromDom.length) return fromDom;
    try {
      const cached = JSON.parse(localStorage.getItem("hub_cached_games_v2") || "[]");
      if (Array.isArray(cached) && cached.length) {
        return cached.map(function (folder) {
          return { name: folder.replace(/[-_]+/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); }), path: "games/" + folder + "/index.html", icon: "🎮", tags: [] };
        });
      }
    } catch (_) {}
    return [];
  }
  function localFilter(query, library) {
    const q = query.toLowerCase();
    const scored = library.map(function (g) {
      let score = 0;
      const blob = (g.name + " " + g.path + " " + (g.tags || []).join(" ")).toLowerCase();
      q.split(/\s+/).filter(Boolean).forEach(function (k) { if (blob.includes(k)) score += 2; });
      if (/horror|scary|siren/.test(q) && /siren|horror|scary/.test(blob)) score += 5;
      if (/multi|friend|online/.test(q) && /uno|gartic|werewolf|multi/.test(blob)) score += 4;
      if (/3d|mesh|voxel|earth|explore/.test(q) && /3d|mesh|voxel|earth|explorer|world/.test(blob)) score += 4;
      if (/quick|short|minute|casual/.test(q) && /snake|blackjack|heads|cat/.test(blob)) score += 3;
      if (/race|racing|car/.test(q) && /race|rocket/.test(blob)) score += 5;
      if (/card|uno|blackjack/.test(q) && /uno|blackjack|card/.test(blob)) score += 5;
      if (/mono/.test(q) && /monochrome/.test(blob)) score += 6;
      return { g: g, score: score };
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.filter(function (x) { return x.score > 0; }).slice(0, 6).map(function (x) { return x.g; });
  }
  function showWelcome() {
    body.innerHTML = '<div class="gg-welcome"><h3>Game Guide</h3><p>Ask about games in <strong>this</strong> hub only. I recommend from the real library—not invent titles.</p><div class="gg-sugs" id="ggSugs"></div></div>';
    const sugs = document.getElementById("ggSugs");
    SUGGESTIONS.forEach(function (s) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "gg-sug"; b.textContent = s;
      b.addEventListener("click", function () { input.value = s; ask(s); });
      sugs.appendChild(b);
    });
  }
  function escapeHtml(s) {
    return String(s || "").replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, """);
  }
  function appendUser(text) {
    const div = document.createElement("div");
    div.className = "gg-msg user";
    div.innerHTML = '<div class="gg-bubble">' + escapeHtml(text) + "</div>";
    body.appendChild(div); body.scrollTop = body.scrollHeight;
  }
  function appendAI(text, games) {
    const div = document.createElement("div");
    div.className = "gg-msg ai";
    let html = '<div class="gg-bubble">' + escapeHtml(text) + "</div>";
    if (games && games.length) {
      html += '<div class="gg-cards">';
      games.forEach(function (g) {
        html += '<div class="gg-card" data-path="' + escapeHtml(g.path) + '"><span class="ic">' + escapeHtml(g.icon || "🎮") + '</span><div><div class="nm">' + escapeHtml(g.name) + '</div><div class="meta">' + escapeHtml(g.path) + '</div></div><span class="go">Play →</span></div>';
      });
      html += "</div>";
    }
    div.innerHTML = html;
    body.appendChild(div);
    div.querySelectorAll(".gg-card").forEach(function (card) {
      card.addEventListener("click", function () {
        const p = card.getAttribute("data-path");
        if (p) { if (window.__recordView) window.__recordView(p); location.href = p; }
      });
    });
    body.scrollTop = body.scrollHeight;
  }
  function updateCooldown() {
    const left = Math.max(0, cooldownUntil - Date.now());
    if (left <= 0) {
      cooldownEl.classList.remove("on"); sendBtn.disabled = sending;
      if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
      return;
    }
    cooldownEl.classList.add("on");
    cooldownEl.textContent = "You can ask again in " + Math.ceil(left / 1000) + "s";
    sendBtn.disabled = true;
  }
  function startCooldown(ms) {
    cooldownUntil = Date.now() + (ms || COOLDOWN_MS);
    updateCooldown();
    if (cooldownTimer) clearInterval(cooldownTimer);
    cooldownTimer = setInterval(updateCooldown, 1000);
  }
  async function ask(text) {
    if (sending || Date.now() < cooldownUntil) return;
    const q = (text || "").trim();
    if (!q) return;
    if (body.querySelector(".gg-welcome")) body.innerHTML = "";
    appendUser(q); input.value = ""; sending = true; sendBtn.disabled = true; startCooldown(COOLDOWN_MS);
    const library = getLibrary();
    const localHits = localFilter(q, library);
    const contextGames = (localHits.length ? localHits : library.slice(0, 12)).map(function (g) {
      return { name: g.name, path: g.path, icon: g.icon, tags: g.tags || [] };
    });
    try {
      const r = await fetch(AI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SB_ANON, Authorization: "Bearer " + SB_ANON },
        body: JSON.stringify({ mode: "game-guide", client_id: clientId, messages: [{ role: "user", content: q }], library: contextGames }),
      });
      let data = null;
      try { data = await r.json(); } catch (_) {}
      if (r.status === 429) {
        startCooldown((data && data.retry_after_ms) || COOLDOWN_MS);
        appendAI((data && data.error) || "Please wait before asking again.", localHits);
        sending = false; updateCooldown(); return;
      }
      if (!r.ok) {
        if (localHits.length) appendAI("Here are matching games from this hub (AI is temporarily unavailable):", localHits);
        else appendAI((data && (data.error || data.message)) || "Could not reach the guide. Try again later.", []);
        sending = false; updateCooldown(); return;
      }
      const reply = (data && data.reply) || "Here are some options from this hub.";
      const libByPath = {};
      library.forEach(function (g) { libByPath[g.path] = g; });
      let cards = localHits.slice();
      if (data && Array.isArray(data.recommended_paths)) {
        const validated = data.recommended_paths.map(function (p) { return libByPath[p]; }).filter(Boolean);
        if (validated.length) cards = validated;
      }
      appendAI(reply, cards);
      if (data && typeof data.cooldown_ms === "number") startCooldown(data.cooldown_ms);
    } catch (e) {
      if (localHits.length) appendAI("Network issue — showing local matches from this hub:", localHits);
      else appendAI("Network error. Browse the main library or try again.", []);
    } finally {
      sending = false; updateCooldown(); input.focus();
    }
  }
  function toggle(state) {
    open = typeof state === "boolean" ? state : !open;
    win.classList.toggle("on", open);
    if (open && !body.childElementCount) showWelcome();
    if (open) setTimeout(function () { input.focus(); }, 120);
  }
  btn.addEventListener("click", function () { toggle(); });
  document.getElementById("ggClose").addEventListener("click", function () { toggle(false); });
  form.addEventListener("submit", function (e) { e.preventDefault(); ask(input.value); });
  addEventListener("keydown", function (e) { if (e.key === "Escape" && open) toggle(false); });
})();
