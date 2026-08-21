"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface ExistingPlayer {
  id: string;
  firstName: string;
  lastName: string | null;
}

type MatchType = "exact" | "ambiguous" | "new";

interface BaseMatch {
  importName: string;
  total: number;
  matchType: MatchType;
}
interface ExactMatch extends BaseMatch {
  matchType: "exact";
  matchedPlayerId: string;
}
interface AmbiguousMatch extends BaseMatch {
  matchType: "ambiguous";
  candidates: ExistingPlayer[];
}
interface NewMatch extends BaseMatch {
  matchType: "new";
  suggestedFirstName: string;
  suggestedLastName: string | null;
}
type Match = ExactMatch | AmbiguousMatch | NewMatch;

// Aufgelöste Entscheidung pro Zeile, editierbar durch den Organisator.
interface Resolution {
  action: "update" | "create" | "skip";
  playerId?: string;
  firstName?: string;
  lastName?: string | null;
}

function playerName(p: ExistingPlayer): string {
  return p.lastName ? `${p.firstName} ${p.lastName}` : p.firstName;
}

export default function ImportClient({
  existingPlayers,
}: {
  existingPlayers: ExistingPlayer[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function preview() {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/players/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unbekannter Fehler");
        setMatches(null);
        return;
      }
      setMatches(data.matches);
      setWarnings(data.warnings ?? []);
      setResolutions(
        (data.matches as Match[]).map((m): Resolution => {
          if (m.matchType === "exact") {
            return { action: "update", playerId: m.matchedPlayerId };
          }
          if (m.matchType === "new") {
            return {
              action: "create",
              firstName: m.suggestedFirstName,
              lastName: m.suggestedLastName,
            };
          }
          return { action: "skip" };
        }),
      );
    } catch {
      setError("Netzwerkfehler beim Parsen");
    } finally {
      setLoading(false);
    }
  }

  function updateResolution(index: number, resolution: Resolution) {
    setResolutions((prev) => prev.map((r, i) => (i === index ? resolution : r)));
  }

  async function apply() {
    if (!matches) return;
    setLoading(true);
    setError(null);
    try {
      const payload = resolutions.map((r, i) => {
        const m = matches[i];
        if (r.action === "skip") return { action: "skip" as const };
        if (r.action === "update") {
          return { action: "update" as const, playerId: r.playerId!, total: m.total };
        }
        return {
          action: "create" as const,
          firstName: r.firstName!,
          lastName: r.lastName ?? null,
          total: m.total,
        };
      });
      const res = await fetch("/api/admin/players/import/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutions: payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unbekannter Fehler");
        return;
      }
      setResult(
        `${data.updated} Spieler aktualisiert, ${data.created} neu angelegt.`,
      );
      setMatches(null);
      setText("");
      router.refresh();
    } catch {
      setError("Netzwerkfehler beim Anwenden");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex max-w-3xl flex-col gap-4 border-t border-black/10 pt-6 dark:border-white/10">
      <h2 className="text-sm font-medium">
        Rangliste aus Text importieren (Liga)
      </h2>
      <p className="text-xs opacity-70">
        Füge die Tabelle aus der Liga-Übersicht ein (Spalten &quot;Spieler&quot;
        und &quot;Total&quot; werden automatisch erkannt, egal wie viele
        Runden-Spalten es gibt). Importierte Spieler werden dabei automatisch
        als Liga-teilnehmend markiert.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="| # | Spieler | F | Total | R1 | R2 | ... |"
        className="w-full rounded border border-black/20 p-3 font-mono dark:border-white/20"
      />
      <button
        type="button"
        onClick={preview}
        disabled={!text.trim() || loading}
        className="min-h-11 w-fit rounded border border-black/20 px-4 py-2 text-sm dark:border-white/20 disabled:opacity-40"
      >
        {loading ? "Verarbeite…" : "Vorschau anzeigen"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && <p className="text-sm">{result}</p>}
      {warnings.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-amber-600">
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}

      {matches && matches.length > 0 && (
        <div className="flex flex-col gap-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left dark:border-white/10">
                <th className="py-2 pr-3">Import</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m, i) => (
                <tr key={i} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2 pr-3">{m.importName}</td>
                  <td className="py-2 pr-3">{m.total}</td>
                  <td className="py-2 pr-3">
                    {m.matchType === "exact" && (
                      <span>
                        Aktualisiert:{" "}
                        {playerName(
                          existingPlayers.find(
                            (p) => p.id === (m as ExactMatch).matchedPlayerId,
                          )!,
                        )}
                      </span>
                    )}
                    {m.matchType === "new" && (
                      <span>
                        Neu anlegen als &quot;{(m as NewMatch).suggestedFirstName}
                        {(m as NewMatch).suggestedLastName
                          ? ` ${(m as NewMatch).suggestedLastName}`
                          : ""}
                        &quot;
                      </span>
                    )}
                    {m.matchType === "ambiguous" && (
                      <select
                        value={
                          resolutions[i]?.action === "update"
                            ? resolutions[i].playerId
                            : resolutions[i]?.action === "create"
                              ? "__new__"
                              : "__skip__"
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "__skip__") {
                            updateResolution(i, { action: "skip" });
                          } else if (value === "__new__") {
                            const { first, lastToken } = (() => {
                              const tokens = m.importName.trim().split(/\s+/);
                              return {
                                first: tokens[0],
                                lastToken:
                                  tokens.length > 1
                                    ? tokens.slice(1).join(" ").replace(/\.$/, "")
                                    : null,
                              };
                            })();
                            updateResolution(i, {
                              action: "create",
                              firstName: first,
                              lastName: lastToken,
                            });
                          } else {
                            updateResolution(i, { action: "update", playerId: value });
                          }
                        }}
                        className="min-h-9 rounded border border-black/20 bg-transparent px-2 py-2 text-xs dark:border-white/20"
                      >
                        <option value="__skip__">Überspringen</option>
                        <option value="__new__">Als neuen Spieler anlegen</option>
                        {(m as AmbiguousMatch).candidates.map((c) => (
                          <option key={c.id} value={c.id}>
                            {playerName(c)} aktualisieren
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            onClick={apply}
            disabled={loading}
            className="min-h-11 w-fit rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
          >
            Import bestätigen
          </button>
        </div>
      )}
    </section>
  );
}
