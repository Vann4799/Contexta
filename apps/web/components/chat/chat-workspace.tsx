"use client";

import { FormEvent, useCallback, useState } from "react";
import { queryChat, type ChatCitation } from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function ChatWorkspace() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Ask a question once your documents are ready."
    }
  ]);
  const [citations, setCitations] = useState<ChatCitation[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAccessToken = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isSending) {
      return;
    }

    setError(null);
    setIsSending(true);
    setQuestion("");
    setMessages((current) => [...current, { role: "user", content: trimmedQuestion }]);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Sign in to ask questions.");
      }

      const response = await queryChat(accessToken, trimmedQuestion);
      setMessages((current) => [...current, { role: "assistant", content: response.answer }]);
      setCitations(response.citations);
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "Unable to answer question.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="flex min-h-[560px] flex-col rounded-contexta border border-border bg-white p-5">
        <div className="space-y-3">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`max-w-[85%] rounded-contexta border px-4 py-3 text-sm leading-6 ${
                message.role === "user"
                  ? "ml-auto border-primary bg-primary text-white"
                  : "border-border bg-muted text-ink"
              }`}
            >
              {message.content}
            </div>
          ))}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </div>

        <form className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="chat-question">
            Ask Contexta about your documents
          </label>
          <input
            id="chat-question"
            className="h-10 min-w-0 flex-1 rounded border border-border px-3 text-sm outline-none transition focus:border-primary"
            placeholder="Ask Contexta about your documents..."
            value={question}
            disabled={isSending}
            onChange={(event) => setQuestion(event.target.value)}
          />
          <Button className="w-full sm:w-auto" disabled={isSending || !question.trim()} type="submit">
            {isSending ? "Thinking..." : "Send"}
          </Button>
        </form>
      </section>

      <aside className="rounded-contexta border border-border bg-white p-5">
        <h2 className="font-heading text-lg font-semibold">Sources</h2>
        {citations.length > 0 ? (
          <div className="mt-4 space-y-3">
            {citations.map((citation) => (
              <article key={`${citation.document_id}-${citation.chunk_index}`} className="rounded border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium">{citation.document_name}</p>
                  <span className="shrink-0 text-xs text-subtle">#{citation.source_number}</span>
                </div>
                <p className="mt-1 text-xs text-subtle">
                  {citation.page_number ? `Page ${citation.page_number}` : "Page unknown"} · Score{" "}
                  {citation.score.toFixed(2)}
                </p>
                <p className="mt-2 line-clamp-5 text-sm leading-5 text-subtle">{citation.text}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-subtle">Citations and context snippets will appear here.</p>
        )}
      </aside>
    </div>
  );
}
