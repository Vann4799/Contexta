"use client";

import { useEffect } from "react";

const AUTH_HASH_KEYS = ["access_token", "refresh_token", "code", "error"];

function hasAuthPayload(search: string, hash: string) {
  const searchParams = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash.replace(/^#/, ""));

  return AUTH_HASH_KEYS.some((key) => searchParams.has(key) || hashParams.has(key));
}

export function AuthCallbackForwarder() {
  useEffect(() => {
    if (window.location.pathname.startsWith("/auth/callback")) {
      return;
    }

    if (!hasAuthPayload(window.location.search, window.location.hash)) {
      return;
    }

    window.location.replace(`/auth/callback${window.location.search}${window.location.hash}`);
  }, []);

  return null;
}
