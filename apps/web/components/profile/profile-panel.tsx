"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Database, FileText, KeyRound, Mail, MessageSquare, Save, ShieldCheck, UserRound } from "lucide-react";
import { listChatSessions, listDocuments, type ChatSession, type DocumentItem } from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase";
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

function initialsFromProfile(profile: UserProfile | null) {
  const source = profile?.fullName || profile?.email?.split("@")[0] || "Contexta";
  const words = source.split(/[\s._-]+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "CT";
}

function profileErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to load profile.";
}

export function ProfilePanel() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
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

      setProfile({
        id: session.user.id,
        email: session.user.email ?? "",
        fullName: resolvedName,
        createdAt: session.user.created_at ?? null,
        profile: profileRow ?? null
      });
      setDisplayName(resolvedName);

      const [loadedDocuments, loadedSessions] = await Promise.all([
        listDocuments(session.access_token),
        listChatSessions(session.access_token)
      ]);
      setDocuments(loadedDocuments);
      setSessions(loadedSessions);
    } catch (error) {
      setMessage({ type: "error", text: profileErrorMessage(error) });
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const stats = useMemo(() => {
    const readyDocuments = documents.filter((document) => document.status === "ready").length;
    const chunks = documents.reduce((sum, document) => sum + document.chunk_count, 0);
    const storage = documents.reduce((sum, document) => sum + document.file_size, 0);

    return [
      { label: "Documents", value: documents.length.toString(), helper: `${readyDocuments} ready`, icon: FileText },
      { label: "Chat sessions", value: sessions.length.toString(), helper: "Saved conversations", icon: MessageSquare },
      { label: "Indexed chunks", value: chunks.toString(), helper: "Searchable blocks", icon: Database },
      { label: "Storage used", value: formatBytes(storage), helper: "Uploaded files", icon: Save }
    ];
  }, [documents, sessions]);

  async function handleSaveProfile() {
    if (!profile) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
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
      const supabase = createSupabaseBrowserClient();
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
    { label: "Joined", value: formatDate(profile?.createdAt ?? null), icon: CalendarDays },
    { label: "Access mode", value: "Single-user workspace", icon: ShieldCheck }
  ];

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-12">
        <article className="rounded border border-[#c3c6d7] bg-white p-6 lg:col-span-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-primary text-xl font-semibold text-white">
                {initialsFromProfile(profile)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">User Profile</p>
                <h2 className="mt-1 truncate font-heading text-3xl font-semibold text-ink">
                  {profile?.fullName || profile?.email || "Contexta user"}
                </h2>
                <p className="mt-1 truncate text-sm text-subtle">{profile?.email || "Loading account..."}</p>
              </div>
            </div>
            <Button disabled={isSigningOut} onClick={handleSignOut} variant="secondary">
              {isSigningOut ? "Signing out" : "Sign out"}
            </Button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-ink">
              Display name
              <input
                className="h-11 rounded border border-[#c3c6d7] bg-white px-3 text-sm font-normal text-ink outline-none transition focus:border-primary"
                disabled={isLoading || isSaving}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Add your display name"
                value={displayName}
              />
            </label>
            <div className="grid gap-2 text-sm font-semibold text-ink">
              Account email
              <div className="flex h-11 items-center rounded border border-[#c3c6d7] bg-[#f9f9ff] px-3 text-sm font-normal text-subtle">
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
            <p className={`mt-4 rounded border p-3 text-sm ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`} role="alert">
              {message.text}
            </p>
          ) : null}
        </article>

        <aside className="rounded border border-[#c3c6d7] bg-white p-5 lg:col-span-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#dbe1ff] text-primary">
            <UserRound className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
          </div>
          <h3 className="mt-4 font-heading text-xl font-semibold text-ink">Account Summary</h3>
          <div className="mt-4 space-y-3">
            {accountItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded border border-[#dce2f3] bg-[#f9f9ff] p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-subtle">
                    <Icon className="h-4 w-4 text-primary" strokeWidth={2.1} aria-hidden="true" />
                    {item.label}
                  </div>
                  <p className="mt-2 break-words text-sm font-medium text-ink">{item.value}</p>
                </div>
              );
            })}
          </div>
        </aside>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article key={stat.label} className="rounded border border-[#c3c6d7] bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-subtle">{stat.label}</p>
                  <p className="mt-3 font-heading text-3xl font-semibold text-ink">{isLoading ? "..." : stat.value}</p>
                  <p className="mt-1 text-xs text-subtle">{isLoading ? "Loading profile..." : stat.helper}</p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#dbe1ff] text-primary">
                  <Icon className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded border border-[#c3c6d7] bg-white p-6">
        <h3 className="font-heading text-xl font-semibold text-ink">Security & Access</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {["Email/password authentication", "Private document workspace", "Server-side API keys hidden"].map((item) => (
            <div key={item} className="flex items-center gap-3 rounded border border-[#dce2f3] bg-[#f9f9ff] px-4 py-3 text-sm text-ink">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
