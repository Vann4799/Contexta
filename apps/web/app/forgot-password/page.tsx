import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      description="Enter your email and Contexta will send a reset link."
      eyebrow="Recovery"
      title="Reset password"
    >
      <AuthForm mode="reset" />
      <p className="mt-5 text-[13px]">
        <Link href="/login" className="font-medium text-ink underline decoration-paper-edge underline-offset-4 hover:decoration-ink">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
