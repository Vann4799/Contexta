"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getRequiredPublicEnv } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

type AuthMode = "login" | "register" | "reset";

type AuthFormProps = {
  mode: AuthMode;
};

const copy = {
  login: {
    button: "Sign in to Contexta",
    error: "Enter your email and password.",
    success: "Signed in. Taking you to your dashboard."
  },
  register: {
    button: "Create Contexta account",
    error: "Enter your name, email, and password.",
    success: "Account created. Check your email to confirm your account."
  },
  reset: {
    button: "Send reset link",
    error: "Enter your email.",
    success: "Password reset link sent. Check your inbox."
  }
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === "register";
  const needsPassword = mode !== "reset";

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
      setMessage({ type: "error", text: copy[mode].error });
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password
        });

        if (error) {
          throw error;
        }

        setMessage({ type: "success", text: copy.login.success });
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

        setMessage({ type: "success", text: copy.register.success });
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo
      });

      if (error) {
        throw error;
      }

      setMessage({ type: "success", text: copy.reset.success });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Something went wrong. Please try again."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
      {isRegister ? (
        <div className="space-y-1.5">
          <label className="eyebrow" htmlFor="register-name">
            Full name
          </label>
          <input
            id="register-name"
            autoComplete="name"
            className="focus-ring h-11 w-full rounded-control border border-paper-line bg-paper-soft px-3.5 text-[13.5px] leading-5 text-ink transition placeholder:text-ink-faint focus:border-paper-edge focus:bg-paper-card"
            placeholder="Your name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </div>
      ) : null}
      <div className="space-y-1.5">
        <label className="eyebrow" htmlFor={`${mode}-email`}>
          {mode === "login" ? "Email address" : "Email"}
        </label>
        <input
          id={`${mode}-email`}
          autoComplete="email"
          className="focus-ring h-11 w-full rounded-control border border-paper-line bg-paper-soft px-3.5 text-[13.5px] leading-5 text-ink transition placeholder:text-ink-faint focus:border-paper-edge focus:bg-paper-card"
          placeholder="you@company.com"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      {needsPassword ? (
        <div className="space-y-1.5">
          <label className="eyebrow" htmlFor={`${mode}-password`}>
            Password
          </label>
          <div className="relative">
            <input
              id={`${mode}-password`}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="focus-ring h-11 w-full rounded-control border border-paper-line bg-paper-soft px-3.5 pr-16 text-[13.5px] leading-5 text-ink transition placeholder:text-ink-faint focus:border-paper-edge focus:bg-paper-card"
              placeholder="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex items-center px-3.5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint transition-colors hover:text-ink"
              type="button"
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? "Hide" : "Show"}
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
          {message.text}
        </p>
      ) : null}
      <Button className="h-11 w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Working..." : copy[mode].button}
      </Button>
    </form>
  );
}
