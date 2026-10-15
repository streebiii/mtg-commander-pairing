import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { loadPublicNames } from "@/lib/publicRoster";
import { findOpenEvening, getDeviceEntry } from "@/lib/entries";
import ClaimList from "./ClaimList";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  "kein-abend": "Gerade läuft keine Liga-Runde.",
  "nicht-am-tisch": "Dieser Name sitzt im aktuellen Match nicht an diesem Tisch.",
  "geraet-belegt":
    "Dieses Handy ist in dieser Runde schon für einen anderen Namen angemeldet.",
  "name-belegt":
    "Dieser Name ist schon auf einem anderen Handy angemeldet. Melde dich beim Organisator, er kann ihn freigeben.",
};

// Ziel der Tischkarten-QR-Codes (siehe SPEC.md Abschnitt 12). Zeigt die
// Spieler, die in der aktuellen (veröffentlichten) Runde an diesem Tisch
// sitzen; Antippen und Bestätigen meldet das Handy für diesen Namen an
// (ClaimList). Öffentlich, ohne
// Login — Schutz bieten die Beschränkung auf den Tisch, die Namenssperre
// und die Prüfung durch den Organisator.
export default async function TablePage({
  params,
  searchParams,
}: PageProps<"/tisch/[nr]">) {
  const { nr } = await params;
  const { fehler } = await searchParams;
  const tableNumber = Number.parseInt(nr, 10);
  const error = typeof fehler === "string" ? ERRORS[fehler] : undefined;

  const evening = await findOpenEvening();
  const round = evening
    ? await prisma.round.findFirst({
        where: { eveningId: evening.id, publishedAt: { not: null } },
        orderBy: { number: "desc" },
        include: {
          tables: {
            where: { tableNumber },
            include: {
              assignments: {
                include: { player: true },
                orderBy: [
                  { player: { firstName: "asc" } },
                  { player: { lastName: "asc" } },
                ],
              },
            },
          },
        },
      })
    : null;
  const table = round?.tables[0];

  const [device, entries, names] = await Promise.all([
    getDeviceEntry(),
    evening && table
      ? prisma.playerEntry.findMany({
          where: {
            eveningId: evening.id,
            playerId: { in: table.assignments.map((a) => a.playerId) },
          },
          select: { playerId: true, deviceTokenHash: true },
        })
      : [],
    loadPublicNames(),
  ]);
  const claimed = new Set(
    entries.filter((e) => e.deviceTokenHash).map((e) => e.playerId),
  );
  const deviceHere = device && evening && device.eveningId === evening.id;

  let content: React.ReactNode;
  if (!Number.isInteger(tableNumber) || tableNumber < 1) {
    content = <p className="text-base opacity-70">Diese Tischkarte ist ungültig.</p>;
  } else if (!evening) {
    content = (
      <p className="text-base opacity-70">
        Gerade läuft keine Liga-Runde. Sobald eine läuft, kannst du dich hier
        anmelden.
      </p>
    );
  } else if (!round) {
    content = (
      <p className="text-base opacity-70">
        Die Tische sind noch nicht freigegeben. Versuche es gleich nochmals.
      </p>
    );
  } else if (!table) {
    content = (
      <p className="text-base opacity-70">
        Tisch {tableNumber} ist in Match {round.number} nicht besetzt.
      </p>
    );
  } else {
    content = (
      <div className="flex flex-col gap-3">
        <p className="text-base opacity-70">
          Match {round.number} — tippe auf deinen Namen.
        </p>
        <ClaimList
          tableNumber={tableNumber}
          options={table.assignments.map((a) => ({
            playerId: a.playerId,
            name: names.get(a.playerId) ?? a.player.firstName,
            taken: claimed.has(a.playerId),
            mine: Boolean(deviceHere && device.playerId === a.playerId),
          }))}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold">Tisch {nr}</h1>
        <p className="text-base opacity-70">Achievements erfassen</p>
      </div>

      {deviceHere && (
        <Link
          href="/erfassen"
          className="flex min-h-11 items-center justify-center rounded bg-foreground px-4 py-2 text-base font-medium text-background"
        >
          Weiter als {names.get(device.playerId) ?? device.player.firstName}
        </Link>
      )}

      {error && (
        <p role="alert" className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-base text-red-300">
          {error}
        </p>
      )}

      {content}
    </div>
  );
}
