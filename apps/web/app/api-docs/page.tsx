"use client";

import { AppShell } from "@/components/app-shell";
import { ApiReference } from "@/components/docs/api-reference";

export default function ApiDocsPage() {
  return (
    <AppShell>
      <ApiReference />
    </AppShell>
  );
}
