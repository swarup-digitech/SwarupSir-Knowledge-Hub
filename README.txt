SWARUP SIR'S KNOWLEDGE HUB — COMPLETE PWA PACKAGE

Cloudflare Pages files (upload all of these to the deployment root):
- index.html
- student-login.html
- teacher-login.html
- manifest.webmanifest
- sw.js
- icon-192.png
- icon-512.png
- icon-maskable-512.png

Supabase SQL (DO NOT upload this as index.html):
- automatic_low_score_reassignment.sql

FEATURES INCLUDED:
- Student Roll No + Password login
- Teacher login
- One submission per student per assignment
- Score below 80%: submission is automatically deleted after 3 hours
- Assignment remains assigned and becomes available again
- Automatic student dashboard status refresh
- Teacher can manually delete attempts and use Reassign Fresh
- PWA / Add to Home Screen support
- Custom Swarup Sir's Knowledge Hub app icon
- Android/Chrome native install prompt where supported
- iPhone/iPad Add to Home Screen guidance

DEPLOYMENT:
1. Upload the website files listed above to the ROOT of the Cloudflare Pages deployment.
2. Run automatic_low_score_reassignment.sql ONLY in Supabase SQL Editor.
3. Do not upload any .sql file as index.html.

NOTE:
A website cannot silently install an icon on a device. The browser requires user confirmation. The app provides the installation prompt/instructions when supported.
