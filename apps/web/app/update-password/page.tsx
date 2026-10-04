"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ContextaLogo } from "@/components/contexta-logo";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let isMounted = true;
    const supabase = createSupabaseBrowserClient();

    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) {
        return;
      }

      if (!data.session) {
        setMessage({ type: "error", text: "Password reset session was not found. Request a new reset link." });
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
      setMessage({ type: "error", text: "Use at least 8 characters for your new password." });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Password confirmation does not match." });
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        throw error;
      }

      setMessage({ type: "success", text: "Password updated. Taking you to Contexta." });
      router.push("/");
      router.refresh();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to update password."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-md rounded-contexta border border-border bg-surface p-6 sm:p-8">
        <ContextaLogo />
        <h1 className="mt-8 font-heading text-2xl font-semibold">Create a new password</h1>
        <p className="mt-2 text-sm leading-6 text-subtle">Choose a new password for your Contexta account.</p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-ink" htmlFor="new-password">
              New password
            </label>
            <div className="relative">
              <input
                id="new-password"
                autoComplete="new-password"
                className="h-12 w-full rounded border border-border bg-background px-4 pr-16 text-sm leading-5 outline-none transition placeholder:text-subtle focus:border-primary"
                placeholder="New password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isChecking || isSubmitting}
              />
              <button
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center px-4 text-xs font-medium text-subtle hover:text-ink"
                type="button"
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-ink" htmlFor="confirm-password">
              Confirm password
            </label>
            <input
              id="confirm-password"
              autoComplete="new-password"
              className="h-12 w-full rounded border border-border bg-background px-4 text-sm leading-5 outline-none transition placeholder:text-subtle focus:border-primary"
              placeholder="Repeat new password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={isChecking || isSubmitting}
            />
          </div>
          {message ? (
            <p
              className={`rounded border px-3 py-2 text-sm leading-5 ${
                message.type === "success" ? "border-success-line bg-success-soft text-success" : "border-danger-line bg-danger-soft text-danger"
              }`}
              role={message.type === "error" ? "alert" : "status"}
            >
              {message.text}
            </p>
          ) : null}
          <Button className="h-12 w-full" disabled={isChecking || isSubmitting || Boolean(message?.type === "error" && isChecking)} type="submit">
            {isSubmitting ? "Updating..." : isChecking ? "Checking session..." : "Update password"}
          </Button>
        </form>
        <p className="mt-5 text-sm">
          <Link href="/forgot-password" className="text-primary hover:text-accent">
            Request a new reset link
          </Link>
        </p>
      </section>
    </main>
  );
}
