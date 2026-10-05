import { cn } from "@/lib/utils";

type Status = "ready" | "processing" | "failed";

const styles: Record<Status, string> = {
  ready: "border-transparent bg-accent text-ink",
  processing: "border-transparent bg-night text-accent",
  failed: "border-danger-line bg-danger-soft text-danger"
};

const labels: Record<Status, string> = {
  ready: "Ready",
  processing: "Processing",
  failed: "Failed"
};

export function StatusPill({ status, className = "" }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-chip border px-1.5 py-0.5 text-[11.5px] font-semibold leading-none",
        styles[status],
        className
      )}
    >
      {labels[status]}
    </span>
  );
}
