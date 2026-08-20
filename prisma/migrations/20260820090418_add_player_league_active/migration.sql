-- AlterTable
-- Bestehende Spieler werden mit true angelegt (nichts verschwindet
-- unerwartet aus der Liga-Auswahl), der Default wird danach auf false
-- umgestellt, damit ab jetzt neu angelegte Spieler manuell im Liga-Tab
-- aktiviert werden müssen.
ALTER TABLE "players" ADD COLUMN     "leagueActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "players" ALTER COLUMN "leagueActive" SET DEFAULT false;
