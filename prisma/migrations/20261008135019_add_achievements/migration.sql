-- CreateEnum
CREATE TYPE "AchievementCategory" AS ENUM ('FIXED', 'DECKBUILDING', 'ROTATING');

-- CreateEnum
CREATE TYPE "AchievementScope" AS ENUM ('MATCH', 'EVENING', 'SEASON', 'PER_PLAYER', 'MULTIPLE');

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "category" "AchievementCategory" NOT NULL,
    "scope" "AchievementScope" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evening_achievements" (
    "id" TEXT NOT NULL,
    "eveningId" TEXT NOT NULL,
    "achievementId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "category" "AchievementCategory" NOT NULL,
    "scope" "AchievementScope" NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "evening_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "achievements_category_sortOrder_idx" ON "achievements"("category", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "evening_achievements_eveningId_achievementId_key" ON "evening_achievements"("eveningId", "achievementId");

-- AddForeignKey
ALTER TABLE "evening_achievements" ADD CONSTRAINT "evening_achievements_eveningId_fkey" FOREIGN KEY ("eveningId") REFERENCES "evenings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evening_achievements" ADD CONSTRAINT "evening_achievements_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Startdaten: Achievement-Liste von https://mtgbl.ch/liga/commander/2026/achievements
-- (Stand 08.10.2026: 6 fixe, 9 Deckbau, 76 rotierende). Fixe und Deckbau sind
-- aktiv; von den rotierenden genau die 10 der Ziehung vom 16.10.2026 — bei den
-- rotierenden heisst aktiv «gilt am nächsten Liga-Abend».
-- «+1/Spieler» und «+2/+1» haben die Art PER_PLAYER (+1 bzw. +2), alle übrigen
-- rotierenden zählen 1x pro Match, wie auf dem Punkteblatt vom 22.05.2026.
-- Danach wird der Katalog nur noch in der App gepflegt.
INSERT INTO "achievements" ("id", "title", "description", "points", "category", "scope", "active", "sortOrder") VALUES
  (gen_random_uuid()::text, 'Participation', 'Nimm an einem Liga-Match teil', 1, 'FIXED', 'MATCH', true, 1),
  (gen_random_uuid()::text, 'Winner winner – chicken dinner', 'Gewinne das Match', 1, 'FIXED', 'MATCH', true, 2),
  (gen_random_uuid()::text, 'Eliminate', 'Eliminiere einen Spieler', 1, 'FIXED', 'MATCH', true, 3),
  (gen_random_uuid()::text, 'I’ve seen this movie', 'Als erster Spieler eliminiert werden', 1, 'FIXED', 'MATCH', true, 4),
  (gen_random_uuid()::text, 'Hardcore Mode', 'Auf 5 oder weniger Karten mulliganen', 1, 'FIXED', 'MATCH', true, 5),
  (gen_random_uuid()::text, 'Alternative', 'Gewinne mit einer alternativen Win-Con. Als alternative Win-Cons zählen: Poison, Mill oder Karten mit dem Text „You win the game. (Commander Damage zählt nicht)', 2, 'FIXED', 'MATCH', true, 6),
  (gen_random_uuid()::text, 'Big Play', 'Deck enthält keine Nicht-Land-Karten mit Manawert 3 oder weniger', 3, 'DECKBUILDING', 'EVENING', true, 1),
  (gen_random_uuid()::text, 'Starting Point', 'Mit einem Commander-Precon-Deck spielen', 2, 'DECKBUILDING', 'EVENING', true, 2),
  (gen_random_uuid()::text, 'Ya Basic', 'Nutze nur Standardländer', 1, 'DECKBUILDING', 'EVENING', true, 3),
  (gen_random_uuid()::text, 'Pauper', 'Spiele mit einem Pauper Commander-Deck', 4, 'DECKBUILDING', 'EVENING', true, 4),
  (gen_random_uuid()::text, 'No Sol Ring', 'Spiele ohne Sol Ring im Deck', 1, 'DECKBUILDING', 'EVENING', true, 5),
  (gen_random_uuid()::text, 'No Creatures', 'Deck enthält ausser dem Commander keine Kreaturen', 2, 'DECKBUILDING', 'EVENING', true, 6),
  (gen_random_uuid()::text, 'No Artifacts', 'Deck enthält keine Artefakte', 1, 'DECKBUILDING', 'EVENING', true, 7),
  (gen_random_uuid()::text, 'I am speed', 'Abgesehen von Ländern und Commander können alle Karten “Instant-Speed” gespielt werden', 2, 'DECKBUILDING', 'EVENING', true, 8),
  (gen_random_uuid()::text, 'Evergreen', 'Spiele über die gesamte Liga immer dasselbe Deck', 7, 'DECKBUILDING', 'SEASON', true, 9),
  (gen_random_uuid()::text, 'Untouchable', 'Ein Spiel gewinnen, ohne jemals Schaden zu nehmen', 3, 'ROTATING', 'MATCH', false, 1),
  (gen_random_uuid()::text, 'It’s Free Real Estate', 'Mehr als 45 bleibende Karten gleichzeitig im Spiel haben', 1, 'ROTATING', 'MATCH', false, 2),
  (gen_random_uuid()::text, 'Just as Garfield Intended', 'Zehn oder mehr Kreaturen in einem einzigen Zug wirken', 1, 'ROTATING', 'MATCH', false, 3),
  (gen_random_uuid()::text, 'Smash!', 'Einem Spieler in einem einzigen Zug 100 oder mehr Schaden zufügen', 2, 'ROTATING', 'MATCH', true, 4),
  (gen_random_uuid()::text, 'The Sheriff is Near', 'Eine Kreatur vor tödlichem Schaden bewahren.', 1, 'ROTATING', 'MATCH', true, 5),
  (gen_random_uuid()::text, 'Mark of the Beast', 'Genau 6 Länder, 6 Kreaturen und 6 Nicht-Land-Nicht-Kreaturen-Permanents kontrollieren', 1, 'ROTATING', 'MATCH', false, 6),
  (gen_random_uuid()::text, 'Serial Killer', '10 oder mehr Kreaturen gleichzeitig zerstören oder ins Exil schicken.', 1, 'ROTATING', 'MATCH', true, 7),
  (gen_random_uuid()::text, 'You’re Not an Extra', 'Einen anderen Spieler vor der Eliminierung bewahren', 1, 'ROTATING', 'MATCH', false, 8),
  (gen_random_uuid()::text, 'Next in Line', 'Das niedrigste Leben haben (unter 10), wenn ein anderer Spieler eliminiert wird', 1, 'ROTATING', 'MATCH', false, 9),
  (gen_random_uuid()::text, 'It’s Good to Be the King/Queen', 'Monarch werden (2 Punkte für den ersten Spieler, danach 1 Punkt)', 2, 'ROTATING', 'PER_PLAYER', false, 10),
  (gen_random_uuid()::text, 'He’s Dead, Jim', 'Als Erster eine Kreatur eines Gegners vom Spielfeld zerstören oder verbannen', 1, 'ROTATING', 'MATCH', false, 11),
  (gen_random_uuid()::text, 'Drop the Hammer', 'Einen Nicht-Commander-Zauberspruch mit Manawert 10 oder höher casten', 1, 'ROTATING', 'MATCH', false, 12),
  (gen_random_uuid()::text, 'Heroes of the Storm', '4 Zaubersprüche in einem einzigen Zug casten', 1, 'ROTATING', 'MATCH', false, 13),
  (gen_random_uuid()::text, 'Full House', 'Gleichzeitig einen Planeswalker, ein Artefakt, eine Kreatur, eine Verzauberung und ein Nicht-Standardland kontrollieren', 3, 'ROTATING', 'MATCH', false, 14),
  (gen_random_uuid()::text, 'Straight Flush', 'Fünf Kreaturen einer Farbe mit aufeinanderfolgendem Stärke- oder Widerstandswert kontrollieren', 2, 'ROTATING', 'MATCH', false, 15),
  (gen_random_uuid()::text, 'Flush', 'Hingabe 5 oder mehr zu einer einzigen Farbe erreichen', 1, 'ROTATING', 'MATCH', false, 16),
  (gen_random_uuid()::text, 'Straight', 'Fünf Kreaturen mit aufeinanderfolgendem Stärke- oder Widerstandswert kontrollieren', 1, 'ROTATING', 'MATCH', false, 17),
  (gen_random_uuid()::text, 'Copycat', 'Als Erster den Zauberspruch oder die bleibende Karte eines anderen Spielers kopieren', 1, 'ROTATING', 'MATCH', false, 18),
  (gen_random_uuid()::text, 'With Friends Like These', 'Der Spieler sein, der die meisten Kreaturen auf dem Schlachtfeld hatte, als er starb', 1, 'ROTATING', 'MATCH', false, 19),
  (gen_random_uuid()::text, 'Necropotence', 'In einem Zug selbstverschuldet 20 oder mehr Leben verlieren', 2, 'ROTATING', 'MATCH', true, 20),
  (gen_random_uuid()::text, 'Level Up!', 'Eine Kreatur auf ihre letzte Stufe bringen', 1, 'ROTATING', 'MATCH', false, 21),
  (gen_random_uuid()::text, 'Twenty-One', 'Zwei Kreaturen kontrollieren, deren kombinierte Stärke genau 21 beträgt', 1, 'ROTATING', 'MATCH', false, 22),
  (gen_random_uuid()::text, 'Donate', 'Kontrolle über eine Kreatur, die du besitzt, an einen Gegner abgeben', 1, 'ROTATING', 'MATCH', false, 23),
  (gen_random_uuid()::text, 'Legends Rule!', 'Fünf oder mehr legendäre Kreaturen kontrollieren', 1, 'ROTATING', 'MATCH', false, 24),
  (gen_random_uuid()::text, 'Crumbling Sanctuary', 'Als erster Spieler 10 oder weniger Karten in seiner Bibliothek haben', 2, 'ROTATING', 'MATCH', true, 25),
  (gen_random_uuid()::text, 'Healing Hand', 'Lebensgewinn und Lebensverlust im selben Zug verursachen', 1, 'ROTATING', 'MATCH', false, 26),
  (gen_random_uuid()::text, 'Sharing is caring', 'Einen Gegner mit einem einzigen Zauberspruch oder einer Fähigkeit 3 oder mehr Karten ziehen lassen', 1, 'ROTATING', 'MATCH', false, 27),
  (gen_random_uuid()::text, 'Redirect Damage', 'Nicht-Kampfschaden, den du nehmen würdest, auf einen anderen Spieler umleiten', 1, 'ROTATING', 'MATCH', false, 28),
  (gen_random_uuid()::text, 'Instant Death', 'Einen Gegner während des Zuges eines anderen Gegners eliminieren', 1, 'ROTATING', 'MATCH', false, 29),
  (gen_random_uuid()::text, 'Blatant Thievery!', 'Im selben Zug von jedem Gegner eine bleibende Karte unter deine Kontrolle bringen', 1, 'ROTATING', 'MATCH', false, 30),
  (gen_random_uuid()::text, 'Stalemate', 'Das Spiel endet unentschieden mit gleicher Spieleranzahl wie zu Beginn', 1, 'ROTATING', 'MATCH', false, 31),
  (gen_random_uuid()::text, 'Sad but True', 'Einen Spieler mit einer 1/1-Kreatur eliminieren', 1, 'ROTATING', 'MATCH', false, 32),
  (gen_random_uuid()::text, 'Resource Management', 'Genau tödlichen Nicht-Commander-Schaden zufügen', 1, 'ROTATING', 'MATCH', false, 33),
  (gen_random_uuid()::text, 'Klepto', 'Eine bleibende Karte kontrollieren, die jedem Gegner gehört', 1, 'ROTATING', 'MATCH', false, 34),
  (gen_random_uuid()::text, 'Traitor', 'Einen Spieler mit einer Karte eliminieren, die ihm gehört', 1, 'ROTATING', 'MATCH', false, 35),
  (gen_random_uuid()::text, 'To Mount Doom', 'Einen Sol Ring zerstören oder verbannen', 1, 'ROTATING', 'MATCH', false, 36),
  (gen_random_uuid()::text, 'Where it Stops', 'Kontrolle über eine bleibende Karte erlangen, die weder dir noch ihrem Kontrolleur gehört', 1, 'ROTATING', 'MATCH', false, 37),
  (gen_random_uuid()::text, 'Ping Range', 'Einen Gegner auf genau 1 Leben reduzieren', 1, 'ROTATING', 'MATCH', false, 38),
  (gen_random_uuid()::text, 'Becoming the Legend', 'Ein legendäres Token generieren', 1, 'ROTATING', 'MATCH', false, 39),
  (gen_random_uuid()::text, 'Final Form', 'Eine doppelseitige bleibende Karte transformieren', 1, 'ROTATING', 'MATCH', false, 40),
  (gen_random_uuid()::text, 'Boundless Realms', '25 oder mehr Länder kontrollieren', 1, 'ROTATING', 'MATCH', true, 41),
  (gen_random_uuid()::text, 'Endurance', '60 oder mehr Leben haben', 1, 'ROTATING', 'MATCH', true, 42),
  (gen_random_uuid()::text, 'Army of the Faceless', 'Drei oder mehr verdeckte Kreaturen kontrollieren', 1, 'ROTATING', 'MATCH', false, 43),
  (gen_random_uuid()::text, 'Oops', 'Einer Kreatur durch umgeleiteten Schaden tödlichen Schaden zufügen', 1, 'ROTATING', 'MATCH', false, 44),
  (gen_random_uuid()::text, 'Burn It All', 'In einem Zug 12 oder mehr Schaden mit gezielten Zaubersprüchen oder Fähigkeiten zufügen', 1, 'ROTATING', 'MATCH', false, 45),
  (gen_random_uuid()::text, 'No', 'Vier Zaubersprüche kontern', 1, 'ROTATING', 'MATCH', false, 46),
  (gen_random_uuid()::text, 'Turn Aside', 'Eine bleibende Karte schützen, indem ein Ziel ungültig gemacht wird', 1, 'ROTATING', 'MATCH', false, 47),
  (gen_random_uuid()::text, 'Fog', 'Verhindere Schaden aus einem Angriff, der dich besiegen würde', 1, 'ROTATING', 'MATCH', true, 48),
  (gen_random_uuid()::text, 'Masochist', 'Dir selbst in einem Zug 6 oder mehr Schaden zufügen', 1, 'ROTATING', 'MATCH', false, 49),
  (gen_random_uuid()::text, 'First Blood', 'Als Erster einem Gegner Schaden zufügen', 1, 'ROTATING', 'MATCH', false, 50),
  (gen_random_uuid()::text, 'Third Times the Charm', 'Den Commander zum dritten Mal casten', 1, 'ROTATING', 'MATCH', false, 51),
  (gen_random_uuid()::text, 'Commander Classic Win', 'Einen Spieler mit 21 Commander-Schaden eliminieren', 1, 'ROTATING', 'PER_PLAYER', true, 52),
  (gen_random_uuid()::text, 'I Brought Extras', '10 Kreaturentokens kontrollieren', 1, 'ROTATING', 'MATCH', false, 53),
  (gen_random_uuid()::text, 'Cleave', 'Zwei Spieler in einem Zug eliminieren', 1, 'ROTATING', 'MATCH', false, 54),
  (gen_random_uuid()::text, 'Becoming the Archenemy', 'Mehrere Spieler in einem Zug eliminieren', 3, 'ROTATING', 'MATCH', false, 55),
  (gen_random_uuid()::text, 'Fateful Hour', 'Einen Gegner eliminieren, während du 5 oder weniger Leben hast', 1, 'ROTATING', 'MATCH', true, 56),
  (gen_random_uuid()::text, 'Close, but No Cigar', 'Das Spiel mit genau 1 Leben gewinnen', 2, 'ROTATING', 'MATCH', false, 57),
  (gen_random_uuid()::text, 'Tribal Allegiance', '7 Kreaturen desselben Typs kontrollieren', 1, 'ROTATING', 'MATCH', false, 58),
  (gen_random_uuid()::text, 'Indiana Jones', 'Fünf Artefakte kontrollieren', 1, 'ROTATING', 'MATCH', false, 59),
  (gen_random_uuid()::text, 'Sorcerer Supreme', 'Fünf Verzauberungen kontrollieren', 1, 'ROTATING', 'MATCH', false, 60),
  (gen_random_uuid()::text, 'Super Friends', 'Drei Planeswalker kontrollieren', 1, 'ROTATING', 'MATCH', false, 61),
  (gen_random_uuid()::text, 'We Got Ourselves a Killer', 'Zwei oder mehr Planeswalker zerstören', 1, 'ROTATING', 'MATCH', false, 62),
  (gen_random_uuid()::text, 'Equipped for Battle', 'Eine Kreatur mit vier Ausrüstungen ausrüsten', 1, 'ROTATING', 'MATCH', false, 63),
  (gen_random_uuid()::text, 'Enchanted for Victory', 'Vier Auren an einer Kreatur', 1, 'ROTATING', 'MATCH', false, 64),
  (gen_random_uuid()::text, 'I Am Timmy, Hear Me Roar', 'Eine Kreatur mit 20+ Stärke kontrollieren', 1, 'ROTATING', 'MATCH', false, 65),
  (gen_random_uuid()::text, 'Braingeyser', 'In einem Zug 20 oder mehr Karten ziehen', 1, 'ROTATING', 'MATCH', false, 66),
  (gen_random_uuid()::text, 'Opfer', '10 Kreaturen in einem Zug opfern', 2, 'ROTATING', 'MATCH', false, 67),
  (gen_random_uuid()::text, 'Masse', 'Mit 20 Kreaturen angreifen', 2, 'ROTATING', 'MATCH', false, 68),
  (gen_random_uuid()::text, 'Infect', '10 Poison Counter in einem Spiel verteilen', 2, 'ROTATING', 'MATCH', false, 69),
  (gen_random_uuid()::text, 'Counter', '10 Sprüche in einem Spiel kontern', 1, 'ROTATING', 'MATCH', false, 70),
  (gen_random_uuid()::text, 'Planeswalk', 'Die Ultimate-Fähigkeit eines Planeswalkers aktivieren', 3, 'ROTATING', 'MATCH', false, 71),
  (gen_random_uuid()::text, 'Copy Paste', '5 permanente Karten in einem Spiel kopieren', 2, 'ROTATING', 'MATCH', false, 72),
  (gen_random_uuid()::text, 'Figurehead', 'Das Spiel beenden, ohne dass dein Commander die Kommandozone verlässt', 1, 'ROTATING', 'MATCH', false, 73),
  (gen_random_uuid()::text, 'Follow the Script', 'Das Spiel beenden, ohne je dein Deck zu durchsuchen', 1, 'ROTATING', 'MATCH', false, 74),
  (gen_random_uuid()::text, 'C-c-c-combooo', 'Mit einer Combo aus 5 oder mehr Karten gewinnen', 2, 'ROTATING', 'MATCH', false, 75),
  (gen_random_uuid()::text, 'We’re Playing Commander, DUH', 'Das erste Mal pro Match deinen Commander spielen', 1, 'ROTATING', 'MATCH', false, 76);
