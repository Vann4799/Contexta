import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#f9fafb",
        surface: "#ffffff",
        muted: "#f3f4f6",
        border: "#e5e7eb",
        primary: "#2563eb",
        ink: "#111827",
        subtle: "#6b7280",
        soft: "#f9f9ff"
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "Arial", "sans-serif"],
        heading: ["var(--font-plus-jakarta)", "var(--font-inter)", "Inter", "Arial", "sans-serif"],
        mono: ["JetBrains Mono", "Consolas", "monospace"]
      },
      borderRadius: {
        contexta: "0.5rem"
      },
      boxShadow: {
        soft: "0 4px 12px rgba(17, 24, 39, 0.05)"
      }
    }
  },
  plugins: []
};

export default config;
