# Deployment (Hybrid: Vercel + cyon.ch)

cyon.ch kann keine dauerhaft laufende Node.js-App aus dem Internet
erreichbar machen (nur CLI-Nutzung von Node/npm, siehe
[cyon-Support](https://www.cyon.ch/support/a/npm)). Deshalb läuft die
App selbst auf **Vercel** (kostenlos, für Next.js gebaut), während
**Datenbank (MariaDB)** und **Email-Versand (SMTP)** über dein
bestehendes cyon-Hosting laufen.

## Voraussetzungen

- Ein GitHub-Repository für dieses Projekt (Vercel deployt aus Git).
- Ein Vercel-Account (kostenlos), verbunden mit GitHub.
- Bei cyon: eine MariaDB-Datenbank ([Datenbank erstellen](https://www.cyon.ch/support/a/datenbank-erstellen))
  und ein SMTP-fähiges Email-Postfach.
- **Wichtig, vor dem Deployment prüfen**: ob deine cyon-Datenbank von
  ausserhalb (also von Vercel aus) erreichbar ist. Shared-Hosting
  beschränkt das teilweise auf bestimmte IP-Adressen oder erfordert eine
  Freigabe im cyon-Kundencenter. Falls externe Verbindungen nicht
  möglich sind, beim cyon-Support nachfragen, wie das freigeschaltet
  wird.

## 1. Datenbank bei cyon anlegen

1. Im cyon-Kundencenter eine neue MariaDB-Datenbank erstellen.
2. Host, Port, Datenbankname, Benutzername und Passwort notieren.
3. Daraus die Verbindungs-URL bauen:
   ```
   mysql://BENUTZER:PASSWORT@HOST:PORT/DATENBANKNAME
   ```

## 2. Environment-Variablen in Vercel setzen

Im Vercel-Projekt unter **Settings → Environment Variables**:

| Variable | Wert |
|---|---|
| `DATABASE_URL` | die cyon-MariaDB-URL von oben |
| `SESSION_SECRET` | zufälliger String, z.B. `openssl rand -base64 32` |
| `ADMIN_EMAIL` | die Email-Adresse, an die Login-Links gehen sollen |
| `SMTP_HOST` | dein cyon-SMTP-Host |
| `SMTP_PORT` | meist `587` |
| `SMTP_USER` | dein cyon-Email-Benutzername |
| `SMTP_PASSWORD` | dein cyon-Email-Passwort |
| `SMTP_FROM` | Absenderadresse (kann gleich wie `SMTP_USER` sein) |

`APP_URL` muss i.d.R. **nicht** gesetzt werden — Vercel liefert die
Basis-URL automatisch über `VERCEL_URL`. Nur bei einer eigenen Domain
explizit setzen (siehe `.env.example`).

## 3. Migrationen anwenden

Vor dem ersten Deployment (und nach jeder Schema-Änderung) einmalig lokal
gegen die cyon-Datenbank ausführen (Migrationen selbst laufen nicht
automatisch auf Vercel, da Vercel-Builds keinen dauerhaften Zugriff auf
eine Migrations-Historie brauchen):

```bash
DATABASE_URL="mysql://BENUTZER:PASSWORT@HOST:PORT/DATENBANKNAME" npx prisma migrate deploy
```

## 4. Deployment

1. Repository zu GitHub pushen.
2. In Vercel: "Add New Project" → GitHub-Repo auswählen → Environment
   Variables aus Schritt 2 eintragen → Deploy.
3. Danach ist die App unter der von Vercel vergebenen `*.vercel.app`-URL
   erreichbar (Organisator-Bereich unter `/admin`, öffentliche Ansicht
   unter `/pairings`).

Für eine eigene Domain: in Vercel unter **Settings → Domains** hinzufügen
und beim Domain-Registrar die von Vercel angegebenen DNS-Einträge setzen.

## Updates einspielen

Jeder Push auf den `main`-Branch löst automatisch ein neues
Vercel-Deployment aus. Bei Schema-Änderungen vorher wie in Schritt 3
`prisma migrate deploy` gegen die cyon-Datenbank laufen lassen.

## Backup

Regelmässige Backups der MariaDB-Datenbank über das cyon-Kundencenter
einrichten (cyon erstellt i.d.R. tägliche Backups automatisch, siehe
[cyon-Support: Datenbank exportieren](https://www.cyon.ch/support/a/datenbank-exportieren)).
Zusätzlich manuell exportierbar:

```bash
mysqldump -h HOST -u BENUTZER -p DATENBANKNAME > backup-$(date +%F).sql
```

## Sicherheit

- **Zugriff auf dein cyon-Konto selbst** (Kundencenter-Login, SSH/FTP)
  liegt ausserhalb dessen, was diese App absichern kann — falls cyon
  2FA für das Kundencenter anbietet, aktivier es dort direkt.
- Die App selbst schützt vor unautorisiertem Zugriff über die Webseite
  durch: passwortlosen Email-Login (Abschnitt 2 in SPEC.md),
  Rate-Limiting auf Login-Link-Anfragen, Sicherheits-HTTP-Header (siehe
  `next.config.ts`), und Prisma-parametrisierte Datenbankzugriffe
  (kein SQL-Injection-Risiko durch String-Konkatenation).
