SKH — Swarup Sir's Knowledge Hub
Complete student PWA package — v3

Upload these files to the ROOT of Cloudflare Pages:
index.html
student-login.html
teacher-login.html
student-app.webmanifest
student-sw.js
skh-icon.png

Student PWA:
- Home Screen name: SKH
- Opens: /student-login.html
- Uses the supplied SKH icon.
- Updated service worker uses network-first navigation and a safe cached fallback.
- Old SKH service-worker caches are automatically removed.

Login convenience:
- Roll No can be remembered locally when the student selects the option.
- Password is NOT stored by the website.
- Browser password managers can save/autofill the Roll No and Password.

IMPORTANT AFTER DEPLOYMENT:
If an old SKH icon is already installed on a phone and still shows the old
ERR_FAILED screen, REMOVE/UNINSTALL that old SKH shortcut once, then open
https://swarupsir-knowledge-hub.pages.dev/student-login.html in Chrome and
install SKH again. This is necessary because the old installed PWA can retain
its previous launch/service-worker state.
