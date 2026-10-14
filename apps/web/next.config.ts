import type { NextConfig } from "next";

/**
 * Origins the browser actually talks to, read from the same env the client code uses.
 *
 * A CSP is only safe to enforce when it is derived from configuration: a hard-coded list here
 * would break the app the first time the API moves to another host, and the failure mode is a
 * blank page in production rather than a visible error.
 */
function buildConnectSrc(): string {
  const origins = [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_API_BASE_URL,
  ].filter((value): value is string => Boolean(value));

  if (origins.length < 2) {
    // Incomplete configuration must not ship a policy that blocks the app. Every https
    // endpoint stays reachable; everything the policy is actually there for does not.
    return "'self' https: wss:";
  }

  return ['self', ...origins.map((origin) => origin.replace(/\/+$/, "")), "wss:"].join(" ");
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
