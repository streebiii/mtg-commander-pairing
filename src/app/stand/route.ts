import { loadPublicPairings, pairingsVersion } from "@/lib/publicPairings";

// Stand der öffentlichen Pairing-Seite als kurzer Fingerabdruck. Die
// offene Seite fragt ihn ab und lädt nur neu, wenn er sich geändert hat
// (siehe AutoRefresh). Öffentlich wie die Seite selbst — der Wert verrät
// nichts, was dort nicht ohnehin steht.
export const dynamic = "force-dynamic";

export async function GET() {
  const version = pairingsVersion(await loadPublicPairings());
  return Response.json({ version }, { headers: { "Cache-Control": "no-store" } });
}
