"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase";

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
    const supabase = getSupabaseBrowserClient();

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
      const supabase = getSupabaseBrowserClient();
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
    <AuthCard
      description="Choose a new password for your Contexta account."
      eyebrow="Account security"
      title="Create a new password"
    >
      <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label className="eyebrow" htmlFor="new-password">
            New password
          </label>
          <div className="relative">
            <input
              id="new-password"
              autoComplete="new-password"
              className="focus-ring h-11 w-full rounded-control border border-paper-line bg-paper-soft px-3.5 pr-16 text-[13.5px] leading-5 text-ink transition placeholder:text-ink-faint focus:border-paper-edge focus:bg-paper-card"
              placeholder="New password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isChecking || isSubmitting}
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
        <div className="space-y-1.5">
          <label className="eyebrow" htmlFor="confirm-password">
            Confirm password
          </label>
          <input
            id="confirm-password"
            autoComplete="new-password"
            className="focus-ring h-11 w-full rounded-control border border-paper-line bg-paper-soft px-3.5 text-[13.5px] leading-5 text-ink transition placeholder:text-ink-faint focus:border-paper-edge focus:bg-paper-card"
            placeholder="Repeat new password"
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
            {message.text}
          </p>
        ) : null}
        <Button className="h-11 w-full" disabled={isChecking || isSubmitting || Boolean(message?.type === "error" && isChecking)} type="submit">
          {isSubmitting ? "Updating..." : isChecking ? "Checking session..." : "Update password"}
        </Button>
      </form>
      <p className="mt-5 text-[13px]">
        <Link href="/forgot-password" className="font-semibold text-ink underline-offset-4 hover:underline">
          Request a new reset link
        </Link>
      </p>
    </AuthCard>
  );
}
