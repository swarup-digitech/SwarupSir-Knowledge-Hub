/* Swarup Sir's Knowledge Hub — "Add to Home Screen / Install" helper (V14)
 *
 * Browsers never let a website create a shortcut silently: the student must
 * confirm once. This script makes that as automatic as browsers allow:
 *   • Every time the app is opened in a normal browser tab and is NOT
 *     installed, an install banner is shown.
 *   • Chrome/Edge/Samsung Internet (Android, Windows, Mac, Linux, ChromeOS):
 *     the browser itself tells us when the app is not installed — including
 *     after the shortcut was deleted — and the button opens the real
 *     install dialog.
 *   • iPhone/iPad (Safari) and Mac Safari cannot be detected or installed by
 *     a button, so step-by-step instructions are shown instead.
 *   • When the app is opened from the shortcut (standalone), nothing is shown.
 *
 * Use on any page:  <script src="/pwa-install.js?v=14" defer></script>
 * A page may set  window.skhInstallAllowed = () => true/false  to decide who
 * sees it (main.html shows it to students only).
 * The page must also have:  <link rel="manifest" href="/student-app.webmanifest">
 */
(function () {
  "use strict";
  if (window.SKHInstall) return;

  var SNOOZE_KEY = "skh_install_snooze_until";      // iOS/Safari "Later"
  var DONE_KEY = "skh_install_ios_done_until";       // iOS "I've added it"
  var deferred = null;          // Chrome's install prompt
  var installedNow = false;
  var relatedInstalled = false; // Chrome Android: app already installed?

  var ua = navigator.userAgent || "";
  var isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var isAndroid = /android/i.test(ua);
  var isMacSafari = !isIOS && /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua);
  var isFirefox = /Firefox\//.test(ua);
  var isMobile = isIOS || isAndroid || /Mobi/i.test(ua);

  function isStandalone() {
    try {
      return window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: window-controls-overlay)").matches ||
        window.matchMedia("(display-mode: minimal-ui)").matches ||
        window.navigator.standalone === true;
    } catch (_) { return false; }
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (_) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (_) {} }
  function allowed() {
    try { return typeof window.skhInstallAllowed === "function" ? !!window.skhInstallAllowed() : true; }
    catch (_) { return false; }
  }

  var CSS =
    "#skhInstall{position:fixed;z-index:2147482000;left:50%;bottom:16px;transform:translateX(-50%);" +
    "width:min(560px,calc(100vw - 24px));background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(15,23,42,.28);" +
    "border:2px solid #bfdbfe;padding:14px 16px;font:15px/1.45 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0f172a;" +
    "animation:skhInstIn .2s ease-out}" +
    "#skhInstall .row{display:flex;gap:12px;align-items:center}" +
    "#skhInstall img{width:48px;height:48px;border-radius:12px;flex:none}" +
    "#skhInstall h3{margin:0;font-size:17px}" +
    "#skhInstall p{margin:2px 0 0;color:#475569;font-size:14px}" +
    "#skhInstall ol{margin:10px 0 0 20px;padding:0;color:#334155;font-size:14px}" +
    "#skhInstall .acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}" +
    "#skhInstall button{font:600 15px system-ui,sans-serif;border-radius:10px;padding:10px 16px;cursor:pointer;border:0}" +
    "#skhInstall .pri{background:#2563eb;color:#fff;flex:1}" +
    "#skhInstall .sec{background:#eef2f7;color:#0f172a}" +
    "#skhInstall button:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}" +
    "@keyframes skhInstIn{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}" +
    "@media print{#skhInstall{display:none}}";

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  function hide() { var b = document.getElementById("skhInstall"); if (b && b.parentNode) b.parentNode.removeChild(b); }

  function render(mode) {
    hide();
    if (!document.getElementById("skhInstallStyle")) {
      var st = el("style", { id: "skhInstallStyle" }); st.textContent = CSS; document.head.appendChild(st);
    }
    var where = isMobile ? "home screen" : "computer";
    var box = el("div", { id: "skhInstall", role: "dialog", "aria-label": "Install Knowledge Hub" });
    var steps = "";
    if (mode === "ios") {
      steps = "<ol><li>Tap the <b>Share</b> button <span aria-hidden='true'>⬆︎</span> (bottom of the screen in Safari).</li>" +
        "<li>Scroll down and tap <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>.</li></ol>" +
        "<p style='margin-top:6px'>In Chrome on iPhone: tap <b>⋯</b> → <b>Add to Home Screen</b>.</p>";
    } else if (mode === "macsafari") {
      steps = "<ol><li>In the Safari menu bar choose <b>File → Add to Dock…</b></li><li>Click <b>Add</b>.</li></ol>";
    } else if (mode === "manual") {
      steps = "<ol><li>Open the browser menu <b>⋮</b>.</li><li>Choose <b>Install app</b> or <b>Add to Home screen</b>.</li></ol>";
    }
    box.innerHTML =
      "<div class='row'><img src='/skh-icon-192.png' alt=''><div><h3>Add Knowledge Hub to your " + where + "</h3>" +
      "<p>Open your assignments and tests in one tap, like an app.</p></div></div>" + steps +
      "<div class='acts'>" +
      (mode === "prompt" ? "<button type='button' class='pri' data-a='install'>＋ " + (isMobile ? "Add to Home Screen" : "Install on this computer") + "</button>" : "") +
      (mode === "ios" || mode === "macsafari" ? "<button type='button' class='pri' data-a='done'>✓ I have added it</button>" : "") +
      "<button type='button' class='sec' data-a='later'>Later</button></div>";
    box.addEventListener("click", function (ev) {
      var a = ev.target && ev.target.getAttribute && ev.target.getAttribute("data-a");
      if (!a) return;
      if (a === "install") install();
      if (a === "later") {
        ssSet("skh_install_hidden", "1");                    // hidden until the app is opened again
        if (mode !== "prompt") lsSet(SNOOZE_KEY, String(Date.now() + 24 * 3600 * 1000)); // iOS/Safari: 1 day
        hide();
      }
      if (a === "done") { lsSet(DONE_KEY, String(Date.now() + 30 * 24 * 3600 * 1000)); hide(); }
    });
    (document.body || document.documentElement).appendChild(box);
  }

  function install() {
    if (!deferred) { render(isIOS ? "ios" : isMacSafari ? "macsafari" : "manual"); return; }
    var p = deferred; deferred = null;
    try {
      p.prompt();
      Promise.resolve(p.userChoice).then(function (c) {
        hide();
        if (!c || c.outcome !== "accepted") ssSet("skh_install_hidden", "1");
      }).catch(hide);
    } catch (_) { hide(); }
  }

  function maybeShow() {
    if (installedNow || isStandalone() || !allowed() || ssGet("skh_install_hidden")) return;
    if (deferred) { render("prompt"); return; }                 // Chrome/Edge: definitely not installed
    if (relatedInstalled) return;                               // Chrome Android says it is installed
    var now = Date.now();
    if (isIOS || isMacSafari) {
      if (Number(lsGet(DONE_KEY) || 0) > now || Number(lsGet(SNOOZE_KEY) || 0) > now) return;
      render(isIOS ? "ios" : "macsafari");
    }
    // Other browsers: Chrome/Edge will fire 'beforeinstallprompt' if the app
    // can be installed; Firefox desktop cannot install web apps, so nothing.
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();             // we show our own banner (button = real install dialog)
    deferred = e;
    installedNow = false;
    relatedInstalled = false;       // the browser says: NOT installed (e.g. shortcut was removed)
    maybeShow();
  });
  window.addEventListener("appinstalled", function () { installedNow = true; deferred = null; hide(); });

  if (navigator.getInstalledRelatedApps) {
    navigator.getInstalledRelatedApps().then(function (apps) { relatedInstalled = !!(apps && apps.length); }).catch(function () {});
  }
  if ("serviceWorker" in navigator) {
    // An active service worker is required by browsers before they offer installation.
    navigator.serviceWorker.getRegistration("/").then(function (r) {
      if (!r) navigator.serviceWorker.register("/student-sw.js").catch(function () {});
    }).catch(function () {});
  }

  window.SKHInstall = { maybeShow: maybeShow, hide: hide, install: install, isStandalone: isStandalone };

  function start() { setTimeout(maybeShow, 1200); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
