import Image from "next/image";

type ContextaLogoProps = {
  compact?: boolean;
  variant?: "light" | "dark";
};

export function ContextaLogo({ compact = false, variant = "light" }: ContextaLogoProps) {
  const src = variant === "dark" ? "/contexta-dark-logo.png" : "/contexta-neon-logo.png";
  const width = compact ? 140 : 180;

  return (
    <Image
      src={src}
      alt="Contexta"
      width={2172}
      height={724}
      priority
      className="h-auto object-contain"
      style={{ width: `${width}px` }}
    />
  );
}
