import Link from "next/link";
import { ContextaLogo } from "@/components/contexta-logo";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-md rounded-contexta border border-border bg-white p-6 shadow-soft sm:p-8">
        <ContextaLogo />
        <h1 className="mt-8 font-heading text-2xl font-semibold">Create account</h1>
        <div className="mt-6 space-y-3">
          <label className="sr-only" htmlFor="register-name">
            Full name
          </label>
          <input id="register-name" className="h-11 w-full rounded border border-border px-3 text-sm outline-none focus:border-primary" placeholder="Full name" />
          <label className="sr-only" htmlFor="register-email">
            Email
          </label>
          <input id="register-email" className="h-11 w-full rounded border border-border px-3 text-sm outline-none focus:border-primary" placeholder="Email" />
          <label className="sr-only" htmlFor="register-password">
            Password
          </label>
          <input id="register-password" className="h-11 w-full rounded border border-border px-3 text-sm outline-none focus:border-primary" placeholder="Password" type="password" />
          <Button className="w-full">Create Contexta account</Button>
        </div>
        <p className="mt-5 text-sm text-subtle">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:text-blue-700">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
