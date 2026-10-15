import { requireAdmin } from "@/lib/adminGuard";
import { leagueVersion } from "../version";

// Stand des laufenden Liga-Abends für den offenen Liga-Tab (siehe
// AutoRefresh). Nur mit Login, wie der Tab selbst.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return new Response(null, { status: 401 });
  }
  return Response.json(
    { version: await leagueVersion() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
