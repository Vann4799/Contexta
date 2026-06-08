import { AppShell } from "@/components/app-shell";
import { MarkdownConverterPanel } from "@/components/convert/markdown-converter-panel";

export default function ConvertPage() {
  return (
    <AppShell title="Convert">
      <MarkdownConverterPanel />
    </AppShell>
  );
}
