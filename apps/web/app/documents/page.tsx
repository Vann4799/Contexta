import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";

const documents = [
  { name: "Acme merger agreement.pdf", type: "PDF", size: "2.4 MB", status: "ready" as const },
  { name: "Q3 financial disclosures.docx", type: "DOCX", size: "1.1 MB", status: "processing" as const },
  { name: "Unsupported archive.zip", type: "ZIP", size: "45.2 MB", status: "failed" as const }
];

export default function DocumentsPage() {
  return (
    <AppShell title="Documents">
      <section className="rounded-contexta border border-border bg-white">
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-heading text-lg font-semibold">Upload and Manage</h2>
            <p className="mt-1 text-sm text-subtle">PDF and DOCX documents will appear here after upload.</p>
          </div>
          <Button className="w-full sm:w-auto">Upload</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border bg-muted text-xs font-medium uppercase text-subtle">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Size</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.name} className="border-b border-border last:border-0">
                  <td className="max-w-[320px] truncate px-5 py-3 font-medium">{document.name}</td>
                  <td className="px-5 py-3 text-subtle">{document.type}</td>
                  <td className="px-5 py-3 text-subtle">{document.size}</td>
                  <td className="px-5 py-3">
                    <StatusPill status={document.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
