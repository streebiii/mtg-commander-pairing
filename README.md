# Commander Pairing League

Next.js-App zur Organisation von 4-Spieler-Commander-Pairing-Abenden
(Casual & Liga). Siehe [SPEC.md](./SPEC.md) für die vollständige
Spezifikation und [DEPLOYMENT.md](./DEPLOYMENT.md) fürs Deployment.

## Lokale Entwicklung

Voraussetzungen: Node.js 22+, Docker (für die lokale Postgres-Datenbank).

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Lokale Postgres-Datenbank starten
docker compose up -d

# 3. .env anlegen (falls noch nicht vorhanden) — siehe .env.example
cp .env.example .env
# SESSION_SECRET selbst generieren: openssl rand -base64 32

# 4. Datenbank-Schema anwenden
npx prisma migrate dev

# 5. Dev-Server starten
npm run dev
```

Die App läuft dann unter [http://localhost:3000](http://localhost:3000)
(öffentliche Pairing-Ansicht direkt auf `/`, Organisator-Bereich unter
`/admin`).

Login lokal ohne echten SMTP-Versand: `SMTP_*`-Variablen in `.env` leer
lassen, dann landet der Login-Code nur im Server-Log (nicht in einer
echten Email) — siehe Konsolen-Ausgabe beim Anfordern des Codes.

## Tests

```bash
npm test
```

## Deployment

Siehe [DEPLOYMENT.md](./DEPLOYMENT.md) — Hybrid aus Vercel (App +
Datenbank) und cyon.ch (nur Email).
