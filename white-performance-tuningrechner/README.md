# White Performance – sicherer FiveM-Tuningrechner

Vollständige Node.js-/Express-Webanwendung mit PostgreSQL, Mitarbeiter-Login, serverseitiger Preisberechnung und Adminbereich. Das Frontend bekommt niemals Einzelpreise. Die API `/api/catalog` liefert nur Namen, Kategorien, Icons und Bildpfade; `/api/calculate` liefert nur Position, Menge, Zwischensumme, Rabatt und Gesamtbetrag. Einzelpreise werden ausschließlich über die Admin-API ausgeliefert.

## Funktionen

- Responsives Dark-Design im Schwarz-/Rot-Look von White Performance
- Teilekatalog mit Kategorien, Icons und optionalen Bildern
- Warenkorb mit Mengensteuerung
- Vier Motor-, drei Getriebe-, drei Fahrwerks- und drei Bremsenstufen unter „Leistungsteile“
- Serverseitige Berechnung; Einzelpreise und Positionssummen verlassen den Server nicht
- Rabattrecht pro Mitarbeiter und globaler Maximalrabatt
- Geschützter Adminbereich: Teile, Preise, Kategorien (über Kategoriezuordnung der Teile), Bilder, Rabattregeln, Benutzer und Rechte
- Passwort-Hashing mit bcrypt, serverseitige Rollenprüfung bei jedem geschützten Request, PostgreSQL-Sessions, HttpOnly-/SameSite-Cookie, Login-Rate-Limit und Sicherheitsheader
- Kundenübersicht zum Drucken ohne Einzelpreise
- Render Blueprint für Webservice, PostgreSQL und persistente Bilddateien

## Enthaltener Startkatalog

Die 21 regulären Teile stammen aus dem bisherigen White-Performance-Teilekatalog. Aktualisierte Werte: Reinigungsset 500 $, Reparaturset (RepKit) 4.000 $. Die zwölf Leistungsteile sind separat vorhanden. Ihre Preise sind initial 0 $, weil noch keine konkreten Stufenpreise übermittelt wurden. Vor dem Livebetrieb diese zwölf Werte im Adminbereich setzen oder die Stufen vorübergehend deaktivieren.

Die Preise der übrigen Teile sind interne Startwerte aus dem vorhandenen Katalog und können jederzeit im Adminbereich angepasst werden. Alle Beträge sind FiveM-Spielwährung, keine realen Verkaufspreise.

## Lokal starten

Voraussetzungen: Node.js 20+ und PostgreSQL.

```bash
npm install
cp .env.example .env
# DATABASE_URL, SESSION_SECRET und ADMIN_PASSWORD in .env setzen
npm start
```

Anschließend `http://localhost:3000` öffnen. Den ersten Administrator legt der Server beim ersten Start an, wenn `ADMIN_PASSWORD` gesetzt ist. Der Standardname ist `admin` (über `ADMIN_USERNAME` änderbar). Das Startpasswort wird gehasht gespeichert. Ein bereits vorhandener Admin wird beim Neustart nicht überschrieben.

**Wichtig:** Ohne `DATABASE_URL` und `SESSION_SECRET` startet der Server absichtlich nicht. Niemals echte Zugangsdaten in GitHub committen.

## Deployment auf Render

1. ZIP entpacken und alle Inhalte direkt in ein neues GitHub-Repository hochladen (nicht den übergeordneten Projektordner als zusätzliche Ebene).
2. In Render `New` → `Blueprint` wählen und das Repository verbinden. Render liest `render.yaml` und erstellt Webservice, PostgreSQL-Datenbank und persistentes Upload-Laufwerk.
3. Beim Blueprint-Setup `ADMIN_PASSWORD` als Secret setzen (mindestens 12 Zeichen, am besten zufällig und einzigartig). Optional `ADMIN_USERNAME` ändern.
4. Deployment starten. Nach erfolgreichem Deploy die Render-URL öffnen und mit dem initialen Adminzugang anmelden.
5. Im Adminbereich zuerst die zwölf Leistungsteilpreise setzen, danach weitere Teile/Bilder und Mitarbeiterzugänge anlegen.

`SESSION_SECRET` wird durch Render generiert. `DATABASE_URL` wird aus der angelegten PostgreSQL-Datenbank verbunden. Bilddateien liegen auf dem persistenten Disk unter `/var/data/uploads`.

Wenn bereits ein Render-Dienst existiert: Die `render.yaml`-Ressourcen nicht blind in einen bestehenden Dienst importieren. Stattdessen PostgreSQL und Disk im Render-Dashboard bereitstellen und `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `UPLOAD_DIR=/var/data/uploads` sowie den Disk-Mount `/var/data` als Umgebungs-/Dienstkonfiguration setzen.

## Rollen und Sicherheit

- Mitarbeiter sehen keine Einzelpreise, weder in der Oberfläche noch in den Antworten der Mitarbeiter-API.
- Nur Admins können `/api/admin/*` verwenden. Die Rolle wird aus PostgreSQL bei jedem Admin-Request neu geprüft, nicht nur aus einem alten Login-Cookie.
- Mitarbeiter-Rabattrecht wird ebenfalls serverseitig aus der Datenbank gelesen. Der Maximalrabatt wird serverseitig begrenzt.
- Passwörter werden mit bcrypt (Cost 12) gehasht. Session-Cookies sind HttpOnly und in Produktion Secure sowie SameSite=Lax.
- Loginversuche sind limitiert. Uploads sind auf Bilddateien und 4 MB beschränkt.

Für öffentliche Produktion zusätzlich starke, einzigartige Passwörter vergeben, Adminzugänge sparsam verteilen und PostgreSQL-/Render-Zugriff beschränken. Die App speichert keine Kunden- oder Rechnungsdaten dauerhaft; der Druckdialog erstellt eine Kundenübersicht aus der aktuellen Auswahl.

## API-Überblick

| Route | Zugriff | Zweck |
|---|---|---|
| `POST /api/login` | öffentlich, limitiert | Anmeldung |
| `POST /api/logout` | angemeldet | Abmeldung |
| `GET /api/me` | öffentlich | aktuellen Loginstatus prüfen |
| `GET /api/catalog` | angemeldet | öffentliche Teileinformationen ohne Preise |
| `POST /api/calculate` | angemeldet | serverseitige Berechnung ohne Einzelpreise in der Antwort |
| `/api/admin/items` | Admin | Teile und interne Preise verwalten |
| `/api/admin/upload` | Admin | Teilebilder hochladen |
| `/api/admin/settings` | Admin | Rabattfunktion und Maximalrabatt |
| `/api/admin/users` | Admin | Benutzer und Berechtigungen |
| `GET /healthz` | öffentlich | Render Health Check |

## Projektstruktur

```text
.
├── public/
│   ├── index.html
│   └── app.js
├── uploads/
├── server.js
├── package.json
├── render.yaml
├── .env.example
└── README.md
```
