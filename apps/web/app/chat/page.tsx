import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { ChatWorkspace } from "@/components/chat/chat-workspace";

export default function ChatPage() {
  return (
    <AppShell title="Chat">
      <Suspense fallback={<section className="rounded-contexta border border-border bg-white p-5 text-sm text-subtle">Loading chat...</section>}>
        <ChatWorkspace />
      </Suspense>
    </AppShell>
  );
}
