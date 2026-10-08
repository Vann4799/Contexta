"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { en, type Dictionary } from "@/locales/en";
import { id } from "@/locales/id";

export type Locale = "en" | "id";

const STORAGE_KEY = "contexta.locale";
const DEFAULT_LOCALE: Locale = "en";

const DICTIONARIES: Record<Locale, Dictionary> = { en, id };

// Language names stay in their own language, which is the convention for a language
// picker: a user who cannot read "Bahasa Indonesia" is the one who needs it spelled out.
export const localeOptions: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "id", label: "Bahasa Indonesia" }
];

const HTML_LANG: Record<Locale, string> = { en: "en", id: "id" };

let cached: Locale | null = null;
const listeners = new Set<() => void>();

function isStoredLocale(value: string | null): value is Locale {
  return value === "en" || value === "id";
}

function detectFallback(): Locale {
  const browserLanguage = (navigator.language ?? "").toLowerCase();
  return browserLanguage.startsWith("id") ? "id" : DEFAULT_LOCALE;
}

function readLocale(): Locale {
  if (cached) {
    return cached;
  }

  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    stored = null;
  }

  cached = isStoredLocale(stored) ? stored : detectFallback();
  return cached;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setLocale(next: Locale) {
  cached = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // A private window or blocked storage only costs persistence, not the choice itself.
  }
  listeners.forEach((listener) => listener());
}

// The server snapshot pins the first client render to the server's markup, so a stored
// Indonesian preference arrives as a re-render after hydration instead of a mismatch.
function getServerSnapshot(): Locale {
  return DEFAULT_LOCALE;
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, readLocale, getServerSnapshot);
}

export function useT(): Dictionary {
  return DICTIONARIES[useLocale()];
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();

  useEffect(() => {
    document.documentElement.lang = HTML_LANG[locale];
  }, [locale]);

  return <>{children}</>;
}
