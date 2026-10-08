"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { useT } from "@/lib/i18n";
import { useServerError } from "@/lib/server-errors";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type CallbackState =
  | { status: "loading"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

function getAuthParams() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  return {
    code: searchParams.get("code") ?? hashParams.get("code"),
    accessToken: searchParams.get("access_token") ?? hashParams.get("access_token"),
    refreshToken: searchParams.get("refresh_token") ?? hashParams.get("refresh_token"),
    type: searchParams.get("type") ?? hashParams.get("type"),
    error: searchParams.get("error") ?? hashParams.get("error"),
    errorDescription: searchParams.get("error_description") ?? hashParams.get("error_description")
  };
}

export default function AuthCallbackPage() {
  const t = useT();
  const serverError = useServerError();
  const router = useRouter();
  const [callbackState, setCallbackState] = useState<CallbackState>({
    status: "loading",
    message: "checking"
  });

  useEffect(() => {
    async function handleAuthCallback() {
      try {
        const authParams = getAuthParams();

        if (authParams.error) {
          throw new Error(authParams.errorDescription ?? authParams.error);
        }

        const supabase = getSupabaseBrowserClient();

        if (authParams.code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(authParams.code);

          if (error) {
            throw error;
          }

          if (!data.session) {
            throw new Error("noSessionReturned");
          }

          if (authParams.type === "recovery") {
            router.replace("/update-password");
            return;
          }

          setCallbackState({
            status: "success",
            message: "done"
          });
          return;
        }

        if (authParams.accessToken && authParams.refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: authParams.accessToken,
            refresh_token: authParams.refreshToken
          });

          if (error) {
            throw error;
          }

          if (!data.session) {
            throw new Error("noSessionReturned");
          }

          if (authParams.type === "recovery") {
            router.replace("/update-password");
            return;
          }

          setCallbackState({
            status: "success",
            message: "done"
          });
          return;
        }

        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (!data.session) {
          const hasAuthParams = Boolean(authParams.accessToken || authParams.refreshToken);
          throw new Error(hasAuthParams ? "paramsNoSession" : "noActiveSession");
        }

        if (authParams.type === "recovery") {
          router.replace("/update-password");
          return;
        }

        setCallbackState({
          status: "success",
          message: "done"
        });
      } catch (error) {
        setCallbackState({
          status: "error",
          message: error instanceof Error ? error.message : "failed"
        });
      }
    }

    void handleAuthCallback();
  }, [router]);

  const isSuccess = callbackState.status === "success";
  const isError = callbackState.status === "error";
  const messages = t.auth.callback.messages;

  return (
    <AuthCard
      description={messages[callbackState.message as keyof typeof messages] ?? serverError(callbackState.message)}
      eyebrow={isError ? t.auth.callback.eyebrowFail : t.auth.callback.eyebrowOk}
      title={isSuccess ? t.auth.callback.titleOk : isError ? t.auth.callback.titleFail : t.auth.callback.titlePending}
    >
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          className={`focus-ring inline-flex h-10 max-w-full flex-1 items-center justify-center rounded-control px-4 text-[13.5px] font-medium leading-none transition-colors ${
            isSuccess ? "bg-night text-white shadow-node hover:bg-night-raised" : "border border-paper-line bg-paper-soft text-ink hover:bg-paper-card"
          }`}
          href="/"
        >
          {t.auth.callback.dashboard}
        </Link>
        <Link
          className="focus-ring inline-flex h-10 max-w-full flex-1 items-center justify-center rounded-control border border-paper-line bg-paper-soft px-4 text-[13.5px] font-medium leading-none text-ink transition-colors hover:bg-paper-card"
          href="/login"
        >
          {t.auth.callback.login}
        </Link>
      </div>
    </AuthCard>
  );
}
