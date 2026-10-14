import type { NextConfig } from "next";

/**
 * Origins the browser actually talks to, read from the same env the client code uses.
 *
 * A CSP is only safe to enforce when it is derived from configuration: a hard-coded list here
 * would break the app the first time the API moves to another host, and the failure mode is a
 * blank page in production rather than a visible error.
 *
 * Each value is reduced to an origin, because a directive takes origins and not URLs: the API
 * base is a path (`/api/proxy`) wherever the web app is served behind a rewrite, and pasting
 * that into `connect-src` gives the browser an invalid source to complain about.
 */
function connectSrcOrigins(): string[] {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_API_BASE_URL) {
    return [];
  }

  const origins = new Set<string>();
  for (const value of [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_API_BASE_URL,
  ]) {
    if (value.startsWith("/")) {
      // Same origin, which 'self' already covers.
      continue;
    }
    try {
      const url = new URL(value);
      if (url.protocol === "https:" || url.protocol === "http:") {
        origins.add(url.origin);
      }
    } catch {
      // Unparseable configuration falls through to the broad policy below.
    }
  }

  // Incomplete or unparseable configuration must not ship a policy that blocks the app. Every
  // https endpoint stays reachable; everything the policy is actually there for does not.
  return [...origins];
}

function buildConnectSrc(): string {
  const origins = connectSrcOrigins();
  if (origins.length === 0) {
    return "'self' https: wss:";
  }
  return ["'self'", ...origins, "wss:"].join(" ");
}

const CSP = [
  "default-src 'self'",
  // Next ships its navigation payload as inline script tags, so 'unsafe-inline' is required
  // here. What this policy is for is everything else: framing, external origins, objects.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src ${buildConnectSrc()}`,
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          // Redundant with frame-ancestors for modern browsers, still the header older ones read.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), clipboard-write=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
