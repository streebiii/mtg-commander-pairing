import type { ParsedImportRow } from "./importParser";

export interface ExistingPlayer {
  id: string;
  firstName: string;
  lastName: string | null;
}

export interface MatchCandidate {
  id: string;
  firstName: string;
  lastName: string | null;
}

export type ImportMatch =
  | {
      importName: string;
      total: number;
      matchType: "exact";
      matchedPlayerId: string;
    }
  | {
      importName: string;
      total: number;
      matchType: "ambiguous";
      candidates: MatchCandidate[];
    }
  | {
      importName: string;
      total: number;
      matchType: "new";
      suggestedFirstName: string;
      suggestedLastName: string | null;
    };

function splitImportName(importName: string): {
  first: string;
  lastToken: string | null;
} {
  const tokens = importName.trim().split(/\s+/).filter(Boolean);
  return {
    first: tokens[0] ?? importName,
    lastToken: tokens.length > 1 ? tokens.slice(1).join(" ") : null,
  };
}

function normalizeLastToken(token: string): string {
  return token.replace(/\.$/, "").trim().toLowerCase();
}

/** Prüft, ob ein bekannter Nachname zum (evtl. abgekürzten) Import-Token passt. */
function lastNameMatches(
  existingLastName: string | null,
  importLastToken: string | null,
): boolean {
  if (!importLastToken) return true; // keine Info zum Vergleichen -> kein Widerspruch
  if (!existingLastName) return true; // auf Datei nichts hinterlegt -> kein Widerspruch
  const existing = existingLastName.trim().toLowerCase();
  const imported = normalizeLastToken(importLastToken);
  if (!imported) return true;
  return (
    existing === imported ||
    existing.startsWith(imported) ||
    existing[0] === imported[0]
  );
}

/**
 * Ordnet jede Import-Zeile einem bestehenden Spieler zu (exact), lässt sie
 * bei mehreren gleich passenden Kandidaten offen (ambiguous — der
 * Organisator muss manuell wählen), oder markiert sie als neu anzulegenden
 * Spieler (new), wenn niemand mit passendem Vornamen existiert.
 */
export function matchImportRows(
  rows: ParsedImportRow[],
  players: ExistingPlayer[],
): ImportMatch[] {
  return rows.map((row) => {
    const { first, lastToken } = splitImportName(row.importName);
    const sameFirstName = players.filter(
      (p) => p.firstName.trim().toLowerCase() === first.trim().toLowerCase(),
    );

    if (sameFirstName.length === 0) {
      return {
        importName: row.importName,
        total: row.total,
        matchType: "new",
        suggestedFirstName: first,
        suggestedLastName: lastToken ? normalizeLastTokenForStorage(lastToken) : null,
      };
    }

    const narrowed = sameFirstName.filter((p) =>
      lastNameMatches(p.lastName, lastToken),
    );

    if (narrowed.length === 1) {
      return {
        importName: row.importName,
        total: row.total,
        matchType: "exact",
        matchedPlayerId: narrowed[0].id,
      };
    }

    if (sameFirstName.length === 1 && narrowed.length === 0) {
      // Einziger Kandidat mit gleichem Vornamen, aber Nachname widerspricht
      // eindeutig (z.B. bekannter Nachname "Strebel" vs. Import-Initiale
      // "K.") — vermutlich eine andere Person, trotzdem dem Organisator
      // zur Entscheidung vorlegen statt automatisch zu duplizieren.
      return {
        importName: row.importName,
        total: row.total,
        matchType: "ambiguous",
        candidates: sameFirstName,
      };
    }

    return {
      importName: row.importName,
      total: row.total,
      matchType: "ambiguous",
      candidates: narrowed.length > 0 ? narrowed : sameFirstName,
    };
  });
}

function normalizeLastTokenForStorage(token: string): string {
  return token.replace(/\.$/, "").trim();
}
