# Deployment auf dem eigenen Server

Die App läuft als einzelner Docker-Container mit Next.js + SQLite. Die
Datenbank liegt in einem Docker-Volume, damit Spieler, Abende und Verlauf
Updates und Neustarts überleben.

## Voraussetzungen auf dem Server

- Docker (inkl. Compose-Plugin: `docker compose version` sollte funktionieren)

## Erststart

1. Repository auf den Server kopieren (z.B. per `git clone` oder `scp`).
2. Im Projektordner eine `.env`-Datei anlegen (wird von `docker compose`
   automatisch eingelesen):

   ```bash
   openssl rand -base64 32  # für SESSION_SECRET
   ```

   ```env
   ADMIN_PASSWORD=dein-sicheres-passwort
   SESSION_SECRET=der-oben-generierte-zufalls-string
   ```

3. Bauen und starten:

   ```bash
   docker compose up -d --build
   ```

   Beim ersten Start führt der Container automatisch die
   Datenbank-Migrationen aus (siehe `docker-entrypoint.sh`) und erstellt die
   SQLite-Datei im Volume `pairing-data`.

4. Die App ist danach unter `http://<server-ip>:3000` erreichbar
   (Organisator-Bereich unter `/admin`, öffentliche Ansicht unter
   `/pairings`).

Für eine öffentliche Domain mit HTTPS wird ein Reverse Proxy (z.B. Caddy
oder nginx) vor den Container empfohlen — das ist bewusst nicht Teil dieses
Setups, da es von der konkreten Server-Konfiguration abhängt (siehe
SPEC.md Abschnitt 10).

## Updates einspielen

```bash
git pull
docker compose up -d --build
```

Migrationen werden beim Neustart automatisch angewendet, bestehende Daten
im Volume bleiben erhalten.

## Backup

Die komplette Datenbank liegt in einer einzigen Datei im Docker-Volume.
Sichern z.B. so:

```bash
docker compose exec app cp /data/production.db /data/backup-$(date +%F).db
docker cp $(docker compose ps -q app):/data/backup-$(date +%F).db .
```
