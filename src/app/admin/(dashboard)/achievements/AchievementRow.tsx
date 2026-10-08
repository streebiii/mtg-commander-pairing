"use client";

import type { AchievementScope } from "@prisma/client";
import { useRef, useState, useTransition } from "react";
import { SCOPES, SCOPE_LABELS } from "@/lib/achievements";
import { updateAchievement } from "./actions";

interface AchievementData {
  id: string;
  title: string;
  description: string;
  points: number;
  scope: AchievementScope;
  repeatable: boolean;
  active: boolean;
}

type Fields = {
  title: string;
  description: string;
  points: string;
  scope: AchievementScope;
  repeatable: boolean;
  active: boolean;
};

/**
 * Eine Katalogzeile mit Auto-Save — Textfelder beim Verlassen, Auswahl und
 * Checkboxen sofort (siehe SPEC.md Abschnitt 6.4, gleiches Muster wie
 * PlayerRow). Die Kategorie ist nicht änderbar: sie entscheidet, ob ein
 * Achievement jeden Abend gilt oder ausgewählt wird, und ein Wechsel
 * mitten in der Saison wäre eher ein neues Achievement.
 */
export default function AchievementRow({
  achievement,
}: {
  achievement: AchievementData;
}) {
  const [fields, setFields] = useState<Fields>({
    title: achievement.title,
    description: achievement.description,
    points: String(achievement.points),
    scope: achievement.scope,
    repeatable: achievement.repeatable,
    active: achievement.active,
  });
  const [isPending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function save(overrides: Partial<Fields> = {}) {
    const next = { ...fields, ...overrides };
    const fd = new FormData();
    fd.set("id", achievement.id);
    fd.set("title", next.title);
    fd.set("description", next.description);
    fd.set("points", next.points);
    fd.set("scope", next.scope);
    fd.set("repeatable", String(next.repeatable));
    fd.set("active", String(next.active));

    startTransition(async () => {
      await updateAchievement(fd);
      setJustSaved(true);
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
      savedTimeout.current = setTimeout(() => setJustSaved(false), 1500);
    });
  }

  return (
    <tr
      className={`border-b border-white/5 align-top ${
        fields.active ? "" : "opacity-50"
      }`}
    >
      <td className="py-2 pr-3">
        <input
          type="text"
          value={fields.title}
          onChange={(e) => set("title", e.target.value)}
          onBlur={() => save()}
          aria-label="Titel"
          className="min-h-9 w-48 rounded border border-white/20 px-3 py-2"
        />
      </td>
      <td className="py-2 pr-3">
        <textarea
          value={fields.description}
          onChange={(e) => set("description", e.target.value)}
          onBlur={() => save()}
          aria-label={`Beschreibung von ${fields.title}`}
          rows={2}
          className="min-h-9 w-72 rounded border border-white/20 px-3 py-2"
        />
      </td>
      <td className="py-2 pr-3">
        <input
          type="number"
          value={fields.points}
          onChange={(e) => set("points", e.target.value)}
          onBlur={() => save()}
          aria-label={`Punkte von ${fields.title}`}
          className="min-h-9 w-16 rounded border border-white/20 px-2 py-2"
        />
      </td>
      <td className="py-2 pr-3">
        <select
          value={fields.scope}
          onChange={(e) => {
            const scope = e.target.value as AchievementScope;
            set("scope", scope);
            save({ scope });
          }}
          aria-label={`Art von ${fields.title}`}
          className="min-h-9 rounded border border-white/20 px-2 py-2"
        >
          {SCOPES.map((scope) => (
            <option key={scope} value={scope}>
              {SCOPE_LABELS[scope]}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-3">
        <label className="flex min-h-9 w-fit cursor-pointer items-center">
          <input
            type="checkbox"
            checked={fields.repeatable}
            onChange={(e) => {
              set("repeatable", e.target.checked);
              save({ repeatable: e.target.checked });
            }}
            aria-label={`${fields.title} zählt mehrfach`}
            className="h-4 w-4"
          />
        </label>
      </td>
      <td className="py-2 pr-3">
        <label className="flex min-h-9 w-fit cursor-pointer items-center">
          <input
            type="checkbox"
            checked={fields.active}
            onChange={(e) => {
              set("active", e.target.checked);
              save({ active: e.target.checked });
            }}
            aria-label={`${fields.title} aktiv`}
            className="h-4 w-4"
          />
        </label>
      </td>
      <td className="py-2 text-xs">
        <span
          className={`transition-opacity ${
            justSaved ? "opacity-100 text-green-600" : "opacity-0"
          }`}
        >
          ✓ Gespeichert
        </span>
        {isPending && !justSaved && (
          <span className="opacity-50">Speichere…</span>
        )}
      </td>
    </tr>
  );
}
