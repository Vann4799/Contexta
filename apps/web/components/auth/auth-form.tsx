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
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === "register";
  const needsPassword = mode !== "reset";

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
        router.push("/");
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
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      {isRegister ? (
        <div className="space-y-2">
          <label className="text-sm font-medium text-ink" htmlFor="register-name">
            Full name
          </label>
          <input
            id="register-name"
            autoComplete="name"
            className="h-12 w-full rounded border border-[#c8cfdf] bg-white px-4 text-sm leading-5 outline-none transition placeholder:text-subtle focus:border-primary"
            placeholder="Your name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </div>
      ) : null}
      <div className="space-y-2">
        <label className="text-sm font-medium text-ink" htmlFor={`${mode}-email`}>
          {mode === "login" ? "Email address" : "Email"}
        </label>
        <input
          id={`${mode}-email`}
          autoComplete="email"
          className="h-12 w-full rounded border border-[#c8cfdf] bg-white px-4 text-sm leading-5 outline-none transition placeholder:text-subtle focus:border-primary"
          placeholder="you@company.com"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      {needsPassword ? (
        <div className="space-y-2">
          <label className="text-sm font-medium text-ink" htmlFor={`${mode}-password`}>
            Password
          </label>
          <input
            id={`${mode}-password`}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="h-12 w-full rounded border border-[#c8cfdf] bg-white px-4 text-sm leading-5 outline-none transition placeholder:text-subtle focus:border-primary"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
      ) : null}
      {message ? (
        <p
          className={`rounded border px-3 py-2 text-sm leading-5 ${
            message.type === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"
          }`}
          role={message.type === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      ) : null}
      <Button className="h-12 w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Working..." : copy[mode].button}
      </Button>
    </form>
  );
}
