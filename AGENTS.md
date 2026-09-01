<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Was committet wird — und was nicht

**Dieses Repository ist öffentlich.** Jeder Push veröffentlicht, und die
Historie bleibt abrufbar, auch wenn eine Datei später gelöscht wird.

- **Niemals `git add -A` oder `git add .`.** Stattdessen gezielt die
  Dateien stagen, die zur bearbeiteten Aufgabe gehören. Genau so sind
  einmal drei private Arbeitsdokumente ungefragt im öffentlichen Repo
  gelandet.
- **Vor jedem Commit `git status` lesen** und prüfen, ob wirklich nur
  Erwartetes dabei ist. Taucht eine Datei auf, die nicht zur Aufgabe
  gehört, wird sie nicht mitgenommen — auch nicht „der Ordnung halber".
- **Dateien, die der Nutzer lokal ablegt, sind Arbeitsmaterial, kein
  Repo-Inhalt.** Unterlagen, Exporte, Screenshots, Notizen: zum Lesen
  gedacht, nicht zum Veröffentlichen. Wenn so etwas ins Repo soll, fragt
  der Nutzer danach — sonst wird es ignoriert oder in `.gitignore`
  aufgenommen.
- **Zugangsdaten, Tokens und Infrastruktur-Details gehören nirgends
  hinein**, auch nicht in Dokumentation oder Kommentare.
- Im Zweifel **fragen, bevor gepusht wird**. Ein Push lässt sich nicht
  zurücknehmen: `git rm` entfernt eine Datei nur aus dem aktuellen Stand,
  in den alten Commits bleibt sie lesbar.
