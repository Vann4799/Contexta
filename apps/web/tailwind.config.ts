import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "oklch(0.97 0.012 85 / <alpha-value>)",
        surface: "oklch(0.945 0.014 85 / <alpha-value>)",
        muted: "oklch(0.945 0.014 85 / <alpha-value>)",
        soft: "oklch(0.945 0.014 85 / <alpha-value>)",
        border: "oklch(0.25 0.012 70 / 0.14)",
        primary: "oklch(0.52 0.13 45 / <alpha-value>)",
        accent: "oklch(0.52 0.13 45 / <alpha-value>)",
        "accent-strong": "oklch(0.45 0.13 45 / <alpha-value>)",
        "accent-soft": "oklch(0.52 0.13 45 / 0.12)",
        "accent-ink": "oklch(0.97 0.012 85 / <alpha-value>)",
        ink: "oklch(0.25 0.012 70 / <alpha-value>)",
        subtle: "oklch(0.45 0.014 70 / <alpha-value>)"
      },
      fontFamily: {
        sans: ["Public Sans", "Arial", "sans-serif"],
        heading: ["Fraunces", "Georgia", "serif"],
        mono: ["JetBrains Mono", "Consolas", "monospace"]
      },
      borderRadius: {
        contexta: "4px"
      },
      boxShadow: {
        soft: "0 4px 12px rgba(17, 24, 39, 0.05)"
      }
    }
  },
  plugins: []
};

export default config;
