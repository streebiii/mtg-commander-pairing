import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPlayerName } from "@/lib/players";
import { findOpenEvening, getDeviceEntry } from "@/lib/entries";
import { claimPlayer } from "./actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  "kein-abend": "Gerade läuft kein Liga-Abend.",
  "nicht-am-tisch": "Dieser Name sitzt in der aktuellen Runde nicht an diesem Tisch.",
  "geraet-belegt":
    "Dieses Handy ist an diesem Abend schon für einen anderen Namen angemeldet.",
  "name-belegt":
    "Dieser Name ist schon auf einem anderen Handy angemeldet. Melde dich beim Organisator, er kann ihn freigeben.",
};

// Ziel der Tischkarten-QR-Codes (siehe SPEC.md Abschnitt 12). Zeigt die
// Spieler, die in der aktuellen (veröffentlichten) Runde an diesem Tisch
// sitzen; Antippen meldet das Handy für diesen Namen an. Öffentlich, ohne
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

  const [device, entries] = await Promise.all([
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
  ]);
  const claimed = new Set(
    entries.filter((e) => e.deviceTokenHash).map((e) => e.playerId),
  );
  const deviceHere = device && evening && device.eveningId === evening.id;

  let content: React.ReactNode;
  if (!Number.isInteger(tableNumber) || tableNumber < 1) {
    content = <p className="text-sm opacity-70">Diese Tischkarte ist ungültig.</p>;
  } else if (!evening) {
    content = (
      <p className="text-sm opacity-70">
        Gerade läuft kein Liga-Abend. Sobald einer läuft, kannst du dich hier
        anmelden.
      </p>
    );
  } else if (!round) {
    content = (
      <p className="text-sm opacity-70">
        Die Tische sind noch nicht freigegeben. Versuche es gleich nochmals.
      </p>
    );
  } else if (!table) {
    content = (
      <p className="text-sm opacity-70">
        Tisch {tableNumber} ist in Runde {round.number} nicht besetzt.
      </p>
    );
  } else {
    content = (
      <div className="flex flex-col gap-3">
        <p className="text-sm opacity-70">
          Runde {round.number}. Tippe auf deinen Namen, um deine Achievements
          zu erfassen.
        </p>
        <ul className="flex flex-col gap-2">
          {table.assignments.map((a) => {
            const taken = claimed.has(a.playerId);
            const mine = deviceHere && device.playerId === a.playerId;
            return (
              <li key={a.id}>
                <form action={claimPlayer.bind(null, tableNumber, a.playerId)}>
                  <button
                    type="submit"
                    disabled={taken && !mine}
                    className="flex min-h-14 w-full items-center justify-between gap-3 rounded border border-white/20 px-4 py-3 text-left text-base transition-colors hover:bg-white/5 active:bg-white/10 disabled:opacity-40"
                  >
                    <span className="font-medium">{formatPlayerName(a.player)}</span>
                    <span className="text-xs opacity-70">
                      {mine ? "du" : taken ? "angemeldet" : ""}
                    </span>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold">Tisch {nr}</h1>
        <p className="text-sm opacity-70">Achievements erfassen</p>
      </div>

      {deviceHere && (
        <Link
          href="/erfassen"
          className="flex min-h-11 items-center justify-center rounded bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Weiter als {formatPlayerName(device.player)}
        </Link>
      )}

      {error && (
        <p role="alert" className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {content}
    </div>
  );
}
