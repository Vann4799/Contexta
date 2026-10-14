type LayerStackLoaderProps = {
  className?: string;
};

export function LayerStackLoader({ className = "h-9 w-9" }: LayerStackLoaderProps) {
  return (
    <svg
      aria-label="Loading"
      className={className}
      role="img"
      shapeRendering="geometricPrecision"
      viewBox="360 320 530 540"
    >
      <style>{`
        @keyframes layer-stack-float {
          0%, 100% { transform: translateY(12px); }
          50% { transform: translateY(-12px); }
        }
        .layer-stack-layer {
          animation: layer-stack-float 1.8s cubic-bezier(.37, 0, .63, 1) infinite;
          will-change: transform;
        }
        .layer-stack-2 { animation-delay: -1.6s; }
        .layer-stack-3 { animation-delay: -1.4s; }
      `}</style>
      <path
        className="layer-stack-layer stroke-accent"
        d="M601.9 363.4Q627 351 652.1 363.4L847.9 460.6Q873 473 847.9 485.4L652.1 582.6Q627 595 601.9 582.6L406.1 485.4Q381 473 406.1 460.6Z"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={48}
      />
      <path
        className="layer-stack-layer layer-stack-2 stroke-accent"
        d="M387 604L601.6 704.2Q627 716 652.4 704.2L867 604"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={48}
      />
      <path
        className="layer-stack-layer layer-stack-3 stroke-accent"
        d="M387 722L601.6 822.2Q627 834 652.4 822.2L867 722"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={48}
      />
    </svg>
  );
}
