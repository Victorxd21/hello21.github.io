/*! Game Hub Loader — GH fill + split animation (failsafe reveal) */
(function () {
  "use strict";

  var STORAGE_KEY = "hub_loader_done_v2";

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
    "align-items:center;justify-content:center;background:#06060e;" +
    "transition:opacity .5s ease,visibility .5s ease}" +
    "#hubLoader.done{opacity:0;visibility:hidden;pointer-events:none}" +
    "#hubLoader .loader-title{font-size:clamp(28px,6vw,48px);font-weight:900;letter-spacing:-1.5px;" +
    "background:linear-gradient(125deg,#fff 10%,#a78bfa 40%,#22d3ee 70%,#f472b6 95%);" +
    "-webkit-background-clip:text;background-clip:text;color:transparent;margin-bottom:28px}" +
    "#hubLoader .gh-wrap{position:relative;width:140px;height:90px;display:flex;align-items:center;justify-content:center;margin-bottom:20px}" +
    "#hubLoader .gh-letter{font-size:72px;font-weight:900;line-height:1;letter-spacing:-4px;position:relative;display:inline-block;color:rgba(255,255,255,.12)}" +
    "#hubLoader .gh-letter .fill{position:absolute;left:0;bottom:0;width:100%;overflow:hidden;height:0%;transition:height .3s ease}" +
    "#hubLoader .gh-letter .fill span{position:absolute;left:0;bottom:0;font-size:72px;font-weight:900;line-height:1;letter-spacing:-4px}" +
    "#hubLoader .gh-g .fill{color:#a78bfa}" +
    "#hubLoader .gh-h .fill{color:#22d3ee}" +
    "#hubLoader .loader-status{font-size:12px;color:#8b87a8;margin-top:8px;min-height:18px}" +
    "#hubLoader .loader-bar{width:min(200px,50vw);height:3px;border-radius:999px;background:rgba(255,255,255,.08);margin-top:16px;overflow:hidden}" +
    "#hubLoader .loader-bar > i{display:block;height:100%;width:8%;border-radius:999px;background:linear-gradient(90deg,#a78bfa,#22d3ee);transition:width .35s ease}" +
    "#hubLoader.err .loader-status{color:#fca5a5}" +
    "#hubLoader .retry-btn{margin-top:18px;padding:10px 20px;border-radius:999px;border:1px solid rgba(167,139,250,.4);" +
    "background:rgba(167,139,250,.15);color:#e0d9ff;font-weight:700;font-size:13px;cursor:pointer;display:none}" +
    "#hubLoader.err .retry-btn{display:inline-flex}" +
    "@keyframes hubSplitG{to{transform:translateX(-80px);opacity:0}}" +
    "@keyframes hubSplitH{to{transform:translateX(80px);opacity:0}}" +
    "#hubLoader.split .gh-g{animation:hubSplitG .5s ease forwards}" +
    "#hubLoader.split .gh-h{animation:hubSplitH .5s ease forwards}" +
    "#hubLoader.split .loader-title{opacity:0;transition:opacity .4s ease}" +
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
      '<div class="loader-title">Game Hub</div>' +
      '<div class="gh-wrap">' +
      '<span class="gh-letter gh-g">G<span class="fill"><span>G</span></span></span>' +
      '<span class="gh-letter gh-h">H<span class="fill"><span>H</span></span></span>' +
      "</div>" +
      '<div class="loader-status" id="hubLoaderStatus">Starting…</div>' +
      '<div class="loader-bar"><i id="hubLoaderBar"></i></div>' +
      '<button type="button" class="retry-btn" id="hubLoaderRetry">Skip & continue</button>';
    document.body.appendChild(el);

    var statusEl = document.getElementById("hubLoaderStatus");
    var barEl = document.getElementById("hubLoaderBar");
    var fillG = el.querySelector(".gh-g .fill");
    var fillH = el.querySelector(".gh-h .fill");
    var finished = false;
    var progress = 0;

    function setProgress(p, msg) {
      progress = Math.max(progress, Math.min(100, p));
      if (barEl) barEl.style.width = progress + "%";
      if (fillG) fillG.style.height = Math.min(100, progress) + "%";
      if (fillH) fillH.style.height = Math.min(100, Math.max(0, progress - 5)) + "%";
      if (msg && statusEl) statusEl.textContent = msg;
    }

    function finishOk() {
      if (finished) return;
      finished = true;
      setProgress(100, "Ready");
      el.classList.add("split");
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
