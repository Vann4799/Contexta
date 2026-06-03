"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSignOut() {
    setIsSigningOut(true);
    setErrorMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      router.push("/login");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Sign out failed.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      <Button className="h-8 px-3" disabled={isSigningOut} onClick={handleSignOut} variant="secondary">
        {isSigningOut ? "Signing out" : "Sign out"}
      </Button>
      {errorMessage ? (
        <p className="max-w-40 text-right text-xs leading-4 text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
