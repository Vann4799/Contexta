import Image from "next/image";

type ContextaLogoProps = {
  compact?: boolean;
  variant?: "light" | "dark" | "login";
  size?: number;
};

export function ContextaLogo({ compact = false, variant = "light", size }: ContextaLogoProps) {
  const src = variant === "dark" ? "/contexta-dark-logo.png" : variant === "login" ? "/contexta-login-logo.png" : "/contexta-neon-logo.png";
  const width = size ?? (compact ? 140 : 180);

  return (
    <Image
      src={src}
      alt="Contexta"
      width={2172}
      height={724}
      // Without this the 1x candidate resolves to 3840w: 56 kB for a 180 px mark.
      sizes={`${width}px`}
      priority
      className="h-auto object-contain"
      style={{ width: `${width}px` }}
    />
  );
}
