/*! Game Hub Loader — GH fill + split animation */
(function () {
  "use strict";

  if (sessionStorage.getItem("hub_loader_done_v1") === "1") {
    document.documentElement.classList.add("hub-ready");
    return;
  }

  const css = `
#hubLoader{
  position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;
  align-items:center;justify-content:center;background:#06060e;
  transition:opacity .55s ease,visibility .55s ease;
}
#hubLoader.done{opacity:0;visibility:hidden;pointer-events:none}
#hubLoader .loader-title{
  font-size:clamp(28px,6vw,48px);font-weight:900;letter-spacing:-1.5px;
  background:linear-gradient(125deg,#fff 10%,#a78bfa 40%,#22d3ee 70%,#f472b6 95%);
  -webkit-background-clip:text;background-clip:text;color:transparent;
  margin-bottom:28px;opacity:0;transform:translateY(12px);
  animation:hubFadeUp .6s .15s forwards;
}
#hubLoader .gh-wrap{
  position:relative;width:140px;height:90px;display:flex;align-items:center;justify-content:center;
  margin-bottom:20px;
}
#hubLoader .gh-letter{
  font-size:72px;font-weight:900;line-height:1;letter-spacing:-4px;
  position:relative;display:inline-block;
  color:rgba(255,255,255,.12);
}
#hubLoader .gh-letter .fill{
  position:absolute;left:0;bottom:0;width:100%;overflow:hidden;
  color:#a78bfa;height:0%;
  transition:height .35s cubic-bezier(.22,1,.36,1);
}
#hubLoader .gh-letter .fill span{
  position:absolute;left:0;bottom:0;font-size:72px;font-weight:900;line-height:1;letter-spacing:-4px;
}
#hubLoader .gh-g .fill{color:#a78bfa}
#hubLoader .gh-h .fill{color:#22d3ee}
#hubLoader .loader-status{
  font-size:12px;color:#8b87a8;margin-top:8px;min-height:18px;
  opacity:0;animation:hubFadeUp .5s .4s forwards;
}
#hubLoader .loader-bar{
  width:min(200px,50vw);height:3px;border-radius:999px;background:rgba(255,255,255,.08);
  margin-top:16px;overflow:hidden;opacity:0;animation:hubFadeUp .5s .5s forwards;
}
#hubLoader .loader-bar > i{
  display:block;height:100%;width:8%;border-radius:999px;
  background:linear-gradient(90deg,#a78bfa,#22d3ee);
  transition:width .4s ease;
}
#hubLoader.err .loader-status{color:#fca5a5}
#hubLoader .retry-btn{
  margin-top:18px;padding:10px 20px;border-radius:999px;border:1px solid rgba(167,139,250,.4);
  background:rgba(167,139,250,.15);color:#e0d9ff;font-weight:700;font-size:13px;cursor:pointer;
  display:none;
}
#hubLoader.err .retry-btn{display:inline-flex}
@keyframes hubFadeUp{to{opacity:1;transform:none}}
@keyframes hubSplitG{to{transform:translateX(-80px);opacity:0}}
@keyframes hubSplitH{to{transform:translateX(80px);opacity:0}}
#hubLoader.split .gh-g{animation:hubSplitG .55s cubic-bezier(.22,1,.36,1) forwards}
#hubLoader.split .gh-h{animation:hubSplitH .55s cubic-bezier(.22,1,.36,1) forwards}
#hubLoader.split .loader-title{animation:hubTitleToHero .7s .15s cubic-bezier(.22,1,.36,1) forwards}
@keyframes hubTitleToHero{
  to{opacity:0;transform:translateY(-40px) scale(.85)}
}
@media (prefers-reduced-motion:reduce){
  #hubLoader .loader-title,#hubLoader .loader-status,#hubLoader .loader-bar{animation:none;opacity:1;transform:none}
  #hubLoader.split .gh-g,#hubLoader.split .gh-h{animation:none;opacity:0}
}
body.hub-booting .content{opacity:0;pointer-events:none}
body.hub-ready .content{opacity:1;transition:opacity .5s ease}
.hub-card-in{animation:hubCardIn .45s cubic-bezier(.22,1,.36,1) both}
@keyframes hubCardIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
`;

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  document.body.classList.add("hub-booting");

  const el = document.createElement("div");
  el.id = "hubLoader";
  el.innerHTML = `
    <div class="loader-title">Game Hub</div>
    <div class="gh-wrap">
      <span class="gh-letter gh-g">G<span class="fill"><span>G</span></span></span>
      <span class="gh-letter gh-h">H<span class="fill"><span>H</span></span></span>
    </div>
    <div class="loader-status" id="hubLoaderStatus">Starting…</div>
    <div class="loader-bar"><i id="hubLoaderBar"></i></div>
    <button type="button" class="retry-btn" id="hubLoaderRetry">Retry</button>
  `;
  document.body.appendChild(el);

  const statusEl = document.getElementById("hubLoaderStatus");
  const barEl = document.getElementById("hubLoaderBar");
  const fillG = el.querySelector(".gh-g .fill");
  const fillH = el.querySelector(".gh-h .fill");

  let progress = 0;
  function setProgress(p, msg) {
    progress = Math.max(progress, Math.min(100, p));
    if (barEl) barEl.style.width = progress + "%";
    if (fillG) fillG.style.height = Math.min(100, progress) + "%";
    if (fillH) fillH.style.height = Math.min(100, Math.max(0, progress - 5)) + "%";
    if (msg && statusEl) statusEl.textContent = msg;
  }

  function finishOk() {
    setProgress(100, "Ready");
    el.classList.add("split");
    setTimeout(function () {
      el.classList.add("done");
      document.body.classList.remove("hub-booting");
      document.body.classList.add("hub-ready");
      document.documentElement.classList.add("hub-ready");
      try { sessionStorage.setItem("hub_loader_done_v1", "1"); } catch (_) {}
      document.querySelectorAll(".game").forEach(function (card, i) {
        card.classList.add("hub-card-in");
        card.style.animationDelay = (i * 0.03) + "s";
      });
      window.dispatchEvent(new CustomEvent("hub:ready"));
    }, 700);
  }

  function finishErr(msg) {
    el.classList.add("err");
    if (statusEl) statusEl.textContent = msg || "Could not load the hub.";
  }

  async function init() {
    setProgress(12, "Connecting…");
    try {
      setProgress(30, "Loading games…");
      let tries = 0;
      await new Promise(function (resolve) {
        function check() {
          tries++;
          const root = document.getElementById("root");
          const hasCards = root && root.querySelector(".game");
          const cached = localStorage.getItem("hub_cached_games_v2");
          if (hasCards || (cached && tries > 8) || tries > 40) {
            resolve();
            return;
          }
          setProgress(30 + Math.min(50, tries * 2), "Loading games…");
          setTimeout(check, 100);
        }
        setTimeout(check, 80);
      });

      setProgress(85, "Almost ready…");
      await new Promise(function (r) { setTimeout(r, 200); });
      setProgress(95, "Finishing…");
      finishOk();
    } catch (e) {
      finishErr("Load failed. Check your connection.");
    }
  }

  document.getElementById("hubLoaderRetry").addEventListener("click", function () {
    el.classList.remove("err");
    progress = 0;
    setProgress(5, "Retrying…");
    location.reload();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
