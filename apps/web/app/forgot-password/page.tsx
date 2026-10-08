"use client";

import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";
import { useT } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  const t = useT();

  return (
    <AuthCard
      description={t.auth.forgotPage.description}
      eyebrow={t.auth.forgotPage.eyebrow}
      title={t.auth.forgotPage.title}
    >
      <AuthForm mode="reset" />
      <p className="mt-5 text-[13px]">
        <Link href="/login" className="font-medium text-ink underline decoration-paper-edge underline-offset-4 hover:decoration-ink">
          {t.auth.forgotPage.back}
        </Link>
      </p>
    </AuthCard>
  );
}
