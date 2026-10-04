"use client";

import { motion } from "motion/react";

type ShiningTextProps = {
  text: string;
  className?: string;
};

export function ShiningText({ text, className = "" }: ShiningTextProps) {
  return (
    <motion.h1
      className={`inline-block min-w-40 bg-[linear-gradient(110deg,var(--color-ink-2),35%,var(--color-paper),50%,var(--color-ink-2),75%,var(--color-ink-2))] bg-[length:200%_100%] bg-clip-text text-base font-normal text-transparent ${className}`}
      initial={{ backgroundPosition: "200% 0" }}
      animate={{ backgroundPosition: "-200% 0" }}
      transition={{
        repeat: Infinity,
        duration: 2,
        ease: "linear"
      }}
    >
      {text}
    </motion.h1>
  );
}
