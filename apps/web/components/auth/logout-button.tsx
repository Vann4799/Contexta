"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const t = useT();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    setHasFailed(false);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      router.push("/login");
      router.refresh();
    } catch {
      setHasFailed(true);
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      <Button className="h-8 px-3" disabled={isSigningOut} onClick={handleSignOut} variant="secondary">
        {isSigningOut ? t.shell.signingOut : t.shell.signOut}
      </Button>
      {hasFailed ? (
        <p className="max-w-40 text-right text-xs leading-4 text-danger" role="alert">
          {t.shell.signOutFailed}
        </p>
      ) : null}
    </div>
  );
}
