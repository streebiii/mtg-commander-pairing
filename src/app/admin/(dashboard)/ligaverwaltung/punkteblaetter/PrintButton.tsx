"use client";

import { PrimaryButton } from "@/components/Button";

export default function PrintButton() {
  return (
    <PrimaryButton onClick={() => window.print()}>
      Drucken / als PDF sichern
    </PrimaryButton>
  );
}
