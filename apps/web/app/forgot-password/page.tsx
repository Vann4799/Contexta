import Link from "next/link";
import { ContextaLogo } from "@/components/contexta-logo";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-md rounded-contexta border border-border bg-white p-6 shadow-soft sm:p-8">
        <ContextaLogo />
        <h1 className="mt-8 font-heading text-2xl font-semibold">Reset password</h1>
        <p className="mt-2 text-sm text-subtle">Enter your email and Contexta will send a reset link.</p>
        <div className="mt-6 space-y-3">
          <label className="sr-only" htmlFor="reset-email">
            Email
          </label>
          <input id="reset-email" className="h-11 w-full rounded border border-border px-3 text-sm outline-none focus:border-primary" placeholder="Email" />
          <Button className="w-full">Send reset link</Button>
        </div>
        <p className="mt-5 text-sm">
          <Link href="/login" className="text-primary hover:text-blue-700">
            Back to sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
