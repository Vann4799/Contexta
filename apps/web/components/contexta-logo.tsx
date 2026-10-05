import Image from "next/image";

type ContextaLogoProps = {
  compact?: boolean;
};

export function ContextaLogo({ compact = false }: ContextaLogoProps) {
  return (
    <Image
      src="/contexta-neon-logo.png"
      alt="Contexta"
      width={1064}
      height={337}
      priority
      className={compact ? "h-auto w-[104px] object-contain" : "h-auto w-[142px] object-contain"}
    />
  );
}
