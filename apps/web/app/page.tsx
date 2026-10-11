"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  FileText,
  MessageSquare,
  Sparkles,
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

function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <section ref={ref} className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-32">
      {/* Animated background grid */}
      <motion.div
        style={{ y }}
        className="absolute inset-0 opacity-30"
      >
        <div className="absolute inset-0 dot-grid" />
      </motion.div>

      {/* Floating accent elements */}
      <motion.div
        animate={{
          y: [0, -20, 0],
          rotate: [0, 5, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-1/4 left-10 h-32 w-32 rounded-full bg-accent/20 blur-3xl"
      />
      <motion.div
        animate={{
          y: [0, 20, 0],
          rotate: [0, -5, 0],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute bottom-1/4 right-10 h-40 w-40 rounded-full bg-accent/10 blur-3xl"
      />

      <motion.div style={{ opacity }} className="relative mx-auto max-w-5xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-paper-line bg-paper-card px-4 py-1.5"
        >
          <Sparkles className="h-4 w-4 text-accent-deep" />
          <span className="text-xs font-medium text-ink-muted">
            AI-powered document intelligence
          </span>
        </motion.div>

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
                <div className="mb-4 font-mono text-6xl font-bold text-accent/20">
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

function Footer() {
  return (
    <footer className="border-t border-paper-line bg-paper py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <ContextaLogo variant="light" size={100} />
            <span className="text-sm text-ink-muted">
              © 2026 Contexta. All rights reserved.
            </span>
          </div>
          <div className="flex gap-6 text-sm text-ink-muted">
            <Link href="/terms" className="transition-colors hover:text-ink">
              Terms
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-ink">
              Privacy
            </Link>
            <Link href="/help" className="transition-colors hover:text-ink">
              Help
            </Link>
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
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
