SKH — Swarup Sir's Knowledge Hub
Complete package with student credential convenience

Files:
- index.html
- student-login.html
- teacher-login.html
- student-app.webmanifest
- student-sw.js
- skh-icon.png

Login behavior:
1. The browser can offer to save the student's Roll No and Password using
   standard username/current-password autocomplete fields.
2. The optional "Remember my Roll No on this device" checkbox stores ONLY
   the Roll No in the browser's local storage.
3. The password is NOT stored by this website. If the student chooses
   "Save password", the browser/password manager stores it securely.
4. Supabase's normal authenticated session can keep the student signed in
   according to the existing app behavior.

Student-only shortcut:
- App name: SKH
- Start page: /student-login.html
- Icon: skh-icon.png

Upload all files to the root of the Cloudflare Pages deployment.
