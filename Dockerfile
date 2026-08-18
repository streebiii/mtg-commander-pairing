# syntax=docker/dockerfile:1

# --- Stage 1: Dependencies -------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Stage 2: Build ---------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL wird für den Build nur von Prisma zum Generieren des Clients
# gebraucht (keine echte Verbindung nötig).
ENV DATABASE_URL="file:./build-placeholder.db"
RUN npx prisma generate
RUN npm run build

# --- Stage 3: Runtime --------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Läuft nicht als root.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Vollständige Production-Dependencies installieren (nicht nur den von
# Next.js "getracten" Standalone-Ausschnitt), damit die `prisma`-CLI im
# Entrypoint-Skript (Migrationen beim Start) verfügbar ist.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

# Next.js Standalone-Output überlagert obiges mit dem gebauten Server +
# dem für die Anfragebearbeitung minimal nötigen node_modules-Ausschnitt.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
RUN chown -R nextjs:nodejs /app

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Verzeichnis für die SQLite-Datenbankdatei (per Volume gemountet, siehe
# docker-compose.yml), damit Daten Container-Neustarts überleben.
RUN mkdir -p /data && chown nextjs:nodejs /data

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/data/production.db"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
