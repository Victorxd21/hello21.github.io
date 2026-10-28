/*! Game Hub Loader — library boot screen (failsafe reveal) */
(function () {
  "use strict";

  var STORAGE_KEY = "hub_loader_done_v3";

  function revealHub() {
    try {
      document.body.classList.remove("hub-booting");
      document.body.classList.add("hub-ready");
      document.documentElement.classList.add("hub-ready");
    } catch (_) {}
  }

  // Already finished this tab session — skip overlay
  if (sessionStorage.getItem(STORAGE_KEY) === "1") {
    revealHub();
    return;
  }

  var css =
    "#hubLoader{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;" +
    "align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 42%,#20384c 0%,#152331 40%,#101923 76%);" +
    "transition:opacity .45s ease,visibility .45s ease;color:#e6edf3}" +
    "#hubLoader.done{opacity:0;visibility:hidden;pointer-events:none}" +
    "#hubLoader .loader-brand{width:72px;height:72px;display:grid;place-items:center;border:1px solid rgba(164,215,245,.25);" +
    "border-radius:20px;background:linear-gradient(145deg,#244964,#172b3b);box-shadow:0 12px 38px rgba(0,0,0,.32),0 0 32px rgba(26,159,255,.12);margin-bottom:24px}" +
    "#hubLoader .loader-brand span{font-size:24px;font-weight:900;letter-spacing:-2px;color:#c7eaff}" +
    "#hubLoader .loader-title{font-size:clamp(25px,5vw,36px);font-weight:800;letter-spacing:-1px;margin-bottom:6px}" +
    "#hubLoader .loader-caption{font-size:13px;color:#91aec3;margin-bottom:26px}" +
    "#hubLoader .loader-status{font-size:12px;color:#b1c8d8;margin-top:13px;min-height:18px}" +
    "#hubLoader .loader-bar{width:min(250px,62vw);height:5px;border-radius:999px;background:rgba(255,255,255,.09);margin-top:14px;overflow:hidden}" +
    "#hubLoader .loader-bar > i{display:block;height:100%;width:8%;border-radius:999px;background:linear-gradient(90deg,#1a9fff,#66c0f4);transition:width .35s ease}" +
    "#hubLoader.err .loader-status{color:#fca5a5}" +
    "#hubLoader .retry-btn{margin-top:18px;padding:10px 20px;border-radius:8px;border:1px solid rgba(102,192,244,.4);" +
    "background:rgba(26,159,255,.14);color:#d8efff;font-weight:700;font-size:13px;cursor:pointer;display:none}" +
    "#hubLoader.err .retry-btn{display:inline-flex}" +
    "#hubLoader .loader-orbit{width:20px;height:20px;margin-top:22px;border:2px solid rgba(255,255,255,.12);border-top-color:#66c0f4;border-radius:50%;animation:hubLoaderSpin .85s linear infinite}" +
    "@keyframes hubLoaderSpin{to{transform:rotate(360deg)}}" +
    "body.hub-booting .content{opacity:0}" +
    "body.hub-ready .content{opacity:1;transition:opacity .45s ease}";

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  function boot() {
    document.body.classList.add("hub-booting");

    var el = document.createElement("div");
    el.id = "hubLoader";
    el.innerHTML =
      '<div class="loader-brand" aria-hidden="true"><span>GH</span></div>' +
      '<div class="loader-title">Game Hub</div>' +
      '<div class="loader-caption">Getting your library ready</div>' +
      '<div class="loader-status" id="hubLoaderStatus">Starting…</div>' +
      '<div class="loader-bar"><i id="hubLoaderBar"></i></div>' +
      '<div class="loader-orbit" aria-hidden="true"></div>' +
      '<button type="button" class="retry-btn" id="hubLoaderRetry">Skip & continue</button>';
    document.body.appendChild(el);

    var statusEl = document.getElementById("hubLoaderStatus");
    var barEl = document.getElementById("hubLoaderBar");
    var finished = false;
    var progress = 0;

    function setProgress(p, msg) {
      progress = Math.max(progress, Math.min(100, p));
      if (barEl) barEl.style.width = progress + "%";
      if (msg && statusEl) statusEl.textContent = msg;
    }

    function finishOk() {
      if (finished) return;
      finished = true;
      setProgress(100, "Ready");
      setTimeout(function () {
        el.classList.add("done");
        revealHub();
        try {
          sessionStorage.setItem(STORAGE_KEY, "1");
        } catch (_) {}
        try {
          window.dispatchEvent(new CustomEvent("hub:ready"));
        } catch (_) {}
        // Remove overlay after fade so it cannot block clicks
        setTimeout(function () {
          try {
            el.remove();
          } catch (_) {}
        }, 600);
      }, 500);
    }

    function forceReveal() {
      if (finished) return;
      finished = true;
      el.classList.add("done");
      revealHub();
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch (_) {}
      try {
        window.dispatchEvent(new CustomEvent("hub:ready"));
      } catch (_) {}
      setTimeout(function () {
        try {
          el.remove();
        } catch (_) {}
      }, 400);
    }

    // Absolute failsafe: never stay on loader longer than 6s
    setTimeout(forceReveal, 6000);

    document.getElementById("hubLoaderRetry").addEventListener("click", function () {
      forceReveal();
    });

    // Show skip after 2.5s if still loading
    setTimeout(function () {
      if (!finished) {
        el.classList.add("err");
        if (statusEl) statusEl.textContent = "Still loading… you can skip";
      }
    }, 2500);

    setProgress(15, "Loading games…");

    var tries = 0;
    function check() {
      if (finished) return;
      tries++;
      var root = document.getElementById("root");
      var hasCards = root && root.querySelector(".game");
      var cached = false;
      try {
        cached = !!localStorage.getItem("hub_cached_games_v2");
      } catch (_) {}

      if (hasCards || (cached && tries > 6) || tries > 25) {
        setProgress(90, "Almost ready…");
        setTimeout(finishOk, 250);
        return;
      }
      setProgress(15 + Math.min(70, tries * 3), "Loading games…");
      setTimeout(check, 120);
    }

    setTimeout(check, 100);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else if (document.body) {
    boot();
  } else {
    setTimeout(boot, 0);
  }
})();
