type Status = "ready" | "processing" | "failed";

const styles: Record<Status, string> = {
  ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
  processing: "border-blue-200 bg-blue-50 text-blue-700",
  failed: "border-red-200 bg-red-50 text-red-700"
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
