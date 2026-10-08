"use client";

import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";
import { useT } from "@/lib/i18n";

export default function RegisterPage() {
  const t = useT();

  return (
    <AuthCard eyebrow={t.auth.registerPage.eyebrow} title={t.auth.registerPage.title}>
      <AuthForm mode="register" />
      <p className="mt-5 text-[13px] text-ink-muted">
        {t.auth.registerPage.hasAccount}{" "}
        <Link href="/login" className="font-semibold text-ink underline-offset-4 hover:underline">
          {t.auth.registerPage.signIn}
        </Link>
      </p>
    </AuthCard>
  );
}
