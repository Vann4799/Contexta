"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Check,
  FileText,
  MessageSquare,
  Zap,
  Upload,
  Search,
  Sparkles,
} from "lucide-react";
import { ContextaLogo } from "@/components/contexta-logo";

function DotField({ count = 60, className = "" }: { count?: number; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const dots: { x: number; y: number; opacity: number; size: number }[] = [];
    for (let i = 0; i < count; i++) {
      dots.push({
        x: Math.random() * w,
        y: Math.random() * h,
        opacity: 0.1 + Math.random() * 0.3,
        size: 1 + Math.random() * 2,
      });
    }

    for (const dot of dots) {
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(242, 251, 72, ${dot.opacity})`;
      ctx.fill();
    }
  }, [count]);

  return <canvas ref={canvasRef} className={`absolute inset-0 h-full w-full ${className}`} style={{ pointerEvents: "none" }} />;
}

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
          <ContextaLogo variant="light" size={152} />
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

function HeroBg() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const NS = "http://www.w3.org/2000/svg";
    const VP = { x: 801, y: 485 };
    const L = -333, R = 340, T = -255, B = 134;
    const zNear = 0.36, zFar = 1.9, dz = 0.118, N = 15;
    const PERIOD = 10;
    const framesG = root.querySelector<SVGGElement>("#frames");
    const rays = Array.from(root.querySelectorAll<SVGLineElement>("#rays line"));
    const LA = root.querySelector<SVGSVGElement>("#LA");
    if (!framesG || !LA || rays.length < 4) return;

    const corners = [[L, T], [R, T], [R, B], [L, B]];
    const rects: SVGRectElement[] = [];
    let k = 1;
    for (let i = 0; i < N; i++) {
      const r = document.createElementNS(NS, "rect");
      r.setAttribute("vector-effect", "non-scaling-stroke");
      framesG.appendChild(r);
      rects.push(r);
    }

    const sm = (a: number, b: number, x: number) => {
      x = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return x * x * (3 - 2 * x);
    };
    const place = () => {
      const W = root.clientWidth;
      const H = root.clientHeight;
      k = Math.max(W / 1600, H / 900);
      const o = `${(W - 1600 * k) / 2 + VP.x * k}px ${(H - 900 * k) / 2 + VP.y * k}px`;
      LA.style.transformOrigin = o;
    };
    const lay = (el: SVGSVGElement, s: number, op: number, cx: number, cy: number) => {
      el.style.transform = `translate3d(${(-cx * s * k).toFixed(2)}px,${(-cy * s * k).toFixed(2)}px,0) scale(${s.toFixed(4)})`;
      el.style.opacity = op.toFixed(3);
    };
    const draw = (t: number) => {
      const cx = Math.sin(t * 0.12) * 8;
      const cy = Math.sin(t * 0.09 + 1.3) * 5;
      const o = ((t % PERIOD) / PERIOD) * dz;
      for (let i = 0; i < N; i++) {
        const z = zNear + i * dz - o;
        const s = 1 / z;
        const a = sm(zFar, 1.35, z) * sm(0.38, 0.58, z) * 0.3;
        const r = rects[i];
        r.setAttribute("x", (VP.x + (L - cx) * s).toFixed(2));
        r.setAttribute("y", (VP.y + (T - cy) * s).toFixed(2));
        r.setAttribute("width", ((R - L) * s).toFixed(2));
        r.setAttribute("height", ((B - T) * s).toFixed(2));
        r.setAttribute("stroke-opacity", a.toFixed(3));
      }
      for (let j = 0; j < 4; j++) {
        const X = corners[j][0] - cx;
        const Y = corners[j][1] - cy;
        const l = rays[j];
        l.setAttribute("x1", (VP.x + X * 0.45).toFixed(2));
        l.setAttribute("y1", (VP.y + Y * 0.45).toFixed(2));
        l.setAttribute("x2", (VP.x + X * 3.3).toFixed(2));
        l.setAttribute("y2", (VP.y + Y * 3.3).toFixed(2));
      }
      lay(LA, 1, 1, cx, cy);
    };

    place();
    window.addEventListener("resize", place);
    let animId = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      draw(0);
    } else {
      const loop = (ms: number) => {
        draw(ms / 1000);
        animId = requestAnimationFrame(loop);
      };
      animId = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", place);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden"
      style={{
        pointerEvents: "none",
        userSelect: "none",
        background:
          "radial-gradient(ellipse 72% 66% at 50% 53%, #EEE7D8 0%, #F0EADD 48%, #F6F3EB 100%)",
      }}
    >
      <svg className="absolute h-0 w-0 overflow-hidden" viewBox="0 0 1600 900" aria-hidden="true">
        <defs>
          <filter id="f14" filterUnits="userSpaceOnUse" x="-100" y="-100" width="1800" height="1100">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id="f6" filterUnits="userSpaceOnUse" x="-100" y="-100" width="1800" height="1100">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter id="f3" filterUnits="userSpaceOnUse" x="-100" y="-100" width="1800" height="1100">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <linearGradient id="gw" gradientUnits="userSpaceOnUse" x1="190" y1="180" x2="100" y2="420">
            <stop offset="0" stopColor="#FFE930" stopOpacity=".7" />
            <stop offset=".55" stopColor="#F6E27A" stopOpacity=".25" />
            <stop offset="1" stopColor="#EFE6C4" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#FFFCE0" stopOpacity=".95" />
            <stop offset=".5" stopColor="#FFF5AE" stopOpacity=".4" />
            <stop offset="1" stopColor="#FFF5AE" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="gh" gradientUnits="userSpaceOnUse" cx="30" cy="120" r="180">
            <stop offset="0" stopColor="#FFEF5A" stopOpacity=".6" />
            <stop offset="1" stopColor="#FFEF5A" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="gl" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#EBD78A" stopOpacity=".6" />
            <stop offset="1" stopColor="#EBD78A" stopOpacity=".08" />
          </linearGradient>
          <linearGradient id="gs" gradientUnits="userSpaceOnUse" x1="1220" y1="560" x2="1470" y2="840">
            <stop offset="0" stopColor="#DAD4C4" stopOpacity=".62" />
            <stop offset="1" stopColor="#C9C3B3" stopOpacity=".34" />
          </linearGradient>
          <radialGradient id="gg" gradientUnits="userSpaceOnUse" cx="1385" cy="668" r="150">
            <stop offset="0" stopColor="#FFEA3A" stopOpacity=".75" />
            <stop offset="1" stopColor="#FFEA3A" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="gr" gradientUnits="userSpaceOnUse" cx="1610" cy="445" r="140">
            <stop offset="0" stopColor="#FFF4B0" stopOpacity=".65" />
            <stop offset="1" stopColor="#FFF4B0" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="gp" gradientUnits="userSpaceOnUse" x1="1180" y1="90" x2="1110" y2="262">
            <stop offset="0" stopColor="#F1E2A6" stopOpacity=".75" />
            <stop offset="1" stopColor="#F1E2A6" stopOpacity=".18" />
          </linearGradient>
          <g id="scene">
            <circle cx="30" cy="120" r="180" fill="url(#gh)" />
            <polygon points="67,115 316,245 316,447 67,447" fill="url(#gw)" filter="url(#f3)" />
            <path d="M67 115 L316 245" stroke="#FFE92A" strokeWidth="34" strokeLinecap="round" opacity=".8" filter="url(#f14)" />
            <polygon points="252,84 640,84 470,215 400,190 316,245" fill="url(#gc)" filter="url(#f6)" />
            <polygon points="370,360 454,384 454,559 370,608" fill="url(#gl)" filter="url(#f3)" />
            <path d="M95 890 L255 760" stroke="#FFEF6A" strokeWidth="30" strokeLinecap="round" opacity=".85" filter="url(#f14)" />
            <path d="M255 760 L470 605" stroke="#FFF3A0" strokeWidth="22" strokeLinecap="round" opacity=".55" filter="url(#f14)" />
            <circle cx="1610" cy="445" r="140" fill="url(#gr)" />
            <polygon points="1210,537 1478,671 1478,860 1210,667" fill="url(#gs)" filter="url(#f3)" />
            <circle cx="1385" cy="668" r="150" fill="url(#gg)" />
            <path d="M1360 640 L1610 502" stroke="#FFF2A0" strokeWidth="36" strokeLinecap="round" opacity=".75" filter="url(#f14)" />
            <polygon points="1028,262 1180,87 1358,87 1358,182 1248,262" fill="url(#gp)" filter="url(#f3)" />
            <g fill="#1b1710" opacity=".85">
              <circle cx="801" cy="131" r="2.4" />
              <circle cx="1358" cy="189" r="3.6" />
              <circle cx="245" cy="354" r="3.8" />
              <circle cx="801" cy="485" r="2.4" />
              <circle cx="1210" cy="359" r="2.8" />
              <circle cx="318" cy="598" r="2.6" />
              <circle cx="801" cy="835" r="2.4" />
              <circle cx="1204" cy="835" r="2.4" />
            </g>
          </g>
        </defs>
      </svg>

      <svg id="LA" className="absolute inset-0 block h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" style={{ transformOrigin: "0 0", willChange: "transform,opacity", maskImage: "radial-gradient(ellipse 90% 88% at 50% 53%, black 52%, transparent 86%)", WebkitMaskImage: "radial-gradient(ellipse 90% 88% at 50% 53%, black 52%, transparent 86%)" }}>
        <use href="#scene" />
      </svg>

      <svg id="tunnel" className="absolute inset-0 block h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
        <g id="rays" stroke="#5b4a28" strokeOpacity=".13" fill="none">
          <line vectorEffect="non-scaling-stroke" />
          <line vectorEffect="non-scaling-stroke" />
          <line vectorEffect="non-scaling-stroke" />
          <line vectorEffect="non-scaling-stroke" />
        </g>
        <g id="frames" fill="none" stroke="#5b4a28" strokeWidth="1" />
      </svg>
    </div>
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
    <section
      ref={ref}
      className="relative flex min-h-[calc(100svh-4rem)] items-center overflow-hidden"
    >
      <HeroBg />

      <motion.div
        style={{ opacity }}
        className="relative mx-auto max-w-5xl translate-y-10 px-6 text-center"
      >
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
            className="group flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-base font-semibold text-accent-ink transition-all hover:bg-accent-deep"
          >
            Start for free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-full border border-paper-line bg-paper-card px-6 py-3 text-base font-medium text-ink transition-colors hover:bg-paper-soft"
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
    <section id="features" className="relative border-t border-paper-line py-20 md:py-32">
      <DotField count={30} className="opacity-20" />
      <div className="relative mx-auto max-w-7xl px-6">
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
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 transition-colors group-hover:bg-accent/20">
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
    icon: Upload,
    title: "Upload your documents",
    description: "Drag and drop PDFs, Word docs, or connect your cloud storage.",
  },
  {
    number: "02",
    icon: Brain,
    title: "AI processes and indexes",
    description: "Our AI extracts content, creates embeddings, and builds a searchable index.",
  },
  {
    number: "03",
    icon: Search,
    title: "Chat and discover insights",
    description: "Ask questions, get summaries, and explore your documents with AI assistance.",
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="relative border-t border-paper-line bg-paper-soft py-20 md:py-32">
      <DotField count={25} className="opacity-15" />
      <div className="relative mx-auto max-w-7xl px-6">
        <FadeIn className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold text-ink md:text-5xl">How it works</h2>
          <p className="mx-auto max-w-2xl text-lg text-ink-muted">
            Three simple steps to transform your documents into an AI-powered knowledge base.
          </p>
        </FadeIn>

        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <FadeIn key={step.number} delay={i * 0.15}>
              <div className="relative rounded-card border border-paper-line bg-paper-card p-6 transition-all hover:border-paper-edge hover:shadow-card">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20">
                    <step.icon className="h-5 w-5 text-ink" />
                  </div>
                  <span className="font-mono text-2xl font-bold text-ink">
                    {step.number}
                  </span>
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
    <section className="relative border-t border-paper-line py-20 md:py-32">
      <DotField count={35} className="opacity-20" />
      <div className="relative mx-auto max-w-7xl px-6">
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
    <section id="pricing" className="relative border-t border-paper-line bg-paper-soft py-20 md:py-32">
      <DotField count={25} className="opacity-15" />
      <div className="relative mx-auto max-w-7xl px-6">
        <FadeIn className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-ink md:text-4xl">
            Pricing.
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
                  className={`block rounded-full py-3 text-center text-sm font-semibold transition-all ${
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
    <section className="relative border-t border-paper-line bg-night py-20 md:py-32">
      <DotField count={50} className="opacity-30" />
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <FadeIn>
          <h2 className="mb-6 text-3xl font-bold tracking-tight text-paper md:text-4xl">
            Ready?
          </h2>
          <p className="mb-8 text-lg text-paper/70">
            Start free today. Upgrade when you need more.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-8 py-4 text-lg font-semibold text-accent-ink transition-all hover:bg-accent-deep"
          >
            <Sparkles className="h-5 w-5" />
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
          <div className="md:col-span-2">
            <ContextaLogo variant="dark" size={140} />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-paper/50">
              AI-powered document intelligence. Upload, chat, and extract insights from your documents.
            </p>
            <div className="mt-6 flex gap-4">
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-paper/10 text-paper/50 transition-colors hover:border-paper/20 hover:text-paper"
                aria-label="Twitter"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-paper/10 text-paper/50 transition-colors hover:border-paper/20 hover:text-paper"
                aria-label="GitHub"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-paper/10 text-paper/50 transition-colors hover:border-paper/20 hover:text-paper"
                aria-label="LinkedIn"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>

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
      <main className="pt-16">
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
