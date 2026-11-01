"use client";

import { useFormStatus } from "react-dom";
import { PrimaryButton } from "@/components/Button";

function Button({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" className="w-full" loading={pending}>
      {pending ? "Bestätige…" : label}
    </PrimaryButton>
  );
}

/**
 * Schliesst die Übersicht des Blatts ab (SPEC.md Abschnitt 12.2): die
 * Übersicht ist selbst die Rückfrage, darum ohne weitere.
 */
export default function ConfirmButton({
  label,
  action,
}: {
  label: string;
  action: () => Promise<void>;
}) {
  return (
    <form action={action}>
      <Button label={label} />
    </form>
  );
}
