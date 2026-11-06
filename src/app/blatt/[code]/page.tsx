import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadPublicNames } from "@/lib/publicRoster";
import { getDeviceEntry } from "@/lib/entries";
import { eveningLabel } from "@/lib/season";
import ClaimButton from "./ClaimButton";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  ungueltig: "Dieses Punkteblatt gilt nicht mehr.",
  "handy-belegt":
    "Dieses Handy ist heute schon für ein anderes Punkteblatt angemeldet.",
  "blatt-belegt":
    "Dieses Punkteblatt ist schon auf einem anderen Handy angemeldet. Melde dich beim Organisator, er kann es freigeben.",
};

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-8">
      <h1 className="text-xl font-semibold">{title}</h1>
      {children}
    </div>
  );
}

// Ziel des QR-Codes auf dem persönlichen Punkteblatt (SPEC.md Abschnitt
// 12.1). Öffentlich, ohne Login: der Code selbst weist das Blatt aus, er
// gilt nur für einen Abend. Ein Tippen auf «Das bin ich» meldet das Handy
// an — ein blosses Öffnen des Links (z.B. durch eine Link-Vorschau) tut
// das bewusst nicht. Wer schon angemeldet ist, landet direkt auf seinem
// Blatt.
export default async function SheetScanPage({
  params,
  searchParams,
}: PageProps<"/blatt/[code]">) {
  const { code } = await params;
  const { fehler } = await searchParams;
  const error = typeof fehler === "string" ? ERRORS[fehler] : undefined;

  const [entry, device, names] = await Promise.all([
    prisma.playerEntry.findUnique({
      where: { sheetCode: code },
      include: { evening: true, player: true },
    }),
    getDeviceEntry(),
    loadPublicNames(),
  ]);

  if (!entry) {
    return (
      <Message title="Punkteblatt">
        <p className="text-base opacity-70">
          Diesen QR-Code kennt die App nicht. Gilt dein Blatt vielleicht für
          einen anderen Abend? Melde dich beim Organisator.
        </p>
      </Message>
    );
  }
  if (entry.evening.entryClosedAt) {
    return (
      <Message title="Punkteblatt">
        <p className="text-base opacity-70">
          Die Erfassung dieses Abends ist geschlossen. Korrekturen macht der
          Organisator.
        </p>
      </Message>
    );
  }
  if (device?.id === entry.id) redirect("/erfassen");

  const name = names.get(entry.playerId) ?? entry.player.firstName;
  const day = entry.evening.date.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" });
  const otherHere = device && device.eveningId === entry.eveningId;

  return (
    <Message title={name}>
      <p className="text-base opacity-70">
        Punkteblatt · {eveningLabel(entry.evening.date)} · {day}
      </p>
      {error && (
        <p
          role="alert"
          className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-base text-red-300"
        >
          {error}
        </p>
      )}
      {entry.deviceTokenHash ? (
        <p className="text-base">
          Dieses Punkteblatt ist schon auf einem anderen Handy angemeldet.
          Melde dich beim Organisator, er kann es freigeben.
        </p>
      ) : otherHere ? (
        <p className="text-base">
          Dieses Handy ist heute schon für{" "}
          {names.get(device.playerId) ?? device.player.firstName} angemeldet.
          Scanne dein Blatt mit deinem eigenen Handy.
        </p>
      ) : (
        <>
          <p className="text-base">
            Bist du {name}? Dann meldest du dich damit für heute an und
            trägst hier deine Punkte ein.
          </p>
          <ClaimButton code={code} name={name} />
        </>
      )}
    </Message>
  );
}
