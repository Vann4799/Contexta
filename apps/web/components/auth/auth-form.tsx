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
    </form>
  );
}
