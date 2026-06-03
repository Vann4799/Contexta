import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

export default function ChatPage() {
  return (
    <AppShell title="Chat">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex min-h-[560px] flex-col rounded-contexta border border-border bg-white p-5">
          <div className="rounded-contexta border border-border bg-muted p-4 text-sm text-subtle">
            Ask a question once your documents are ready.
          </div>
          <div className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row">
            <label className="sr-only" htmlFor="chat-question">
              Ask Contexta about your documents
            </label>
            <input
              id="chat-question"
              className="h-10 min-w-0 flex-1 rounded border border-border px-3 text-sm outline-none transition focus:border-primary"
              placeholder="Ask Contexta about your documents..."
            />
            <Button className="w-full sm:w-auto">Send</Button>
          </div>
        </section>
        <aside className="rounded-contexta border border-border bg-white p-5">
          <h2 className="font-heading text-lg font-semibold">Sources</h2>
          <p className="mt-2 text-sm text-subtle">Citations and context snippets will appear here.</p>
        </aside>
      </div>
    </AppShell>
  );
}
