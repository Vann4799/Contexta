"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  FileUp,
  Lightbulb,
  MessageSquare,
  Sparkles
} from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { useT } from "@/lib/i18n";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const ONBOARDING_DONE_KEY = "contexta.onboarding-done";

const STEP_ICONS = [FileUp, MessageSquare, Lightbulb] as const;

export default function OnboardingPage() {
  const t = useT();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [userName, setUserName] = useState("");

  const tv = t.auth.onboarding;
  const totalSteps = 3;
  const isWelcome = step === 0;
  const isDone = step > totalSteps;

  useEffect(() => {
    async function loadUser() {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const name = data.session?.user?.user_metadata?.full_name as string | undefined;
      setUserName(name ?? "");
    }
    void loadUser();
  }, []);

  function handleNext() {
    if (step <= totalSteps) {
      setStep(step + 1);
    }
    if (step === totalSteps) {
      try {
        localStorage.setItem(ONBOARDING_DONE_KEY, "1");
      } catch {
        // ignore
      }
      router.replace("/dashboard");
    }
  }

  function handleSkip() {
    try {
      localStorage.setItem(ONBOARDING_DONE_KEY, "1");
    } catch {
      // ignore
    }
    router.replace("/dashboard");
  }

  if (isDone) {
    return null;
  }

  const stepKeys = ["upload", "chat", "explore"] as const;

  return (
    <AuthCard
      eyebrow={isWelcome ? tv.welcome.eyebrow : tv.step(step, totalSteps)}
      title={isWelcome ? tv.welcome.title(userName || "there") : tv.steps[stepKeys[step - 1]].title}
      description={isWelcome ? tv.welcome.description : tv.steps[stepKeys[step - 1]].description}
    >
      {isWelcome ? (
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-3 rounded-control border border-paper-line bg-paper-soft p-4">
            <Sparkles className="h-5 w-5 shrink-0 text-accent-deep" />
            <p className="text-[13px] text-ink-muted">
              {tv.steps.upload.description}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-control border border-paper-line bg-paper-soft p-4">
            <MessageSquare className="h-5 w-5 shrink-0 text-accent-deep" />
            <p className="text-[13px] text-ink-muted">
              {tv.steps.chat.description}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-control border border-paper-line bg-paper-soft p-4">
            <Lightbulb className="h-5 w-5 shrink-0 text-accent-deep" />
            <p className="text-[13px] text-ink-muted">
              {tv.steps.explore.description}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-card border border-paper-line bg-paper-soft">
            {(() => {
              const Icon = STEP_ICONS[step - 1];
              return <Icon className="h-7 w-7 text-ink" />;
            })()}
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={`h-1.5 w-6 rounded-full transition-colors ${
                  i < step ? "bg-accent" : "bg-paper-line"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        {!isWelcome && (
          <button
            className="focus-ring flex h-11 flex-1 items-center justify-center rounded-control border border-paper-line bg-paper-card text-[13.5px] font-medium text-ink transition-colors hover:bg-paper-soft"
            type="button"
            onClick={() => setStep(step - 1)}
          >
            Back
          </button>
        )}
        <button
          className="focus-ring flex h-11 flex-1 items-center justify-center gap-2 rounded-control bg-night text-[13.5px] font-medium text-paper transition-colors hover:bg-night-raised"
          type="button"
          onClick={handleNext}
        >
          {isWelcome ? tv.continue : step === totalSteps ? tv.finish : tv.continue}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {isWelcome && (
        <button
          className="-mt-1 w-full py-4 text-center text-[12px] text-ink-faint underline underline-offset-4 hover:text-ink"
          type="button"
          onClick={handleSkip}
        >
          {tv.welcome.skip}
        </button>
      )}
    </AuthCard>
  );
}
