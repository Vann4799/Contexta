type Status = "ready" | "processing" | "failed";

const styles: Record<Status, string> = {
  ready: "border-success-line bg-success-soft text-success",
  processing: "border-accent-soft bg-accent-soft text-ink",
  failed: "border-danger-line bg-danger-soft text-danger"
};

const labels: Record<Status, string> = {
  ready: "Ready",
  processing: "Processing",
  failed: "Failed"
};

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded border px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
