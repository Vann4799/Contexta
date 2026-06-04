import { AppShell } from "@/components/app-shell";
import { ChatWorkspace } from "@/components/chat/chat-workspace";

export default function ChatPage() {
  return (
    <AppShell title="Chat">
      <ChatWorkspace />
    </AppShell>
  );
}
