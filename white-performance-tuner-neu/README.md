# WHITE PERFORMANCE SHOP — Tuningrechner

Fertiges Node.js + Express Projekt für GitHub und Render.

## Dateien im Repository
- `server.js` — Express-Server mit geschütztem Admin-API, serverseitiger Kalkulation (`/api/calculate`) und strikter Trennung von öffentlichen Katalogdaten und Einzelpreisen (`/api/catalog`).
- `public/index.html`, `public/icons.js`, `public/styles.css`, `public/app.js` — Frontend mit allen Shop-Icons im White Performance Shop Design, Leistungsteilen (Motor-, Getriebe-, Fahrwerk-, Bremsenstufen, Turbolader), Rabattsteuerung und Kundenrechnung ohne Einzelpreise.
- `package.json` — Startskripte (`npm start` -> `node server.js`).
- `render.yaml` — Automatische Deployment-Konfiguration für Render.

## Start auf Render
1. Alle Dateien dieses Ordners in dein GitHub-Repository hochladen (wichtig: `server.js` und `package.json` liegen im Root-Verzeichnis).
2. In Render **New -> Web Service** wählen und das GitHub-Repository verbinden.
3. Build Command: `npm install` | Start Command: `npm start`.
