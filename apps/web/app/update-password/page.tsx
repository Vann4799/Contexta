"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import type { Dictionary } from "@/locales/en";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type MessageKey = keyof Dictionary["auth"]["updatePage"];

// Our own copy is stored as a key so a language switch re-translates a live message; Supabase
// error text has no translation yet and is carried through as-is.
type UpdateMessage = { type: "success" | "error"; key: MessageKey } | { type: "error"; text: string };

export default function UpdatePasswordPage() {
  const t = useT();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<UpdateMessage | null>(null);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseBrowserClient();

    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) {
        return;
      }

      if (!data.session) {
        setMessage({ type: "error", key: "noSession" });
      }

      setIsChecking(false);
    }

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (password.length < 8) {
      setMessage({ type: "error", key: "tooShort" });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: "error", key: "mismatch" });
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        throw error;
      }

      setMessage({ type: "success", key: "updated" });
      router.push("/");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? { type: "error", text: error.message } : { type: "error", key: "failed" }
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard
      description={t.auth.updatePage.description}
      eyebrow={t.auth.updatePage.eyebrow}
      title={t.auth.updatePage.title}
    >
      <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label className="eyebrow" htmlFor="new-password">
            {t.auth.updatePage.newPassword}
          </label>
          <div className="relative">
            <input
              id="new-password"
              autoComplete="new-password"
              className="focus-ring h-11 w-full rounded-control border border-paper-line bg-paper-soft px-3.5 pr-16 text-[13.5px] leading-5 text-ink transition placeholder:text-ink-faint focus:border-paper-edge focus:bg-paper-card"
              placeholder={t.auth.updatePage.newPassword}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isChecking || isSubmitting}
            />
            <button
              aria-label={showPassword ? t.auth.hidePassword : t.auth.showPassword}
              className="absolute inset-y-0 right-0 flex items-center px-3.5 text-[12px] font-medium text-ink-faint transition-colors hover:text-ink"
              type="button"
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? t.auth.hide : t.auth.show}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="eyebrow" htmlFor="confirm-password">
            {t.auth.updatePage.confirmPassword}
          </label>
          <input
            id="confirm-password"
            autoComplete="new-password"
            className="focus-ring h-11 w-full rounded-control border border-paper-line bg-paper-soft px-3.5 text-[13.5px] leading-5 text-ink transition placeholder:text-ink-faint focus:border-paper-edge focus:bg-paper-card"
            placeholder={t.auth.updatePage.confirmPassword}
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={isChecking || isSubmitting}
          />
        </div>
        {message ? (
          <p
            className={`rounded-control px-3 py-2 text-[13px] leading-5 ${
              message.type === "success" ? "bg-success-soft text-success-ink" : "bg-danger-soft text-danger"
            }`}
            role={message.type === "error" ? "alert" : "status"}
          >
            {"key" in message ? t.auth.updatePage[message.key] : message.text}
          </p>
        ) : null}
        <Button className="h-11 w-full" disabled={isChecking || isSubmitting || Boolean(message?.type === "error" && isChecking)} type="submit">
          {isSubmitting ? t.auth.updatePage.updating : isChecking ? t.auth.updatePage.checkingSession : t.auth.updatePage.submit}
        </Button>
      </form>
      <p className="mt-5 text-[13px]">
        <Link href="/forgot-password" className="font-semibold text-ink underline-offset-4 hover:underline">
          {t.auth.updatePage.requestNew}
        </Link>
      </p>
    </AuthCard>
  );
}
