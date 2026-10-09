/* Swarup Sir's Knowledge Hub — shared UI helpers (V13)
 * notify(message, type?)  — non-blocking toast message that replaces the
 * browser alert() pop-ups. type: 'success' | 'error' | 'info' (auto-detected
 * from the text when omitted). Messages stay longer when they are long, and
 * every toast has a close (×) button.
 */
(function () {
  "use strict";

  var STYLE =
    "#skhToasts{position:fixed;z-index:2147483000;left:50%;bottom:18px;transform:translateX(-50%);" +
    "display:flex;flex-direction:column;gap:10px;width:min(560px,calc(100vw - 32px));pointer-events:none}" +
    ".skh-toast{pointer-events:auto;display:flex;gap:12px;align-items:flex-start;padding:13px 14px 13px 16px;" +
    "border-radius:12px;box-shadow:0 10px 30px rgba(15,23,42,.22);font:500 15px/1.45 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;" +
    "color:#0f172a;background:#fff;border-left:6px solid #2563eb;white-space:pre-line;word-break:break-word;" +
    "animation:skhToastIn .18s ease-out}" +
    ".skh-toast.success{border-left-color:#16a34a;background:#f0fdf4}" +
    ".skh-toast.error{border-left-color:#dc2626;background:#fef2f2}" +
    ".skh-toast.info{border-left-color:#2563eb;background:#eff6ff}" +
    ".skh-toast .skh-toast-msg{flex:1;min-width:0}" +
    ".skh-toast button{all:unset;cursor:pointer;font-size:20px;line-height:1;padding:0 4px;color:#475569}" +
    ".skh-toast button:focus-visible{outline:2px solid #2563eb;border-radius:4px}" +
    "@keyframes skhToastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}" +
    "@media print{#skhToasts{display:none}}";

  function ensureHost() {
    var host = document.getElementById("skhToasts");
    if (host) return host;
    if (!document.getElementById("skhToastStyle")) {
      var st = document.createElement("style");
      st.id = "skhToastStyle";
      st.textContent = STYLE;
      (document.head || document.documentElement).appendChild(st);
    }
    host = document.createElement("div");
    host.id = "skhToasts";
    host.setAttribute("aria-live", "polite");
    (document.body || document.documentElement).appendChild(host);
    return host;
  }

  function guessType(text) {
    var t = String(text || "").toLowerCase();
    if (/(could not|cannot|can't|unable|error|failed|invalid|not allowed|not authori|denied|missing|required|please |not found|no longer|already submitted|time is over)/.test(t)) return "error";
    if (/(success|saved|updated|deleted|created|uploaded|complete|submitted|✓|added|removed|copied|imported|approved|released)/.test(t)) return "success";
    return "info";
  }

  function notify(message, type) {
    var text = message instanceof Error ? message.message : String(message == null ? "" : message);
    if (!document.body) { try { window.console && console.log(text); } catch (_) {} return; }
    var kind = type || guessType(text);
    var host = ensureHost();
    var box = document.createElement("div");
    box.className = "skh-toast " + kind;
    box.setAttribute("role", kind === "error" ? "alert" : "status");
    var msg = document.createElement("div");
    msg.className = "skh-toast-msg";
    msg.textContent = text;
    var close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Close message");
    close.textContent = "×";
    var timer = null;
    function remove() { if (timer) clearTimeout(timer); if (box.parentNode) box.parentNode.removeChild(box); }
    close.onclick = remove;
    box.appendChild(msg);
    box.appendChild(close);
    host.appendChild(box);
    while (host.children.length > 4) host.removeChild(host.firstChild);
    var ms = Math.min(15000, Math.max(4000, text.length * 70)) + (kind === "error" ? 3000 : 0);
    timer = setTimeout(remove, ms);
    box.addEventListener("mouseenter", function () { if (timer) { clearTimeout(timer); timer = null; } });
    box.addEventListener("mouseleave", function () { if (!timer) timer = setTimeout(remove, 3000); });
  }

  window.notify = notify;
})();
