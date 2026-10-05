import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";

export default function RegisterPage() {
  return (
    <AuthCard eyebrow="Get access" title="Create account">
      <AuthForm mode="register" />
      <p className="mt-5 text-[13px] text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-ink underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
