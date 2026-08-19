/** Baut den Anzeigenamen eines Spielers aus Vor- und (optionalem) Nachnamen. */
export function formatPlayerName(player: {
  firstName: string;
  lastName?: string | null;
}): string {
  return player.lastName
    ? `${player.firstName} ${player.lastName}`
    : player.firstName;
}
