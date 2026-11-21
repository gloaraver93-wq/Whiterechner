# Tuningrechner für die FiveM-Tuningwerkstatt

Dark-Design-Rechner mit Bildern, Kategorien, Rabattfunktion, Rechnung zum Drucken und geschütztem Adminbereich.
**Keine externen Abhängigkeiten** – läuft mit reinem Node.js ≥ 22.13 (eingebautes SQLite, kein `npm install` nötig).

## Schnellstart (lokal)

```bash
ADMIN_PASSWORD='MeinStartPasswort1' npm start
# → http://localhost:3000   (Benutzer: admin)
```

Ohne `ADMIN_PASSWORD` erzeugt der erste Start ein Zufallspasswort und gibt es einmalig im Terminal aus
(es muss beim ersten Login geändert werden). Beim ersten Start wird außerdem ein Beispielkatalog
(Leistungsteile mit Motor-/Getriebe-/Fahrwerks-/Bremsenstufen, Optik, Felgen, Lack, …) angelegt.

Tests (Berechnung, Rabatt-Regeln, Zugriffsschutz): `npm test`

## Rollen

| | Mitarbeiter | Administrator |
|---|---|---|
| Teile, Bilder, Kategorien, Stufen auswählen | ✔ | ✔ |
| Zwischensumme, Rabatt (%), Ersparnis, Gesamtsumme | ✔ | ✔ |
| Rabatt ein-/ausschalten | nur mit Berechtigung | ✔ |
| Rabatt-Prozentsatz ändern | ✘ | ✔ (global und pro Rechnung) |
| **Einzelpreise, Rechnungsdetails mit Preisen** | ✘ | ✔ |
| Teile/Kategorien/Stufen/Preise/Bilder verwalten | ✘ | ✔ |
| Rabatt-Einstellungen, Benutzer & Berechtigungen | ✘ | ✔ |

Administration: `/admin/` (Link im Rechner, nur für Admins sichtbar).

## So ist die Trennung der Preise abgesichert

- Der Katalog-Endpunkt `/api/catalog` liest die Preisspalte **nie** aus der Datenbank – Preise sind für
  Mitarbeiter weder in Antworten noch im Browser-Netzwerk-Tab oder Quelltext vorhanden.
- Der Client sendet nur Teile-IDs. **Alle Summen und der Rabatt werden serverseitig** berechnet
  (`src/pricing.js`); mitgeschickte Preise/Summen/Prozentsätze werden ignoriert.
- Alle `/api/admin/*`-Routen prüfen die Rolle auf dem Server (403 für Mitarbeiter, 401 ohne Login).
  `/admin/` und `admin.js` werden nur an angemeldete Admins ausgeliefert.
- Passwörter: scrypt + Salt. Sessions: zufällige Tokens, nur als Hash in der DB, Cookie `HttpOnly`,
  `SameSite=Strict`, `Secure` in Produktion. Login-Sperre nach Fehlversuchen (Brute-Force-Schutz).
- CSRF-Schutz (Pflicht-Header + Origin-Prüfung), strikte Content-Security-Policy, Bild-Upload nur für
  Admins mit Prüfung der Dateisignatur (PNG/JPG/WEBP/GIF, max. 4 MB, kein SVG).
- Neue/zurückgesetzte Benutzer müssen ihr Passwort beim ersten Login ändern.

> **Hinweis zur Anzeige der Zwischensumme:** Die Vorgabe erlaubt Mitarbeitern die Zwischensumme. Wählt jemand
> genau *ein* Teil aus, entspricht die Zwischensumme logischerweise dessen Preis. Das lässt sich bei
> einer sichtbaren Summe nicht verhindern; der Zugriff auf die Preisliste selbst ist aber gesperrt.

## Deployment über GitHub + Render

1. Projekt in ein neues GitHub-Repository pushen:
   ```bash
   git init && git add . && git commit -m "Tuningrechner"
   git branch -M main && git remote add origin https://github.com/<user>/<repo>.git && git push -u origin main
   ```
2. In Render: **New → Blueprint** → Repository wählen. `render.yaml` richtet Web-Service und persistente Disk ein.
3. Im Dashboard die Umgebungsvariable **`ADMIN_PASSWORD`** setzen (mind. 8 Zeichen) und deployen.
4. Anmelden mit `admin` und dem gesetzten Passwort, Teile/Preise anpassen, Mitarbeiter anlegen.

**Wichtig – Daten dauerhaft speichern:** Die SQLite-Datenbank und hochgeladene Bilder liegen unter `DATA_DIR`
(`/var/data`, persistente Disk). Persistente Disks benötigen mindestens den Render-Tarif *Starter*.
Auf dem kostenlosen Tarif wäre das Dateisystem flüchtig – bei jedem Neustart/Deploy gingen Daten verloren.

**Zugang verloren?** Im Render-Shell-Tab: `node scripts/reset-admin.js <benutzer> <neues-passwort>`.

## Projektstruktur

```
server.js              Einstieg, statische Auslieferung, Admin-Zugriffsschutz
src/api.js             REST-API (Login, Katalog, Berechnung, Rechnungen, Admin-Routen)
src/pricing.js         serverseitige Preis- und Rabattberechnung
src/db.js              SQLite-Schema, Einstellungen, Seed, Admin-Anlage
src/security.js        Passwort-Hashing, Tokens, Rate-Limiter
src/catalog-seed.js    Beispielkatalog (Preise = Beispielwerte)
public/                Rechner-Oberfläche (index.html, app.js, styles.css, Bilder)
private/admin/         Admin-Oberfläche (nur für Admins ausgeliefert)
scripts/               Bildgenerator, Tests, Admin-Reset
```

## Anpassen

- **Eigene Bilder:** Admin → *Teile & Preise* → Teil bearbeiten → *Bild hochladen* (Standardbilder sind SVG-Platzhalter).
- **Stufen:** Kategorien mit „Nur ein Teil pro Rechnung wählbar“ ersetzen niedrigere durch höhere Stufen.
  Unter *Kategorien* abschaltbar, falls mehrere Stufen kombinierbar sein sollen.
- **Währung/Firmenname/Rabatt:** Admin → *Rabatt & Einstellungen*.
