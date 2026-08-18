#!/bin/sh
set -e

echo "Führe ausstehende Datenbank-Migrationen aus..."
npx prisma migrate deploy

echo "Starte Server..."
exec "$@"
