(function () {
  "use strict";

  const installButton = document.getElementById("installApp");
  const networkStatus = document.getElementById("networkStatus");
  let installPrompt = null;

  function isInstalled() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function updateNetworkStatus() {
    if (!networkStatus) return;
    const online = navigator.onLine;
    networkStatus.textContent = online ? "Online" : "Offline";
    networkStatus.classList.toggle("is-offline", !online);
    networkStatus.setAttribute("aria-label", online ? "You are online" : "You are offline. Previously visited pages may still work.");
  }

  updateNetworkStatus();
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);

  if (installButton) {
    installButton.hidden = true;
    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      installPrompt = event;
      installButton.hidden = isInstalled();
    });

    installButton.addEventListener("click", async () => {
      if (!installPrompt) return;
      installButton.disabled = true;
      try {
        await installPrompt.prompt();
        await installPrompt.userChoice;
        installPrompt = null;
        installButton.hidden = true;
      } catch (error) {
        console.error("Could not start app installation", error);
      } finally {
        installButton.disabled = false;
      }
    });

    window.addEventListener("appinstalled", () => {
      installPrompt = null;
      installButton.hidden = true;
    });
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js")
        .catch(error => console.error("Could not register offline support", error));
    }, { once: true });
  }
})();
