import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { ChatLoading } from "@/components/chat/chat-loading";
import { ChatWorkspace } from "@/components/chat/chat-workspace";

export default function ChatPage() {
  return (
    <AppShell>
      <Suspense fallback={<ChatLoading />}>
        <ChatWorkspace />
      </Suspense>
    </AppShell>
  );
}
