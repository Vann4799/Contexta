"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  FileText,
  MessageSquare,
  Zap,
} from "lucide-react";
import { ContextaLogo } from "@/components/contexta-logo";

function FadeIn({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Navbar() {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-paper-line bg-paper/80 backdrop-blur-sm"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <ContextaLogo variant="light" size={120} />
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-ink-muted transition-colors hover:text-ink">
            Features
          </a>
          <a href="#how-it-works" className="text-sm text-ink-muted transition-colors hover:text-ink">
            How it works
          </a>
          <a href="#pricing" className="text-sm text-ink-muted transition-colors hover:text-ink">
            Pricing
          </a>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-ink transition-colors hover:text-ink-muted"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-control bg-night px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-night-raised"
          >
            Get started
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}

function HeroGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mouseRef.current = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let time = 0;

    function resize() {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      if (ctx) ctx.scale(dpr, dpr);
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;

      ctx.clearRect(0, 0, w, h);

      time += 0.003;
      const mx = (mouseRef.current.x - 0.5) * 30;
      const my = (mouseRef.current.y - 0.5) * 20;

      const horizonY = h * 0.38;
      const gridLines = 24;
      const isMobile = w < 768;
      const verticalCount = isMobile ? 12 : 20;

      for (let i = 0; i <= gridLines; i++) {
        const t = i / gridLines;
        const perspective = Math.pow(t, 2.2);
        const lineY = horizonY + (h - horizonY) * perspective;
        const spread = 0.3 + perspective * 0.7;
        const leftX = w / 2 - (w / 2) * spread + mx * (1 - t) * 0.5;
        const rightX = w / 2 + (w / 2) * spread + mx * (1 - t) * 0.5;
        const opacity = 0.04 + perspective * 0.14;
        const pulse = Math.sin(time * 2 + i * 0.3) * 0.02;

        ctx.beginPath();
        ctx.moveTo(leftX, lineY + my * (1 - t));
        ctx.lineTo(rightX, lineY + my * (1 - t));
        ctx.strokeStyle = `rgba(19, 19, 21, ${Math.max(0, opacity + pulse)})`;
        ctx.lineWidth = 0.5 + perspective * 0.5;
        ctx.stroke();
      }

      for (let i = 0; i <= verticalCount; i++) {
        const t = i / verticalCount;
        const baseX = w * t;
        const topX = w / 2 + (baseX - w / 2) * 0.05 + mx * 0.3;
        const bottomX = baseX + mx * -0.1;
        const distFromCenter = Math.abs(t - 0.5) * 2;
        const opacity = 0.03 + (1 - distFromCenter) * 0.08;
        const pulse = Math.sin(time * 1.5 + i * 0.5) * 0.015;

        ctx.beginPath();
        ctx.moveTo(topX, horizonY + my * 0.5);
        ctx.lineTo(bottomX, h + my * -0.1);
        ctx.strokeStyle = `rgba(19, 19, 21, ${Math.max(0, opacity + pulse)})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      const glowX = w / 2 + mx * 0.5;
      const glowY = horizonY + my * 0.3;
      const gradient = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, w * 0.3);
      gradient.addColorStop(0, "rgba(242, 251, 72, 0.06)");
      gradient.addColorStop(1, "rgba(242, 251, 72, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      animId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [handleMouseMove]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      style={{ pointerEvents: "none" }}
    />
  );
}

function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <section ref={ref} className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-32">
      {/* Interactive 3D perspective grid */}
      <HeroGrid />

      <motion.div style={{ opacity }} className="relative mx-auto max-w-5xl px-6 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6 text-5xl font-bold tracking-tight text-ink md:text-7xl"
        >
          Your documents,
          <br />
          <span className="text-ink-muted">understood by AI</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mb-10 max-w-2xl text-lg text-ink-muted md:text-xl"
        >
          Upload, convert, and chat with your documents. Contexta uses advanced AI to extract
          insights, answer questions, and connect your knowledge.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Link
            href="/register"
            className="group flex items-center gap-2 rounded-control bg-accent px-6 py-3 text-base font-semibold text-accent-ink transition-all hover:bg-accent-deep"
          >
            Start for free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-control border border-paper-line bg-paper-card px-6 py-3 text-base font-medium text-ink transition-colors hover:bg-paper-soft"
          >
            Sign in
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-16 flex items-center justify-center gap-8 text-sm text-ink-muted"
        >
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <span>Free tier available</span>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span>No credit card required</span>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

const features = [
  {
    icon: FileText,
    title: "Smart Document Processing",
    description:
      "Upload PDFs, Word docs, and more. Our AI extracts text, tables, and structure automatically.",
  },
  {
    icon: MessageSquare,
    title: "Chat with Your Documents",
    description:
      "Ask questions in natural language. Get accurate answers with citations to the source.",
  },
  {
    icon: Brain,
    title: "AI-Powered Insights",
    description:
      "Automatic summaries, key findings, and intelligent analysis of your document collection.",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description:
      "Process thousands of pages in seconds. Real-time search across your entire knowledge base.",
  },
];

function Features() {
  return (
    <section id="features" className="border-t border-paper-line py-20 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold text-ink md:text-5xl">
            Everything you need to work with documents
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-ink-muted">
            Powerful AI tools that understand your documents and help you extract value from them.
          </p>
        </FadeIn>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, i) => (
            <FadeIn key={feature.title} delay={i * 0.1}>
              <div className="group rounded-card border border-paper-line bg-paper-card p-6 transition-all hover:border-paper-edge hover:shadow-card">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-control bg-accent/10 transition-colors group-hover:bg-accent/20">
                  <feature.icon className="h-6 w-6 text-ink" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-ink">{feature.title}</h3>
                <p className="text-sm text-ink-muted">{feature.description}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

const steps = [
  {
    number: "01",
    title: "Upload your documents",
    description: "Drag and drop PDFs, Word docs, or connect your cloud storage.",
  },
  {
    number: "02",
    title: "AI processes and indexes",
    description: "Our AI extracts content, creates embeddings, and builds a searchable index.",
  },
  {
    number: "03",
    title: "Chat and discover insights",
    description: "Ask questions, get summaries, and explore your documents with AI assistance.",
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-paper-line bg-paper-soft py-20 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold text-ink md:text-5xl">How it works</h2>
          <p className="mx-auto max-w-2xl text-lg text-ink-muted">
            Three simple steps to transform your documents into an AI-powered knowledge base.
          </p>
        </FadeIn>

        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <FadeIn key={step.number} delay={i * 0.15}>
              <div className="relative">
                <div className="mb-4 font-mono text-6xl font-bold text-accent/40">
                  {step.number}
                </div>
                <h3 className="mb-2 text-xl font-semibold text-ink">{step.title}</h3>
                <p className="text-ink-muted">{step.description}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

const stats = [
  { value: "10K+", label: "Documents processed" },
  { value: "95%", label: "Accuracy rate" },
  { value: "<1s", label: "Average response time" },
  { value: "50+", label: "File formats supported" },
];

function Stats() {
  return (
    <section className="border-t border-paper-line py-20 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-8 md:grid-cols-4">
          {stats.map((stat, i) => (
            <FadeIn key={stat.label} delay={i * 0.1} className="text-center">
              <div className="mb-2 text-5xl font-bold text-ink md:text-6xl">{stat.value}</div>
              <div className="text-sm text-ink-muted">{stat.label}</div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

const pricingTiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for trying out Contexta",
    features: [
      "10 documents",
      "100 MB storage",
      "2 API keys",
      "100 API requests/day",
      "50 chat messages/day",
      "Community support",
    ],
    cta: "Get started free",
    href: "/register",
    popular: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For professionals and growing teams",
    features: [
      "500 documents",
      "10 GB storage",
      "10 API keys",
      "10,000 API requests/day",
      "1,000 chat messages/day",
      "Priority support",
      "Advanced analytics",
      "Custom integrations",
    ],
    cta: "Start Pro trial",
    href: "/register?plan=pro",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "$99",
    period: "/month",
    description: "For organizations at scale",
    features: [
      "10,000 documents",
      "100 GB storage",
      "100 API keys",
      "100,000 API requests/day",
      "10,000 chat messages/day",
      "Dedicated support",
      "Advanced analytics",
      "SSO & audit logs",
    ],
    cta: "Contact sales",
    href: "/register?plan=enterprise",
    popular: false,
  },
];

function Pricing() {
  return (
    <section id="pricing" className="border-t border-paper-line bg-paper-soft py-20 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold text-ink md:text-5xl">
            Simple, transparent pricing
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-ink-muted">
            Start free and scale as you grow. No hidden fees, no surprises.
          </p>
        </FadeIn>

        <div className="grid gap-6 md:grid-cols-3">
          {pricingTiers.map((tier, i) => (
            <FadeIn key={tier.name} delay={i * 0.1}>
              <div
                className={`relative flex h-full flex-col rounded-card border p-8 transition-all ${
                  tier.popular
                    ? "border-ink bg-paper shadow-card"
                    : "border-paper-line bg-paper-card hover:border-paper-edge hover:shadow-card"
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent-ink">
                    Most popular
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="mb-1 text-lg font-semibold text-ink">{tier.name}</h3>
                  <p className="text-sm text-ink-muted">{tier.description}</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-ink">{tier.price}</span>
                  <span className="text-sm text-ink-muted">{tier.period}</span>
                </div>
                <ul className="mb-8 flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-ink-muted">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-ink" strokeWidth={2.5} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.href}
                  className={`block rounded-control py-3 text-center text-sm font-semibold transition-all ${
                    tier.popular
                      ? "bg-accent text-accent-ink hover:bg-accent-deep"
                      : "border border-paper-line bg-paper-soft text-ink hover:bg-paper-card"
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="border-t border-paper-line bg-night py-20 md:py-32">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <FadeIn>
          <h2 className="mb-4 text-3xl font-bold text-paper md:text-5xl">
            Ready to transform your documents?
          </h2>
          <p className="mb-8 text-lg text-paper/70">
            Start free today. No credit card required.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-control bg-accent px-8 py-4 text-lg font-semibold text-accent-ink transition-all hover:bg-accent-deep"
          >
            Get started for free
            <ArrowRight className="h-5 w-5" />
          </Link>
        </FadeIn>
      </div>
    </section>
  );
}

const footerLinks = {
  product: [
    { label: "Features", href: "#features" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Pricing", href: "/pricing" },
    { label: "Changelog", href: "/changelog" },
  ],
  company: [
    { label: "About", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Careers", href: "/careers" },
    { label: "Contact", href: "/contact" },
  ],
  resources: [
    { label: "Documentation", href: "/docs" },
    { label: "API Reference", href: "/docs/api" },
    { label: "Guides", href: "/guides" },
    { label: "Support", href: "/help" },
  ],
  legal: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Security", href: "/security" },
    { label: "GDPR", href: "/gdpr" },
  ],
};

function Footer() {
  return (
    <footer className="bg-night text-paper/70">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-6">
          {/* Brand column */}
          <div className="md:col-span-2">
            <ContextaLogo variant="dark" size={140} />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-paper/50">
              AI-powered document intelligence. Upload, chat, and extract insights from your documents.
            </p>
            <div className="mt-6 flex gap-4">
              {/* Twitter/X */}
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-control border border-paper/10 text-paper/50 transition-colors hover:border-paper/20 hover:text-paper"
                aria-label="Twitter"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              {/* GitHub */}
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-control border border-paper/10 text-paper/50 transition-colors hover:border-paper/20 hover:text-paper"
                aria-label="GitHub"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </a>
              {/* LinkedIn */}
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-control border border-paper/10 text-paper/50 transition-colors hover:border-paper/20 hover:text-paper"
                aria-label="LinkedIn"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Link columns */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-paper/40">
              Product
            </h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-paper/60 transition-colors hover:text-paper"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-paper/40">
              Company
            </h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-paper/60 transition-colors hover:text-paper"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-paper/40">
              Resources
            </h4>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-paper/60 transition-colors hover:text-paper"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-paper/40">
              Legal
            </h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-paper/60 transition-colors hover:text-paper"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-paper/10 pt-8 md:flex-row">
          <p className="text-xs text-paper/40">
            © 2026 Contexta. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-xs text-paper/40">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span>All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Stats />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
