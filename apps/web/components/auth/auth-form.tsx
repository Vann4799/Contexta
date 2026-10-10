"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getRequiredPublicEnv } from "@/lib/env";
import { useT } from "@/lib/i18n";
import { useServerError } from "@/lib/server-errors";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

type AuthMode = "login" | "register" | "reset";

type AuthFormProps = {
  mode: AuthMode;
};

type MessageKind = "error" | "success" | "fallback";

// Server-authored text (Supabase errors) arrives as a raw string: the known messages are
// translated through the server map, unknown ones stay verbatim. Our own copy is stored as a
// key so a language switch re-translates a live message.
type AuthMessage = { type: "success" | "error"; kind: MessageKind } | { type: "error"; text: string };

export function AuthForm({ mode }: AuthFormProps) {
  const t = useT();
  const serverError = useServerError();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<AuthMessage | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === "register";
  const needsPassword = mode !== "reset";

  function messageText(entry: AuthMessage): string {
    if ("text" in entry) {
      return serverError(entry.text);
    }

    return entry.kind === "fallback" ? t.auth.fallbackError : t.auth[mode][entry.kind];
  }

  function getSafeNextPath() {
    const searchParams = new URLSearchParams(window.location.search);
    const nextPath = searchParams.get("next");
    if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
      return "/";
    }

    return nextPath;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedEmail || (needsPassword && !password) || (isRegister && !trimmedName)) {
      setMessage({ type: "error", kind: "error" });
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = getSupabaseBrowserClient();

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password
        });

        if (error) {
          throw error;
        }

        setMessage({ type: "success", kind: "success" });
        router.push(getSafeNextPath());
        router.refresh();
        return;
      }

      const redirectTo = getRequiredPublicEnv("NEXT_PUBLIC_AUTH_CALLBACK_URL");

      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: {
              full_name: trimmedName
            }
          }
        });

        if (error) {
          throw error;
        }

        setMessage({ type: "success", kind: "success" });
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo
      });

      if (error) {
        throw error;
      }

      setMessage({ type: "success", kind: "success" });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? { type: "error", text: error.message }
          : { type: "error", kind: "fallback" }
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setMessage(null);
    setIsSubmitting(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const redirectTo = getRequiredPublicEnv("NEXT_PUBLIC_AUTH_CALLBACK_URL");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo
        }
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? { type: "error", text: error.message }
          : { type: "error", kind: "fallback" }
      );
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
      {isRegister ? (
        <div className="space-y-1.5">
          <label className="eyebrow" htmlFor="register-name">
            {t.auth.fullName}
          </label>
          <input
            id="register-name"
            autoComplete="name"
            className="focus-ring h-11 w-full rounded-control border border-paper-line bg-paper-soft px-3.5 text-[13.5px] leading-5 text-ink transition placeholder:text-ink-faint focus:border-paper-edge focus:bg-paper-card"
            placeholder={t.auth.fullNamePlaceholder}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </div>
      ) : null}
      <div className="space-y-1.5">
        <label className="eyebrow" htmlFor={`${mode}-email`}>
          {mode === "login" ? t.auth.emailAddress : t.auth.email}
        </label>
        <input
          id={`${mode}-email`}
          autoComplete="email"
          className="focus-ring h-11 w-full rounded-control border border-paper-line bg-paper-soft px-3.5 text-[13.5px] leading-5 text-ink transition placeholder:text-ink-faint focus:border-paper-edge focus:bg-paper-card"
          placeholder={t.auth.emailPlaceholder}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      {needsPassword ? (
        <div className="space-y-1.5">
          <label className="eyebrow" htmlFor={`${mode}-password`}>
            {t.auth.password}
          </label>
          <div className="relative">
            <input
              id={`${mode}-password`}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="focus-ring h-11 w-full rounded-control border border-paper-line bg-paper-soft px-3.5 pr-16 text-[13.5px] leading-5 text-ink transition placeholder:text-ink-faint focus:border-paper-edge focus:bg-paper-card"
              placeholder={t.auth.passwordPlaceholder}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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
      ) : null}
      {message ? (
        <p
          className={`rounded-control px-3 py-2 text-[13px] leading-5 ${
            message.type === "success" ? "bg-success-soft text-success-ink" : "bg-danger-soft text-danger"
          }`}
          role={message.type === "error" ? "alert" : "status"}
        >
          {messageText(message)}
        </p>
      ) : null}
      <Button className="h-11 w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? t.auth.submitting : t.auth[mode].button}
      </Button>
      {mode !== "reset" ? (
        <>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-paper-line" />
            <span className="eyebrow text-[11px] text-ink-faint">{t.auth.oauth.divider}</span>
            <div className="h-px flex-1 bg-paper-line" />
          </div>
          <button
            className="focus-ring flex h-11 w-full items-center justify-center gap-2.5 rounded-control border border-paper-line bg-paper-card px-4 text-[13.5px] font-medium leading-5 text-ink transition-colors hover:bg-paper-soft disabled:opacity-60"
            disabled={isSubmitting}
            type="button"
            onClick={handleGoogleSignIn}
          >
            <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {t.auth.oauth.google}
          </button>
        </>
      ) : null}
    </form>
  );
}
