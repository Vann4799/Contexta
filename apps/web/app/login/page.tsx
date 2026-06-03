import Link from "next/link";
import { ContextaLogo } from "@/components/contexta-logo";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-md rounded-contexta border border-border bg-white p-6 shadow-soft sm:p-8">
        <ContextaLogo />
        <h1 className="mt-8 font-heading text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-subtle">Access your private document workspace.</p>
        <div className="mt-6 space-y-3">
          <label className="sr-only" htmlFor="login-email">
            Email
          </label>
          <input id="login-email" className="h-11 w-full rounded border border-border px-3 text-sm outline-none focus:border-primary" placeholder="Email" />
          <label className="sr-only" htmlFor="login-password">
            Password
          </label>
          <input id="login-password" className="h-11 w-full rounded border border-border px-3 text-sm outline-none focus:border-primary" placeholder="Password" type="password" />
          <Button className="w-full">Sign in to Contexta</Button>
        </div>
        <div className="mt-5 flex flex-col gap-2 text-sm sm:flex-row sm:justify-between">
          <Link href="/forgot-password" className="text-primary hover:text-blue-700">
            Forgot password?
          </Link>
          <Link href="/register" className="text-primary hover:text-blue-700">
            Create account
          </Link>
        </div>
      </section>
    </main>
  );
}
