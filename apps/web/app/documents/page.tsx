import { AppShell } from "@/components/app-shell";
import { DocumentUploadPanel } from "@/components/documents/document-upload-panel";

export default function DocumentsPage() {
  return (
    <AppShell title="Documents">
      <DocumentUploadPanel />
    </AppShell>
  );
}
