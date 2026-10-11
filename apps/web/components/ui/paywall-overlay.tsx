"use client";

import { useRouter } from "next/navigation";
import { ArrowUpRight, Lock } from "lucide-react";
import { useT } from "@/lib/i18n";

export function PaywallOverlay({
  reason,
  className = "",
}: {
  reason: "documents" | "api_keys" | "chat_messages";
  className?: string;
}) {
  const t = useT();
  const router = useRouter();

  const messages: Record<string, { title: string; body: string }> = {
    documents: {
      title: t.paywall?.documentsTitle ?? "Document limit reached",
      body: t.paywall?.documentsBody ?? "Upgrade to add more documents to your workspace.",
    },
    api_keys: {
      title: t.paywall?.apiKeysTitle ?? "API key limit reached",
      body: t.paywall?.apiKeysBody ?? "Upgrade to create more API keys.",
    },
    chat_messages: {
      title: t.paywall?.chatTitle ?? "Daily chat limit reached",
      body: t.paywall?.chatBody ?? "Your daily chat message limit has been reached. Upgrade for more.",
    },
  };

  const msg = messages[reason];

  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl border border-amber-200 bg-paper/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-2 text-center px-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100">
            <Lock className="h-5 w-5 text-amber-700" strokeWidth={2} />
          </div>
          <p className="text-[14px] font-semibold text-ink">{msg.title}</p>
          <p className="text-[12px] text-ink-muted max-w-[240px]">{msg.body}</p>
          <button
            type="button"
            onClick={() => router.push("/billing")}
            className="focus-ring mt-1 flex items-center gap-1.5 rounded-control bg-night px-4 py-1.5 text-[12px] font-semibold text-white shadow-node transition-colors hover:bg-night/90"
          >
            {t.paywall?.cta ?? "Upgrade plan"}
            <ArrowUpRight className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
