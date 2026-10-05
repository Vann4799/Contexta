import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { ChatWorkspace } from "@/components/chat/chat-workspace";

export default function ChatPage() {
  return (
    <AppShell>
      <Suspense fallback={<section className="surface p-5 text-[13px] text-ink-muted">Loading chat...</section>}>
        <ChatWorkspace />
      </Suspense>
    </AppShell>
  );
}
