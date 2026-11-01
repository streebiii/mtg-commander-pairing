// Wendet beim Live-Deployment auf Vercel ausstehende Migrationen an, damit
// Schema und Code gemeinsam live gehen (siehe DEPLOYMENT.md). Vorschauen
// teilen sich dieselbe Datenbank, dürfen sie aber nicht verändern: dort
// tut dieses Skript nichts. Migrationen brauchen eine direkte Verbindung,
// darum die ungepoolte URL, wenn es sie gibt.

import { execFileSync } from "node:child_process";

if (process.env.VERCEL_ENV !== "production") {
  console.log("Keine Migration: kein Live-Deployment.");
  process.exit(0);
}

const url =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL;

execFileSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});
