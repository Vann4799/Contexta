import type { Config } from "tailwindcss";

const rgb = (hex: string) => {
  const value = hex.replace("#", "");
  const [r, g, b] = value.match(/../g) ?? [];
  return `${parseInt(r ?? "0", 16)} ${parseInt(g ?? "0", 16)} ${parseInt(b ?? "0", 16)}`;
};

const withAlpha = (hex: string) => `rgb(${rgb(hex)} / <alpha-value>)`;

const v2 = {
  paper: {
    DEFAULT: withAlpha("#ebe8df"),
    deep: withAlpha("#e7e3d8"),
    card: withAlpha("#fdfdfb"),
    soft: withAlpha("#f7f6f2"),
    chip: withAlpha("#f3f0e5"),
    line: withAlpha("#ddd7cb"),
    edge: withAlpha("#c9c4b6")
  },
  ink: {
    DEFAULT: withAlpha("#131315"),
    muted: withAlpha("#68686c"),
    faint: withAlpha("#9a9a9e")
  },
  night: {
    DEFAULT: withAlpha("#1b1b1b"),
    raised: withAlpha("#2b2b2b"),
    line: withAlpha("#333333")
  },
  accent: {
    DEFAULT: withAlpha("#f2fb48"),
    deep: withAlpha("#d9e23a"),
    ink: withAlpha("#131315")
  },
  success: {
    DEFAULT: withAlpha("#f2fb48"),
    ink: withAlpha("#2f6b46"),
    soft: withAlpha("#e3edda"),
    line: "rgb(47 107 70 / 0.3)"
  },
  warning: {
    DEFAULT: withAlpha("#7c5210"),
    soft: withAlpha("#f4e3cd"),
    line: "rgb(124 82 16 / 0.32)"
  },
  danger: {
    DEFAULT: withAlpha("#a3231b"),
    soft: withAlpha("#fadfd9"),
    line: "rgb(163 35 27 / 0.3)"
  }
};

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: v2,
      fontFamily: {
        sans: ["var(--font-sans)", "Plus Jakarta Sans", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        secondary: ["var(--font-secondary)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "SFMono-Regular", "Consolas", "monospace"]
      },
      borderRadius: {
        card: "16px",
        control: "8px",
        chip: "6px"
      },
      boxShadow: {
        card: "0 1px 0 rgba(20,20,20,0.04), 0 8px 24px -12px rgba(20,20,20,0.12)",
        node: "0 1px 2px rgba(20,20,20,0.06), 0 4px 12px -6px rgba(20,20,20,0.12)",
        root: "0 18px 40px -16px rgba(0,0,0,0.45)"
      },
      keyframes: {
        dash: { to: { strokeDashoffset: "-24" } },
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.55", transform: "scale(0.8)" }
        }
      },
      animation: {
        dash: "dash 1.2s linear infinite",
        "pulse-dot": "pulseDot 1.8s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
