"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeAlert,
  BadgeCheck,
  CalendarDays,
  Database,
  FileText,
  KeyRound,
  LogIn,
  Mail,
  MessageSquare,
  Save,
  UserRound,
  type LucideIcon
} from "lucide-react";
import { getAccountSummary, type AccountSummary } from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useLocale, useT } from "@/lib/i18n";
import { useServerError } from "@/lib/server-errors";
import type { Dictionary } from "@/locales/en";
import { Button } from "@/components/ui/button";

type ProfileCopy = Dictionary["profile"];

type ProfileRow = {
  id: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
};

type UserProfile = {
  id: string;
  email: string;
  fullName: string;
  createdAt: string | null;
  provider: string;
  emailConfirmedAt: string | null;
  profile: ProfileRow | null;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value: string | null, locale: string, copy: ProfileCopy) {
  if (!value) {
    return copy.notAvailable;
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date(value));
}

function formatRelative(value: string | null, locale: string, copy: ProfileCopy) {
  if (!value) {
    return null;
  }

  const elapsedDays = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (elapsedDays <= 0) {
    return copy.today;
  }
  if (elapsedDays === 1) {
    return copy.yesterday;
  }
  if (elapsedDays <= 30) {
    return copy.daysAgo(elapsedDays);
  }

  return formatDate(value, locale, copy);
}

function initialsFromProfile(profile: UserProfile | null) {
  const source = profile?.fullName || profile?.email?.split("@")[0] || "Contexta";
  const words = source.split(/[\s._-]+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "CT";
}

const EMAIL_SIGN_IN_PROVIDERS = ["email", "password"];

const PROVIDER_KEYS: Record<string, keyof Dictionary["profile"]["provider"]> = {
  google: "google",
  github: "github",
  magiclink: "magicLink",
  oauth: "oauth"
};

function providerLabel(provider: string, copy: ProfileCopy) {
  if (!provider) {
    return null;
  }

  const name = provider.toLowerCase();
  if (EMAIL_SIGN_IN_PROVIDERS.includes(name)) {
    return copy.provider.emailAndPassword;
  }

  const keyed = PROVIDER_KEYS[name];
  if (keyed) {
    return copy.provider[keyed];
  }

  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function profileErrorKey(error: unknown, fallbackKey: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackKey;
}

type ProfileMessage = { type: "success" | "error"; key: string };

function profileMessageText(
  message: ProfileMessage,
  copy: ProfileCopy,
  shell: Dictionary["shell"],
  serverText: (message: string | null | undefined) => string
) {
  if (message.key === "saved") {
    return copy.saved;
  }
  if (message.key === "signOutFailed") {
    return shell.signOutFailed;
  }

  return copy.errors[message.key as keyof ProfileCopy["errors"]] ?? serverText(message.key);
}

function Chip({
  icon: Icon,
  tone = "neutral",
  children
}: {
  icon: LucideIcon;
  tone?: "neutral" | "success" | "warning";
  children: ReactNode;
}) {
  const tones = {
    neutral: "border-paper-line bg-paper text-ink",
    success: "border-success-line bg-success-soft text-success-ink",
    warning: "border-warning-line bg-warning-soft text-warning"
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-chip border px-2.5 py-1 text-[11.5px] font-semibold leading-none ${tones[tone]}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.1} aria-hidden="true" />
      {children}
    </span>
  );
}

export function ProfilePanel() {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const copy = t.profile;
  const serverError = useServerError();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [message, setMessage] = useState<ProfileMessage | null>(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("id, display_name, created_at, updated_at")
        .eq("id", session.user.id)
        .maybeSingle<ProfileRow>();

      if (profileError) {
        throw profileError;
      }

      const nameFromMetadata = typeof session.user.user_metadata?.full_name === "string" ? session.user.user_metadata.full_name : "";
      const resolvedName = profileRow?.display_name || nameFromMetadata || "";
      const provider = typeof session.user.app_metadata?.provider === "string" ? session.user.app_metadata.provider : "";

      setProfile({
        id: session.user.id,
        email: session.user.email ?? "",
        fullName: resolvedName,
        createdAt: session.user.created_at ?? null,
        provider,
        emailConfirmedAt: session.user.email_confirmed_at ?? null,
        profile: profileRow ?? null
      });
      setDisplayName(resolvedName);

      setSummary(await getAccountSummary(session.access_token));
    } catch (error) {
      setSummary(null);
      setMessage({ type: "error", key: profileErrorKey(error, "loadFailed") });
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const stats = summary
    ? [
        {
          label: copy.stats.documents,
          value: summary.documents.total.toString(),
          helper: copy.stats.documentsHelper(summary.documents.by_status.ready, summary.documents.by_status.failed),
          icon: FileText
        },
        {
          label: copy.stats.chatSessions,
          value: summary.sessions.toString(),
          helper: copy.stats.questions7d(summary.activity.chats_7d),
          icon: MessageSquare
        },
        {
          label: copy.stats.indexedChunks,
          value: summary.chunks.toString(),
          helper: copy.stats.chunksHelper,
          icon: Database
        },
        {
          label: copy.stats.storageUsed,
          value: formatBytes(summary.storage_bytes),
          helper: copy.stats.storageHelper,
          icon: Save
        }
      ]
    : [];

  const activity = summary
    ? [
        { label: copy.activity.upload, count: summary.activity.uploads_7d, last: formatRelative(summary.activity.last_upload_at, locale, copy) },
        { label: copy.activity.indexing, count: summary.activity.indexed_7d, last: formatRelative(summary.activity.last_index_at, locale, copy) },
        { label: copy.activity.chat, count: summary.activity.chats_7d, last: formatRelative(summary.activity.last_chat_at, locale, copy) }
      ]
    : [];

  async function handleSaveProfile() {
    if (!profile) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const trimmedDisplayName = displayName.trim();
      const { error } = await supabase.from("profiles").upsert({
        id: profile.id,
        display_name: trimmedDisplayName || null
      });

      if (error) {
        throw error;
      }

      setProfile((currentProfile) => currentProfile ? {
        ...currentProfile,
        fullName: trimmedDisplayName,
        profile: currentProfile.profile ? {
          ...currentProfile.profile,
          display_name: trimmedDisplayName || null
        } : currentProfile.profile
      } : currentProfile);
      setMessage({ type: "success", key: "saved" });
    } catch (error) {
      setMessage({ type: "error", key: profileErrorKey(error, "saveFailed") });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      router.push("/login");
      router.refresh();
    } catch (error) {
      setMessage({ type: "error", key: profileErrorKey(error, "signOutFailed") });
    } finally {
      setIsSigningOut(false);
    }
  }

  const accountItems = [
    { label: copy.emailLabel, value: profile?.email || copy.loading, icon: Mail },
    { label: copy.userIdLabel, value: profile?.id || copy.loading, icon: KeyRound },
    { label: copy.joined, value: formatDate(profile?.createdAt ?? null, locale, copy), icon: CalendarDays }
  ];

  const signedInWith = profile ? providerLabel(profile.provider, copy) : null;
  const topDocType = summary?.top_doc_type ?? null;

  return (
    <div className="space-y-3">
      <section className="grid items-start gap-3 lg:grid-cols-12">
        <article className="rounded-card border border-paper-line bg-paper-card p-6 lg:col-span-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-card bg-night text-[17px] font-semibold text-white">
                {initialsFromProfile(profile)}
              </div>
              <div className="min-w-0">
                <p className="eyebrow">{copy.eyebrow}</p>
                <h2 className="mt-1 truncate text-[26px] font-semibold text-ink">
                  {profile?.fullName || profile?.email || copy.userFallback}
                </h2>
                <p className="mt-1 truncate text-[13px] text-ink-muted">{profile?.email || copy.loadingAccount}</p>
              </div>
            </div>
            <Button disabled={isSigningOut} onClick={handleSignOut} variant="secondary">
              {isSigningOut ? t.shell.signingOut : t.shell.signOut}
            </Button>
          </div>

          {profile ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {signedInWith ? <Chip icon={LogIn}>{signedInWith}</Chip> : null}
              {profile.emailConfirmedAt ? (
                <Chip icon={BadgeCheck} tone="success">
                  {copy.emailVerified}
                </Chip>
              ) : (
                <Chip icon={BadgeAlert} tone="warning">
                  {copy.emailNotVerified}
                </Chip>
              )}
              {topDocType ? (
                <Chip icon={FileText}>
                  {t.common.docTypes[topDocType.doc_type]} · {copy.documentCount(topDocType.documents)}
                </Chip>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-[13px] font-semibold text-ink" htmlFor="profile-display-name">
              {copy.displayName}
              <input
                className="h-10 rounded-control border border-paper-line bg-paper-card px-3 text-[13px] font-normal text-ink outline-none transition focus:border-ink"
                disabled={isLoading || isSaving}
                id="profile-display-name"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={copy.displayNamePlaceholder}
                value={displayName}
              />
            </label>
            <div className="grid gap-2 text-[13px] font-semibold text-ink">
              {copy.accountEmail}
              <div className="flex h-10 items-center rounded-control border border-paper-line bg-paper px-3 text-[13px] font-normal text-ink-muted">
                {profile?.email || copy.loading}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={isLoading || isSaving} onClick={handleSaveProfile}>
              {isSaving ? copy.saving : copy.save}
            </Button>
            <Button disabled={isLoading} onClick={() => void loadProfile()} variant="secondary">
              {copy.refresh}
            </Button>
          </div>

          {message ? (
            <p className={`mt-4 rounded-card border p-3 text-[13px] ${message.type === "success" ? "border-success-line bg-success-soft text-success-ink" : "border-danger-line bg-danger-soft text-danger"}`} role="alert">
              {profileMessageText(message, copy, t.shell, serverError)}
            </p>
          ) : null}
        </article>

        <aside className="rounded-card border border-paper-line bg-paper-card p-5 lg:col-span-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-card bg-paper-chip text-ink">
            <UserRound className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-[17px] font-semibold text-ink">{copy.accountSummary}</h3>
          <div className="mt-4 space-y-3">
            {accountItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-control border border-paper-line bg-paper p-3">
                  <div className="flex items-center gap-2 text-[11.5px] font-semibold text-ink-muted">
                    <Icon className="h-4 w-4 text-ink" strokeWidth={2.1} aria-hidden="true" />
                    {item.label}
                  </div>
                  <p className="mt-2 break-words text-[13px] font-medium text-ink">{item.value}</p>
                </div>
              );
            })}
          </div>
        </aside>
      </section>

      <section aria-busy={isLoading} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }, (_, index) => (
              <article
                aria-hidden="true"
                className="h-[112px] animate-pulse rounded-card border border-paper-line bg-paper-card"
                key={index}
              />
            ))
          : stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <article key={stat.label} className="rounded-card border border-paper-line bg-paper-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-medium text-ink-muted">{stat.label}</p>
                      <p className="nums mt-3 text-[26px] font-semibold text-ink">{stat.value}</p>
                      <p className="mt-1 text-pretty text-[11.5px] text-ink-muted">{stat.helper}</p>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-paper-chip text-ink">
                      <Icon className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
                    </div>
                  </div>
                </article>
              );
            })}
      </section>

      <section className="rounded-card border border-paper-line bg-paper-card p-6">
        <h3 className="text-[17px] font-semibold text-ink">{copy.activityTitle}</h3>

        {isLoading ? (
          <div aria-hidden="true" className="mt-4 h-[76px] animate-pulse rounded-control border border-paper-line bg-paper" />
        ) : summary ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {activity.map((item) => (
              <div key={item.label} className="rounded-control border border-paper-line bg-paper p-4">
                <p className="text-[11.5px] font-semibold text-ink-muted">{item.label}</p>
                <p className="nums mt-2 text-[24px] font-semibold text-ink">{item.count}</p>
                <p className="mt-1 text-[11.5px] text-ink-muted">
                  {item.last ? copy.lastAt(item.last) : copy.noActivity}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-[13px] text-danger">{copy.activityError}</p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-paper-line pt-4">
          <p className="text-[13px] text-ink-muted">
            {isLoading
              ? copy.keysLine.loading
              : summary
                ? copy.keysLine.summary(summary.developer.api_keys_active, summary.developer.api_requests_14d)
                : copy.keysLine.error}
          </p>
          <Link
            className="focus-ring inline-flex h-10 items-center gap-2 rounded-control px-3 text-[13.5px] font-medium text-ink transition-colors hover:bg-paper-chip"
            href="/settings/developer"
          >
            {copy.manageKeys}
            <ArrowRight className="h-4 w-4" strokeWidth={2.1} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
