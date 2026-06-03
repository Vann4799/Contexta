import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { ContextaLogo } from "@/components/contexta-logo";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-md rounded-contexta border border-border bg-white p-6 shadow-soft sm:p-8">
        <ContextaLogo />
        <h1 className="mt-8 font-heading text-2xl font-semibold">Reset password</h1>
        <p className="mt-2 text-sm text-subtle">Enter your email and Contexta will send a reset link.</p>
        <AuthForm mode="reset" />
        <p className="mt-5 text-sm">
          <Link href="/login" className="text-primary hover:text-blue-700">
            Back to sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
