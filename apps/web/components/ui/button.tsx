import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "accent" | "secondary" | "ghost";
};

const variants = {
  primary: "border border-transparent bg-night text-white shadow-node hover:bg-night-raised",
  accent: "border border-transparent bg-accent text-ink shadow-node hover:bg-accent-deep",
  secondary: "border border-paper-line bg-paper-soft text-ink hover:bg-paper-card",
  ghost: "border border-transparent text-ink-muted hover:bg-paper-chip hover:text-ink"
};

export function Button({ className = "", variant = "primary", type = "button", ...props }: ButtonProps) {
  return (
    <button
      className={`focus-ring inline-flex h-10 max-w-full items-center justify-center gap-2 rounded-control px-4 text-[13.5px] font-medium leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      type={type}
      {...props}
    />
  );
}
