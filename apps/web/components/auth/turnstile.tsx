"use client";

import { useEffect, useRef } from "react";
import { getOptionalPublicEnv } from "@/lib/env";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

type TurnstileWidget = {
  remove: (id: string) => void;
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      theme?: "auto" | "light" | "dark";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    }
  ) => string;
};

declare global {
  interface Window {
    turnstile?: TurnstileWidget;
  }
}

let apiPromise: Promise<TurnstileWidget | null> | null = null;

// One script tag for the whole document, shared by every mount of the widget.
function loadApi(): Promise<TurnstileWidget | null> {
  if (apiPromise) {
    return apiPromise;
  }

  apiPromise = new Promise((resolve) => {
    if (window.turnstile) {
      resolve(window.turnstile);
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(window.turnstile ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });

  return apiPromise;
}

type TurnstileProps = {
  onToken: (token: string | null) => void;
  // A Turnstile token is single-use, so a rejected submit has to hand back a fresh widget
  // rather than reuse the spent one. Bumping this key remounts it.
  resetKey: number;
};

export function Turnstile({ onToken, resetKey }: TurnstileProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    const sitekey = getOptionalPublicEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
    if (!sitekey) {
      return;
    }

    let widgetId: string | undefined;
    let disposed = false;

    void loadApi().then((turnstile) => {
      const host = hostRef.current;
      if (disposed || !turnstile || !host) {
        return;
      }

      host.replaceChildren();
      widgetId = turnstile.render(host, {
        sitekey,
        theme: "light",
        callback: (token) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(null),
        "error-callback": () => onTokenRef.current(null)
      });
    });

    return () => {
      disposed = true;
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
    };
  }, [resetKey]);

  if (!getOptionalPublicEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY")) {
    return null;
  }

  return (
    <div aria-label="Bot check" className="min-h-[65px]" ref={hostRef} role="group" />
  );
}
