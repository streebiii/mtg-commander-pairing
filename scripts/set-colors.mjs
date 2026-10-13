// Startet set-colors.ts mit TypeScript-Unterstützung und dem Pfad-Alias
// «@/» aus tsconfig.json — so nutzt das Skript dieselben Regeln wie die App.
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  alias: { "@/": fileURLToPath(new URL("../src/", import.meta.url)) },
});
await jiti.import("./set-colors.ts");
