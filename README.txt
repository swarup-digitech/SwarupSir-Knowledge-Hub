SKH — Swarup Sir's Knowledge Hub
Complete student-login shortcut package

UPLOAD ALL FILES TO THE ROOT OF YOUR CLOUDFLARE PAGES SITE:

index.html
student-login.html
teacher-login.html
student-app.webmanifest
student-sw.js
skh-icon.png

Student flow:
Student Login -> Student Dashboard -> Logout -> Student Login

The student Home Screen/PWA shortcut is named "SKH" and uses the supplied
Swarup Sir's Knowledge Hub icon.

Important:
A browser cannot silently install a Home Screen shortcut. On supported
browsers the installation prompt is requested after the student's first
successful login; otherwise the student can use the browser's
"Add to Home screen" / "Install app" option.

Do not rename the manifest, service worker, or icon files unless the
references in student-login.html and student-app.webmanifest are updated.
