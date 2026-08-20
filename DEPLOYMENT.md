# Deployment (Hybrid: Vercel + cyon.ch)

cyon.ch kann keine dauerhaft laufende Node.js-App aus dem Internet
erreichbar machen (nur CLI-Nutzung von Node/npm, siehe
[cyon-Support](https://www.cyon.ch/support/a/npm)). Deshalb läuft die
App auf **Vercel** (kostenlos, für Next.js gebaut). Die **Datenbank**
läuft ebenfalls auf Vercel (**Vercel Postgres**) — cyons Datenbanken
lassen sich nur per IP-Whitelist fürs ganze Konto öffnen (betrifft dann
auch andere Projekte auf demselben cyon-Konto), Vercel Postgres braucht
das nicht. cyon wird nur noch für den **Email-Versand (SMTP)** genutzt.

## Voraussetzungen

- Ein GitHub-Repository für dieses Projekt (Vercel deployt aus Git).
- Ein Vercel-Account (kostenlos), verbunden mit GitHub.
- Bei cyon: ein Email-Postfach mit SMTP-Zugang.

## 1. Vercel-Projekt erstellen + Postgres-Datenbank hinzufügen

1. [vercel.com/new](https://vercel.com/new) → GitHub-Repo importieren.
2. Im Projekt: **Storage → Create Database → Postgres** auswählen,
   Region wählen (idealerweise nahe Europa), erstellen.
3. Vercel trägt `DATABASE_URL` (und ein paar verwandte Variablen)
   automatisch als Environment-Variable ein — das musst du nicht von
   Hand kopieren.

## 2. Restliche Environment-Variablen in Vercel setzen

Im Vercel-Projekt unter **Settings → Environment Variables** ergänzen:

| Variable | Wert |
|---|---|
| `SESSION_SECRET` | zufälliger String, z.B. `openssl rand -base64 32` |
| `ADMIN_EMAIL` | die Email-Adresse, an die Login-Codes gehen sollen |
| `SMTP_HOST` | `mail.cyon.ch` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | deine cyon-Email-Adresse |
| `SMTP_PASSWORD` | dein cyon-Postfach-Passwort |
| `SMTP_FROM` | Absenderadresse (muss zur cyon-Domain gehören) |

## 3. Migrationen anwenden

Die von Vercel erzeugte `DATABASE_URL` aus Schritt 1 lokal kopieren
(Settings → Environment Variables → `DATABASE_URL` → anzeigen), dann
einmalig vor dem ersten produktiven Einsatz (und nach jeder
Schema-Änderung):

```bash
DATABASE_URL="<die-vercel-postgres-url>" npx prisma migrate deploy
```

## 4. Deployment

Jeder Push auf `main` löst automatisch ein neues Vercel-Deployment aus.
Die App ist danach unter der `*.vercel.app`-URL erreichbar
(öffentliche Pairing-Ansicht direkt auf `/`, Organisator-Bereich unter
`/admin`).

Für eine eigene Domain: in Vercel unter **Settings → Domains**
hinzufügen und beim Domain-Registrar die von Vercel angegebenen
DNS-Einträge setzen.

## Updates einspielen

Jeder Push auf `main` deployt automatisch neu. Bei Schema-Änderungen
vorher wie in Schritt 3 `prisma migrate deploy` laufen lassen.

## Backup

Vercel Postgres erstellt automatische Backups (Details im Vercel-
Dashboard unter Storage → dein Postgres-Store → Backups). Zusätzlich
manuell exportierbar mit der `DATABASE_URL` aus Schritt 3:

```bash
pg_dump "$DATABASE_URL" > backup-$(date +%F).sql
```

## Sicherheit

- **Zugriff auf dein cyon-Konto selbst** (Kundencenter-Login) liegt
  ausserhalb dessen, was diese App absichern kann — falls cyon 2FA fürs
  Kundencenter anbietet, aktivier es dort direkt.
- Die App selbst schützt vor unautorisiertem Zugriff über die Webseite
  durch: passwortlosen Email-Login (Abschnitt 2 in SPEC.md),
  Rate-Limiting auf Login-Code-Anfragen, Sicherheits-HTTP-Header (siehe
  `next.config.ts`), und Prisma-parametrisierte Datenbankzugriffe
  (kein SQL-Injection-Risiko durch String-Konkatenation).
- Vercel Postgres ist nicht per IP eingeschränkt, aber nur mit den in
  Schritt 1 generierten, langen Zugangsdaten erreichbar — diese niemals
  ausserhalb der Vercel-Environment-Variablen speichern oder teilen.
