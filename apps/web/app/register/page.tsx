import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { ContextaLogo } from "@/components/contexta-logo";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-md rounded-contexta border border-border bg-surface p-6 sm:p-8">
        <ContextaLogo />
        <h1 className="mt-8 font-heading text-2xl font-semibold">Create account</h1>
        <AuthForm mode="register" />
        <p className="mt-5 text-sm text-subtle">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:text-accent">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
