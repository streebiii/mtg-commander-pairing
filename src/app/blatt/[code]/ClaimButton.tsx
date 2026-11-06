"use client";

import { useTransition } from "react";
import { PrimaryButton } from "@/components/Button";
import { claimSheet } from "./actions";

/** «Ja, ich bin Anna S.» — meldet das Handy für das Blatt an. */
export default function ClaimButton({ code, name }: { code: string; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <PrimaryButton
      className="w-full"
      loading={pending}
      onClick={() => startTransition(() => claimSheet(code))}
    >
      {pending ? "Melde an…" : `Ja, ich bin ${name}`}
    </PrimaryButton>
  );
}
