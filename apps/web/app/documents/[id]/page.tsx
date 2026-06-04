import { AppShell } from "@/components/app-shell";
import { DocumentIntelligencePanel } from "@/components/documents/document-intelligence-panel";

type DocumentDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function DocumentDetailPage({ params }: DocumentDetailPageProps) {
  const { id } = await params;

  return (
    <AppShell title="Document Intelligence">
      <DocumentIntelligencePanel documentId={id} />
    </AppShell>
  );
}
