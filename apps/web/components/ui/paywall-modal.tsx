"use client";

import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Lock, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { PlanGate } from "@/lib/use-plan-gate";

type PaywallReason = "documents" | "api_keys" | "chat_messages";

export function PaywallModal({
  open,
  onClose,
  reason,
  planGate,
}: {
  open: boolean;
  onClose: () => void;
  reason: PaywallReason;
  planGate: PlanGate;
}) {
  const t = useT();
  const router = useRouter();

  if (typeof document === "undefined") return null;

  const messages: Record<PaywallReason, { title: string; body: string }> = {
    documents: {
      title: t.paywall.documentsTitle,
      body: t.paywall.documentsBody,
    },
    api_keys: {
      title: t.paywall.apiKeysTitle,
      body: t.paywall.apiKeysBody,
    },
    chat_messages: {
      title: t.paywall.chatTitle,
      body: t.paywall.chatBody,
    },
  };

  const msg = messages[reason];
  const billing = planGate.billing;

  const usageLines: string[] = [];
  if (billing) {
    const { limits } = billing.plan;
    const { usage } = billing;
    if (reason === "documents") {
      usageLines.push(t.paywall.documentsUsage(usage.documents_count, limits.max_documents));
    } else if (reason === "api_keys") {
      usageLines.push(t.paywall.apiKeysUsage(usage.api_keys_count, limits.max_api_keys));
    } else {
      usageLines.push(t.paywall.chatUsage(usage.chat_messages_today, limits.max_chat_messages_per_day));
    }
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="paywall-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-night/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative z-10 w-full max-w-[380px] rounded-card border border-paper-line bg-paper shadow-card"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
          >
            <button
              type="button"
              onClick={onClose}
              className="focus-ring absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full text-ink-muted transition-colors hover:bg-paper-soft hover:text-ink"
              aria-label={t.paywall.close}
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>

            <div className="flex flex-col items-center gap-3 px-6 pb-6 pt-8 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100">
                <Lock className="h-6 w-6 text-amber-700" strokeWidth={2} />
              </div>

              <div>
                <p className="text-[15px] font-semibold text-ink">{msg.title}</p>
                <p className="mt-1 text-[13px] text-ink-muted">{msg.body}</p>
              </div>

              {billing && (
                <div className="w-full rounded-xl border border-paper-line bg-paper-soft px-4 py-3 text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    {t.paywall.currentPlan}
                  </p>
                  <p className="mt-0.5 text-[13px] font-semibold text-ink">{billing.plan.name}</p>
                  {usageLines.length > 0 && (
                    <>
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                        {t.paywall.usage}
                      </p>
                      {usageLines.map((line) => (
                        <p key={line} className="mt-0.5 text-[13px] text-ink">
                          {line}
                        </p>
                      ))}
                    </>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push("/billing");
                }}
                className="focus-ring mt-1 flex w-full items-center justify-center gap-1.5 rounded-control bg-night px-4 py-2 text-[13px] font-semibold text-white shadow-node transition-colors hover:bg-night/90"
              >
                {t.paywall.cta}
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
