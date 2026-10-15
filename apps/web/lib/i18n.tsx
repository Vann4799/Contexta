"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { type Locale, localizeHref } from "@/lib/locale";
import { en, type Dictionary } from "@/locales/en";
import { id } from "@/locales/id";

// The locale URL helpers live in their own module: lib/seo.ts runs on the server to build
// metadata, and a "use client" module cannot be called from there.
export { localeOptions, localizeHref, localePath, type Locale } from "@/lib/locale";

const STORAGE_KEY = "contexta.locale";
const DEFAULT_LOCALE: Locale = "en";

const DICTIONARIES: Record<Locale, Dictionary> = { en, id };

const HTML_LANG: Record<Locale, string> = { en: "en", id: "id" };

/** Every link a public page renders, already prefixed for the language that page is written in. */
export function useHref(): (path: string) => string {
  const locale = useLocale();
  return useCallback((path: string) => localizeHref(path, locale), [locale]);
}

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

function useDetectedLocale(): Locale {
  return useSyncExternalStore(subscribe, readLocale, getServerSnapshot);
}

/**
 * A public page's locale comes from its URL, so the /id layout pins it here. Every other route
 * (the workspace, where a language picker lives in Settings) keeps following the stored or
 * detected preference.
 */
const LocaleContext = createContext<Locale | null>(null);

export function useLocale(): Locale {
  const pinned = useContext(LocaleContext);
  const detected = useDetectedLocale();
  return pinned ?? detected;
}

export function useT(): Dictionary {
  return DICTIONARIES[useLocale()];
}

// React runs a child's effect before its parent's, so without a claim the root provider would
// overwrite the language a pinned subtree just set with the visitor's stored preference.
const LANG_CLAIM = "data-locale-pinned";

export function I18nProvider({ children, locale: pinned }: { children: ReactNode; locale?: Locale }) {
  const detected = useDetectedLocale();
  const locale = pinned ?? detected;

  useEffect(() => {
    const root = document.documentElement;
    if (!pinned && root.getAttribute(LANG_CLAIM)) return;

    root.lang = HTML_LANG[locale];
    if (!pinned) return;

    root.setAttribute(LANG_CLAIM, pinned);
    return () => root.removeAttribute(LANG_CLAIM);
  }, [locale, pinned]);

  if (!pinned) return <>{children}</>;
  return <LocaleContext.Provider value={pinned}>{children}</LocaleContext.Provider>;
}
