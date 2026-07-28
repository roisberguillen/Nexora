# Google Drive OAuth

Nexora uses Google Identity Services in the browser with the least-privilege
`https://www.googleapis.com/auth/drive.appdata` scope. Backups are encrypted before upload;
no financial data, passphrase or encryption key is sent in clear text.

Create an OAuth client of type **Web application** in Google Cloud Console. Add the exact local
and production origins as Authorized JavaScript Origins, then set `VITE_GOOGLE_CLIENT_ID` in a
local `.env` file and `VITE_GOOGLE_DRIVE_ENABLED=true`. Do not create or expose a client secret.

Tokens are kept in memory only and are discarded on disconnect or page close. A missing client ID
leaves cloud backup disabled while local encrypted backups remain available.
