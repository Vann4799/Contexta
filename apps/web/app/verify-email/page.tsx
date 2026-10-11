"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { useT } from "@/lib/i18n";
import { getRequiredPublicEnv } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type VerifyState =
  | { status: "checking" }
  | { status: "unverified"; email: string }
  | { status: "verified" }
  | { status: "no-session" };

export default function VerifyEmailPage() {
  const t = useT();
  const router = useRouter();
  const [state, setState] = useState<VerifyState>({ status: "checking" });
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkSession = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session) {
      setState({ status: "no-session" });
      return;
    }

    if (session.user.email_confirmed_at) {
      setState({ status: "verified" });
      router.replace("/dashboard");
      return;
    }

    setState({ status: "unverified", email: session.user.email ?? "" });
  }, [router]);

  useEffect(() => {
    void checkSession();

    pollRef.current = setInterval(() => {
      void checkSession();
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [checkSession]);

  async function handleResend() {
    setResendState("sending");
    try {
      const supabase = getSupabaseBrowserClient();
      const redirectTo = getRequiredPublicEnv("NEXT_PUBLIC_AUTH_CALLBACK_URL");
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: state.status === "unverified" ? state.email : "",
        options: { emailRedirectTo: redirectTo }
      });

      if (error) throw error;
      setResendState("sent");
    } catch {
      setResendState("error");
    }
  }

  const tv = t.auth.verifyEmail;

  return (
    <AuthCard eyebrow={tv.eyebrow} title={tv.title}>
      {state.status === "checking" ? (
        <p className="mt-4 font-secondary text-[13px] leading-6 text-ink-muted">...</p>
      ) : state.status === "no-session" ? (
        <div className="mt-5 space-y-4">
          <p className="font-secondary text-[13px] leading-6 text-ink-muted">
            {tv.wrongEmail}
          </p>
          <Link
            href="/login"
            className="focus-ring block rounded-control bg-night py-3 text-center text-[13.5px] font-medium text-paper transition-colors hover:bg-night-raised"
          >
            {tv.backToLogin}
          </Link>
        </div>
      ) : state.status === "verified" ? (
        <p className="mt-4 font-secondary text-[13px] leading-6 text-ink-muted">
          {tv.verified}
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          <p className="font-secondary text-[13px] leading-6 text-ink-muted">
            {tv.description(state.email)}
          </p>

          <button
            className="focus-ring flex h-11 w-full items-center justify-center rounded-control border border-paper-line bg-paper-card text-[13.5px] font-medium text-ink transition-colors hover:bg-paper-soft disabled:opacity-60"
            disabled={resendState === "sending"}
            type="button"
            onClick={handleResend}
          >
            {resendState === "sending" ? tv.resending : tv.resend}
          </button>

          {resendState === "sent" ? (
            <p className="rounded-control bg-success-soft px-3 py-2 text-[13px] text-success-ink">
              {tv.resent}
            </p>
          ) : resendState === "error" ? (
            <p className="rounded-control bg-danger-soft px-3 py-2 text-[13px] text-danger">
              {tv.resendFailed}
            </p>
          ) : null}

          <p className="text-center text-[12px] text-ink-faint">
            <Link href="/login" className="underline underline-offset-4 hover:text-ink">
              {tv.backToLogin}
            </Link>
          </p>
        </div>
      )}
    </AuthCard>
  );
}
