"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ContextaLogo } from "@/components/contexta-logo";
import { createSupabaseBrowserClient } from "@/lib/supabase";

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
  const router = useRouter();
  const [callbackState, setCallbackState] = useState<CallbackState>({
    status: "loading",
    message: "Checking your Contexta sign-in session."
  });

  useEffect(() => {
    async function handleAuthCallback() {
      try {
        const authParams = getAuthParams();

        if (authParams.error) {
          throw new Error(authParams.errorDescription ?? authParams.error);
        }

        const supabase = createSupabaseBrowserClient();

        if (authParams.code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(authParams.code);

          if (error) {
            throw error;
          }

          if (!data.session) {
            throw new Error("No authenticated session was returned.");
          }

          if (authParams.type === "recovery") {
            router.replace("/update-password");
            return;
          }

          setCallbackState({
            status: "success",
            message: "Authentication complete. Continue to your dashboard."
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
            throw new Error("No authenticated session was returned.");
          }

          if (authParams.type === "recovery") {
            router.replace("/update-password");
            return;
          }

          setCallbackState({
            status: "success",
            message: "Authentication complete. Continue to your dashboard."
          });
          return;
        }

        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (!data.session) {
          const hasAuthParams = Boolean(authParams.accessToken || authParams.refreshToken);
          throw new Error(hasAuthParams ? "Auth parameters were found, but no active session is available." : "No active sign-in session was found.");
        }

        if (authParams.type === "recovery") {
          router.replace("/update-password");
          return;
        }

        setCallbackState({
          status: "success",
          message: "Authentication complete. Continue to your dashboard."
        });
      } catch (error) {
        setCallbackState({
          status: "error",
          message: error instanceof Error ? error.message : "Unable to complete authentication."
        });
      }
    }

    void handleAuthCallback();
  }, [router]);

  const isSuccess = callbackState.status === "success";
  const isError = callbackState.status === "error";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-md rounded-contexta border border-border bg-surface p-6 sm:p-8">
        <ContextaLogo />
        <h1 className="mt-8 font-heading text-2xl font-semibold">{isSuccess ? "Authentication complete" : isError ? "Authentication error" : "Completing authentication"}</h1>
        <p className="mt-2 text-sm leading-6 text-subtle">{callbackState.message}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className={`inline-flex h-11 max-w-full flex-1 items-center justify-center rounded border px-4 text-sm font-medium leading-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              isSuccess ? "border-primary bg-primary text-accent-ink hover:bg-accent-strong" : "border-border bg-surface text-ink hover:bg-muted"
            }`}
          >
            Dashboard
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 max-w-full flex-1 items-center justify-center rounded border border-border bg-surface px-4 text-sm font-medium leading-none text-ink transition hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Login
          </Link>
        </div>
      </section>
    </main>
  );
}
