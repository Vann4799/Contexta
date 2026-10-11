"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Contexta Global Error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ebe8df",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#1a1a1a",
          padding: "24px"
        }}
      >
        <div style={{ maxWidth: 400, width: "100%", textAlign: "center" }}>
          <div style={{ marginBottom: 24 }}>
            <svg width="140" height="32" viewBox="0 0 140 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Contexta">
              <rect x="1" y="5" width="22" height="22" rx="6" fill="#1a1a1a" />
              <rect x="5" y="9" width="6" height="6" rx="1.5" fill="#f5c542" />
              <rect x="13" y="9" width="6" height="6" rx="1.5" fill="#f5c542" opacity="0.5" />
              <rect x="5" y="17" width="6" height="6" rx="1.5" fill="#f5c542" opacity="0.5" />
              <rect x="13" y="17" width="6" height="6" rx="1.5" fill="#f5c542" opacity="0.25" />
              <text x="32" y="22" fontFamily="system-ui" fontSize="16" fontWeight="600" fill="#1a1a1a">Contexta</text>
            </svg>
          </div>

          <div style={{ marginBottom: 24, display: "flex", justifyContent: "center" }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                backgroundColor: "rgba(245, 197, 66, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </div>
          </div>

          <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6b6b6b", marginBottom: 8 }}>
            Critical error
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
            Application error
          </h1>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "#6b6b6b", margin: "0 0 32px" }}>
            A critical error occurred that cannot be recovered. Please try again or contact support if the problem persists.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              onClick={reset}
              style={{
                height: 40,
                borderRadius: 8,
                backgroundColor: "#1a1a1a",
                color: "white",
                border: "none",
                padding: "0 20px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
