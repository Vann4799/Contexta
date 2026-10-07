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
import { DOCUMENT_TYPE_LABELS, getAccountSummary, type AccountSummary } from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

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

function formatDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date(value));
}

function formatRelative(value: string | null) {
  if (!value) {
    return null;
  }

  const diffDays = Math.round((new Date(value).getTime() - Date.now()) / 86_400_000);
  if (diffDays === 0) {
    return "Today";
  }
  if (diffDays === -1) {
    return "Yesterday";
  }
  if (diffDays < 0) {
    return `${Math.abs(diffDays)} days ago`;
  }

  return formatDate(value);
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function initialsFromProfile(profile: UserProfile | null) {
  const source = profile?.fullName || profile?.email?.split("@")[0] || "Contexta";
  const words = source.split(/[\s._-]+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "CT";
}

const EMAIL_PASSWORD_LABEL = "Email & password";

const PROVIDER_LABELS: Record<string, string> = {
  email: EMAIL_PASSWORD_LABEL,
  password: EMAIL_PASSWORD_LABEL,
  google: "Google",
  github: "GitHub",
  magiclink: "Magic link",
  oauth: "OAuth"
};

function providerLabel(provider: string) {
  if (!provider) {
    return null;
  }

  const keyed = PROVIDER_LABELS[provider.toLowerCase()];
  if (keyed) {
    return keyed;
  }

  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function profileErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to load profile.";
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
      setMessage({ type: "error", text: profileErrorMessage(error) });
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
          label: "Documents",
          value: summary.documents.total.toString(),
          helper: `${summary.documents.by_status.ready} ready, ${summary.documents.by_status.failed} failed`,
          icon: FileText
        },
        {
          label: "Chat sessions",
          value: summary.sessions.toString(),
          helper: `${plural(summary.activity.chats_7d, "question")} in the last 7 days`,
          icon: MessageSquare
        },
        {
          label: "Indexed chunks",
          value: summary.chunks.toString(),
          helper: "Searchable text blocks",
          icon: Database
        },
        {
          label: "Storage used",
          value: formatBytes(summary.storage_bytes),
          helper: "Total size of uploaded files",
          icon: Save
        }
      ]
    : [];

  const activity = summary
    ? [
        { label: "Upload", count: summary.activity.uploads_7d, last: formatRelative(summary.activity.last_upload_at) },
        { label: "Indexing", count: summary.activity.indexed_7d, last: formatRelative(summary.activity.last_index_at) },
        { label: "Chat", count: summary.activity.chats_7d, last: formatRelative(summary.activity.last_chat_at) }
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
      setMessage({ type: "success", text: "Profile updated." });
    } catch (error) {
      setMessage({ type: "error", text: profileErrorMessage(error) });
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
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Sign out failed." });
    } finally {
      setIsSigningOut(false);
    }
  }

  const accountItems = [
    { label: "Email address", value: profile?.email || "Loading...", icon: Mail },
    { label: "User ID", value: profile?.id || "Loading...", icon: KeyRound },
    { label: "Joined", value: formatDate(profile?.createdAt ?? null), icon: CalendarDays }
  ];

  const signedInWith = profile ? providerLabel(profile.provider) : null;
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
                <p className="eyebrow">User Profile</p>
                <h2 className="mt-1 truncate text-[26px] font-semibold text-ink">
                  {profile?.fullName || profile?.email || "Contexta user"}
                </h2>
                <p className="mt-1 truncate text-[13px] text-ink-muted">{profile?.email || "Loading account..."}</p>
              </div>
            </div>
            <Button disabled={isSigningOut} onClick={handleSignOut} variant="secondary">
              {isSigningOut ? "Signing out" : "Sign out"}
            </Button>
          </div>

          {profile ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {signedInWith ? <Chip icon={LogIn}>{signedInWith}</Chip> : null}
              {profile.emailConfirmedAt ? (
                <Chip icon={BadgeCheck} tone="success">
                  Email verified
                </Chip>
              ) : (
                <Chip icon={BadgeAlert} tone="warning">
                  Email not verified
                </Chip>
              )}
              {topDocType ? (
                <Chip icon={FileText}>
                  {DOCUMENT_TYPE_LABELS[topDocType.doc_type]} · {plural(topDocType.documents, "document")}
                </Chip>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-[13px] font-semibold text-ink" htmlFor="profile-display-name">
              Display name
              <input
                className="h-10 rounded-control border border-paper-line bg-paper-card px-3 text-[13px] font-normal text-ink outline-none transition focus:border-ink"
                disabled={isLoading || isSaving}
                id="profile-display-name"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Add your display name"
                value={displayName}
              />
            </label>
            <div className="grid gap-2 text-[13px] font-semibold text-ink">
              Account email
              <div className="flex h-10 items-center rounded-control border border-paper-line bg-paper px-3 text-[13px] font-normal text-ink-muted">
                {profile?.email || "Loading..."}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={isLoading || isSaving} onClick={handleSaveProfile}>
              {isSaving ? "Saving" : "Save profile"}
            </Button>
            <Button disabled={isLoading} onClick={() => void loadProfile()} variant="secondary">
              Refresh
            </Button>
          </div>

          {message ? (
            <p className={`mt-4 rounded-card border p-3 text-[13px] ${message.type === "success" ? "border-success-line bg-success-soft text-success-ink" : "border-danger-line bg-danger-soft text-danger"}`} role="alert">
              {message.text}
            </p>
          ) : null}
        </article>

        <aside className="rounded-card border border-paper-line bg-paper-card p-5 lg:col-span-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-card bg-paper-chip text-ink">
            <UserRound className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-[17px] font-semibold text-ink">Account Summary</h3>
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
        <h3 className="text-[17px] font-semibold text-ink">Activity in the last 7 days</h3>

        {isLoading ? (
          <div aria-hidden="true" className="mt-4 h-[76px] animate-pulse rounded-control border border-paper-line bg-paper" />
        ) : summary ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {activity.map((item) => (
              <div key={item.label} className="rounded-control border border-paper-line bg-paper p-4">
                <p className="text-[11.5px] font-semibold text-ink-muted">{item.label}</p>
                <p className="nums mt-2 text-[24px] font-semibold text-ink">{item.count}</p>
                <p className="mt-1 text-[11.5px] text-ink-muted">
                  {item.last ? `Last: ${item.last}` : "No activity in this window"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-[13px] text-danger">Activity numbers could not be loaded. Try Refresh.</p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-paper-line pt-4">
          <p className="text-[13px] text-ink-muted">
            {isLoading
              ? "Loading API keys..."
              : summary
                ? `${plural(summary.developer.api_keys_active, "active key")} · ${summary.developer.api_requests_14d} requests in the last 14 days`
                : "API key usage could not be loaded."}
          </p>
          <Link
            className="focus-ring inline-flex h-10 items-center gap-2 rounded-control px-3 text-[13.5px] font-medium text-ink transition-colors hover:bg-paper-chip"
            href="/settings/developer"
          >
            Manage API keys
            <ArrowRight className="h-4 w-4" strokeWidth={2.1} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
