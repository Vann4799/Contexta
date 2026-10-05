import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

const variants = {
  primary: "border border-primary bg-primary text-white hover:bg-accent-strong",
  secondary: "border border-border bg-surface text-ink hover:bg-muted",
  ghost: "border border-transparent text-subtle hover:bg-muted hover:text-ink"
};

export function Button({ className = "", variant = "primary", type = "button", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex h-10 max-w-full items-center justify-center rounded px-4 text-sm font-medium leading-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      type={type}
      {...props}
    />
  );
}
