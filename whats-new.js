/*! Whats New popup — announcements from Supabase */
(function () {
  "use strict";

  const SB_URL = "https://makmmhmsssfhbfpzqfcj.supabase.co";
  const SB_KEY = "sb_publishable_QPZuusUtLAqEz2gRuvbrlQ_ZlrzBII6";
  const DISMISS_KEY = "hub_whats_new_dismissed_v1";

  const css = `
#whatsNewBtn{
  position:fixed;top:14px;right:16px;z-index:210;height:36px;padding:0 12px;
  border-radius:999px;border:1px solid var(--border);background:rgba(18,16,28,.85);
  backdrop-filter:blur(12px);color:var(--text);font:700 12px system-ui,sans-serif;
  cursor:pointer;display:flex;align-items:center;gap:6px;
  box-shadow:0 8px 24px rgba(0,0,0,.35);
}
#whatsNewBtn:hover{background:rgba(167,139,250,.2)}
#whatsNewBtn .dot{width:7px;height:7px;border-radius:50%;background:#f43f5e;display:none}
#whatsNewBtn .dot.on{display:inline-block}
#whatsNewModal.mbg{z-index:2100}
#whatsNewModal .modal{max-width:480px}
#whatsNewModal .wn-item{padding:14px 0;border-bottom:1px solid rgba(255,255,255,.06)}
#whatsNewModal .wn-item:last-child{border-bottom:none}
#whatsNewModal .wn-meta{font-size:11px;color:var(--muted);margin-bottom:4px;display:flex;gap:8px;flex-wrap:wrap}
#whatsNewModal .wn-title{font-weight:800;font-size:15px;margin-bottom:4px}
#whatsNewModal .wn-body{font-size:13px;color:var(--muted);line-height:1.55}
#whatsNewModal .wn-link{display:inline-block;margin-top:6px;font-size:12px;font-weight:700;color:var(--a)}
#whatsNewModal .wn-actions{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap}
#whatsNewModal .wn-empty{text-align:center;padding:24px;color:var(--muted);font-size:13px}
`;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  function dismissedSet() {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch (_) {
      return new Set();
    }
  }
  function saveDismissed(set) {
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify([...set]));
    } catch (_) {}
  }

  let announcements = [];

  async function loadAnnouncements() {
    try {
      const r = await fetch(
        SB_URL +
          "/rest/v1/hub_announcements?select=*&published=eq.true&order=published_at.desc,created_at.desc&limit=20",
        {
          headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY },
          cache: "no-store",
        }
      );
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    } catch (_) {
      return [];
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, """);
  }

  function renderList(list) {
    if (!list.length) {
      return '<div class="wn-empty">No announcements yet. Check back later.</div>';
    }
    return list
      .map(function (a) {
        const date = a.published_at || a.created_at || "";
        let dateStr = "";
        try {
          dateStr = new Date(date).toLocaleDateString([], {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
        } catch (_) {}
        const cat = a.category
          ? '<span style="color:var(--a)">' + escapeHtml(a.category) + "</span>"
          : "";
        const important = a.important
          ? '<span style="color:#fbbf24">★ Important</span>'
          : "";
        const link = a.link_url
          ? '<a class="wn-link" href="' +
            escapeHtml(a.link_url) +
            '">' +
            escapeHtml(a.link_label || "Open →") +
            "</a>"
          : "";
        return (
          '<div class="wn-item" data-id="' +
          escapeHtml(a.id) +
          '"><div class="wn-meta">' +
          (dateStr ? "<span>" + dateStr + "</span>" : "") +
          cat +
          important +
          '</div><div class="wn-title">' +
          escapeHtml(a.title || "Update") +
          '</div><div class="wn-body">' +
          escapeHtml(a.body || "") +
          "</div>" +
          link +
          "</div>"
        );
      })
      .join("");
  }

  function openModal(list) {
    let modal = document.getElementById("whatsNewModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "mbg";
      modal.id = "whatsNewModal";
      modal.innerHTML =
        '<div class="modal"><button class="x" id="whatsNewX">×</button><h2>What’s New</h2><div id="whatsNewList"></div><div class="wn-actions"><button type="button" class="btn" id="whatsNewDismiss">Don’t show again for these</button><button type="button" class="btn" id="whatsNewClose">Close</button></div></div>';
      document.body.appendChild(modal);
      modal.addEventListener("click", function (e) {
        if (e.target === modal) modal.classList.remove("on");
      });
      document.getElementById("whatsNewX").addEventListener("click", function () {
        modal.classList.remove("on");
      });
      document.getElementById("whatsNewClose").addEventListener("click", function () {
        modal.classList.remove("on");
      });
      document.getElementById("whatsNewDismiss").addEventListener("click", function () {
        const set = dismissedSet();
        (list || announcements).forEach(function (a) {
          if (a.id) set.add(a.id);
        });
        saveDismissed(set);
        updateBadge();
        modal.classList.remove("on");
      });
    }
    document.getElementById("whatsNewList").innerHTML = renderList(list || announcements);
    modal.classList.add("on");
  }

  function unseen(list) {
    const set = dismissedSet();
    return list.filter(function (a) {
      return a.id && !set.has(a.id);
    });
  }

  function updateBadge() {
    const btn = document.getElementById("whatsNewBtn");
    if (!btn) return;
    const dot = btn.querySelector(".dot");
    const n = unseen(announcements).length;
    if (dot) dot.classList.toggle("on", n > 0);
  }

  function ensureBtn() {
    if (document.getElementById("whatsNewBtn")) return;
    const btn = document.createElement("button");
    btn.id = "whatsNewBtn";
    btn.type = "button";
    btn.innerHTML = '<span class="dot"></span><span>What’s New</span>';
    btn.addEventListener("click", function () {
      openModal(announcements);
    });
    document.body.appendChild(btn);
  }

  async function boot() {
    ensureBtn();
    announcements = await loadAnnouncements();
    updateBadge();
    const fresh = unseen(announcements);
    if (fresh.length) {
      function show() {
        openModal(fresh);
      }
      if (document.body.classList.contains("hub-ready") || sessionStorage.getItem("hub_loader_done_v1") === "1") {
        setTimeout(show, 400);
      } else {
        window.addEventListener(
          "hub:ready",
          function () {
            setTimeout(show, 500);
          },
          { once: true }
        );
        setTimeout(function () {
          if (unseen(announcements).length) show();
        }, 4000);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.__hubWhatsNew = {
    reload: async function () {
      announcements = await loadAnnouncements();
      updateBadge();
    },
    open: function () {
      openModal(announcements);
    },
  };
})();
