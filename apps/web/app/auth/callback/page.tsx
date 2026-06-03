import Link from "next/link";
import { ContextaLogo } from "@/components/contexta-logo";
import { Button } from "@/components/ui/button";

export default function AuthCallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-md rounded-contexta border border-border bg-white p-6 shadow-soft sm:p-8">
        <ContextaLogo />
        <h1 className="mt-8 font-heading text-2xl font-semibold">Account confirmed</h1>
        <p className="mt-2 text-sm leading-6 text-subtle">Your Contexta account is ready. Continue to your dashboard to start working with documents.</p>
        <Link href="/" className="mt-6 block">
          <Button className="h-11 w-full">Go to dashboard</Button>
        </Link>
      </section>
    </main>
  );
}
