import { AppShell } from "@/components/app-shell";
import { PipelineWorkspace } from "@/components/pipeline/pipeline-workspace";

export default function PipelinePage() {
  return (
    <AppShell>
      <PipelineWorkspace />
    </AppShell>
  );
}
