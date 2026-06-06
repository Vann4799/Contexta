"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  createChatSession,
  listDocuments,
  listChatMessages,
  listChatSessions,
  sendChatMessage,
  type ChatCitation,
  type DocumentItem,
  type ChatMessage,
  type ChatSession
} from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { AIInputWithLoading } from "@/components/ui/ai-input-with-loading";
import { ShiningText } from "@/components/ui/shining-text";

type VisibleMessage = Pick<ChatMessage, "role" | "content" | "citations">;

export function ChatWorkspace() {
  const searchParams = useSearchParams();
  const [question, setQuestion] = useState("");
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<VisibleMessage[]>([]);
  const [citations, setCitations] = useState<ChatCitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAccessToken = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const loadSessionMessages = useCallback(
    async (sessionId: string, accessToken?: string) => {
      const token = accessToken ?? (await getAccessToken());
      if (!token) {
        throw new Error("Sign in to load chat history.");
      }

      const loadedMessages = await listChatMessages(token, sessionId);
      setMessages(loadedMessages);
      const latestAssistant = [...loadedMessages].reverse().find((message) => message.role === "assistant");
      setCitations(latestAssistant?.citations ?? []);
      setIsSourcesOpen((latestAssistant?.citations ?? []).length > 0);
    },
    [getAccessToken]
  );

  useEffect(() => {
    let isMounted = true;

    async function bootstrapChat() {
      setIsLoading(true);
      setError(null);

      try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          throw new Error("Sign in to load chat.");
        }

        let loadedSessions = await listChatSessions(accessToken);
        const loadedDocuments = await listDocuments(accessToken);
        if (loadedSessions.length === 0) {
          const createdSession = await createChatSession(accessToken);
          loadedSessions = [createdSession];
        }

        if (!isMounted) {
          return;
        }

        setSessions(loadedSessions);
        setDocuments(loadedDocuments);
        setActiveSessionId(loadedSessions[0].id);
        await loadSessionMessages(loadedSessions[0].id, accessToken);
      } catch (chatError) {
        if (isMounted) {
          setError(chatError instanceof Error ? chatError.message : "Unable to load chat.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    bootstrapChat();

    return () => {
      isMounted = false;
    };
  }, [getAccessToken, loadSessionMessages]);

  useEffect(() => {
    const suggestedQuestion = searchParams.get("question");
    const documentId = searchParams.get("documentId");
    if (suggestedQuestion) {
      setQuestion(suggestedQuestion);
    }
    setSelectedDocumentIds(documentId ? [documentId] : []);
  }, [searchParams]);

  const handleSelectSession = async (sessionId: string) => {
    if (sessionId === activeSessionId) {
      return;
    }

    setActiveSessionId(sessionId);
    setError(null);
    setIsLoading(true);

    try {
      await loadSessionMessages(sessionId);
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "Unable to load chat messages.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Sign in to create a chat.");
      }

      const createdSession = await createChatSession(accessToken);
      setSessions((current) => [createdSession, ...current]);
      setActiveSessionId(createdSession.id);
      setMessages([]);
      setCitations([]);
      setQuestion("");
      setSelectedDocumentIds([]);
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "Unable to create a new chat.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (submittedQuestion?: string) => {
    const trimmedQuestion = (submittedQuestion ?? question).trim();
    if (!trimmedQuestion || isSending) {
      return;
    }

    setError(null);
    setIsSending(true);
    setQuestion("");
    setMessages((current) => [
      ...current,
      { role: "user", content: trimmedQuestion, citations: [] }
    ]);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Sign in to ask questions.");
      }

      let sessionId = activeSessionId;
      if (!sessionId) {
        const createdSession = await createChatSession(accessToken);
        sessionId = createdSession.id;
        setSessions((current) => [createdSession, ...current]);
        setActiveSessionId(sessionId);
      }

      const response = await sendChatMessage(accessToken, sessionId, trimmedQuestion, selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined);
      setMessages((current) => [
        ...current,
        { role: "assistant", content: response.answer, citations: response.citations }
      ]);
      setCitations(response.citations);
      setIsSourcesOpen(response.citations.length > 0);
      setSessions(await listChatSessions(accessToken));
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "Unable to answer question.");
    } finally {
      setIsSending(false);
    }
  };

  const readyDocuments = documents.filter((document) => document.status === "ready");
  const selectedDocuments = readyDocuments.filter((document) => selectedDocumentIds.includes(document.id));
  const chatScopeLabel =
    selectedDocuments.length === 0
      ? `All ready documents (${readyDocuments.length})`
      : selectedDocuments.map((document) => document.filename).join(", ");

  function toggleDocument(documentId: string) {
    setSelectedDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((currentDocumentId) => currentDocumentId !== documentId)
        : [...current, documentId]
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-120px)]">
      <section className="mx-auto flex min-h-[calc(100vh-132px)] w-full max-w-4xl flex-col">
        <div className="mb-4 flex flex-col gap-3 border-b border-[#dce2f3] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Ask about</p>
            <p className="mt-1 truncate text-sm font-medium text-ink">{chatScopeLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {sessions.length > 0 ? (
              <select
                className="h-9 rounded border border-[#c3c6d7] bg-white px-3 text-sm text-ink outline-none transition focus:border-primary"
                value={activeSessionId ?? ""}
                disabled={isLoading || isSending}
                onChange={(event) => void handleSelectSession(event.target.value)}
                aria-label="Chat history"
              >
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.title}
                  </option>
                ))}
              </select>
            ) : null}
            <Button disabled={isLoading || isSending} onClick={() => void handleNewChat()} variant="secondary">
              New chat
            </Button>
            <Button onClick={() => setIsSourcesOpen(true)} type="button" variant="secondary">
              Sources {citations.length > 0 ? `(${citations.length})` : ""}
            </Button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto pb-6">
          {isLoading ? <p className="text-sm text-subtle">Loading chat...</p> : null}
          {!isLoading && messages.length === 0 ? (
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-primary text-sm font-bold text-white" aria-hidden="true">
                AI
              </div>
              <div className="max-w-[80%] rounded border border-[#dce2f3] bg-white px-4 py-3 text-sm leading-6 text-ink">
                Pilih dokumen di bawah, lalu tanya apa yang ingin kamu pahami.
              </div>
            </div>
          ) : null}
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex items-start gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" ? (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-primary text-sm font-bold text-white" aria-hidden="true">
                  AI
                </div>
              ) : null}
              <div
                className={`max-w-[78%] rounded border px-4 py-3 text-sm leading-6 ${
                  message.role === "user"
                    ? "border-primary bg-primary text-white"
                    : "border-[#dce2f3] bg-white text-ink"
                }`}
              >
                {message.content}
              </div>
              {message.role === "user" ? (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[#dce2f3] text-xs font-bold text-ink" aria-hidden="true">
                  CT
                </div>
              ) : null}
            </div>
          ))}
          {isSending ? (
            <div className="flex items-start gap-3 justify-start">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-primary text-sm font-bold text-white" aria-hidden="true">
                AI
              </div>
              <div className="max-w-[78%] rounded border border-[#dce2f3] bg-white px-4 py-3">
                <ShiningText text="Contexta is thinking..." />
              </div>
            </div>
          ) : null}
          {error ? <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        </div>

        <div className="sticky bottom-0 border-t border-[#dce2f3] bg-[#f9f9ff] py-4">
          <AIInputWithLoading
            id="chat-question"
            placeholder="Ask Contexta about your documents..."
            disabled={isLoading}
            isLoading={isSending}
            onSubmit={handleSubmit}
            initialValue={question}
            helperText={isSending ? "AI is thinking..." : "Ready to submit"}
            leadingContent={
              <>
                <details className="group relative">
                  <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded border border-[#c3c6d7] bg-[#f9f9ff] px-3 text-sm font-medium text-ink hover:border-primary">
                    Documents
                    <span className="text-xs text-subtle">
                      {selectedDocumentIds.length > 0 ? `${selectedDocumentIds.length} selected` : "All ready"}
                    </span>
                  </summary>
                  <div className="absolute bottom-11 left-0 z-20 w-80 rounded border border-[#c3c6d7] bg-white p-3 shadow-lg">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-ink">Choose context</p>
                      {selectedDocumentIds.length > 0 ? (
                        <button className="text-xs font-semibold text-primary hover:underline" type="button" onClick={() => setSelectedDocumentIds([])}>
                          Use all
                        </button>
                      ) : null}
                    </div>
                    <div className="max-h-56 space-y-2 overflow-y-auto">
                      {readyDocuments.length > 0 ? (
                        readyDocuments.map((document) => {
                          const isSelected = selectedDocumentIds.includes(document.id);
                          return (
                            <label key={document.id} className="flex cursor-pointer items-start gap-2 rounded border border-[#dce2f3] px-3 py-2 text-sm hover:border-primary">
                              <input className="mt-1 h-4 w-4" type="checkbox" checked={isSelected} onChange={() => toggleDocument(document.id)} />
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-ink">{document.filename}</span>
                                <span className="block text-xs text-subtle">{document.chunk_count} chunks</span>
                              </span>
                            </label>
                          );
                        })
                      ) : (
                        <p className="rounded bg-muted p-3 text-xs leading-5 text-subtle">No ready documents yet.</p>
                      )}
                    </div>
                  </div>
                </details>
                <span className="min-w-0 truncate text-xs text-subtle">{chatScopeLabel}</span>
              </>
            }
          />
        </div>
      </section>

      {isSourcesOpen ? (
        <button
          className="fixed inset-0 z-30 bg-black/10 lg:hidden"
          type="button"
          aria-label="Close source drawer overlay"
          onClick={() => setIsSourcesOpen(false)}
        />
      ) : null}
      <aside
        className={`fixed bottom-0 right-0 top-0 z-40 w-full max-w-md border-l border-[#c3c6d7] bg-white shadow-xl transition-transform duration-200 ${
          isSourcesOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Source drawer"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-[#c3c6d7] px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Source drawer</p>
              <h2 className="font-heading text-xl font-semibold text-ink">Sources</h2>
            </div>
            <button className="rounded border border-[#c3c6d7] px-3 py-1.5 text-sm font-semibold hover:border-primary" type="button" onClick={() => setIsSourcesOpen(false)}>
              Close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {citations.length > 0 ? (
              <div className="space-y-3">
                {citations.map((citation) => (
                  <article key={`${citation.document_id}-${citation.chunk_index}`} className="rounded border border-[#dce2f3] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link className="min-w-0 truncate text-sm font-medium text-primary hover:underline" href={`/documents/${citation.document_id}`}>
                        {citation.document_name}
                      </Link>
                      <span className="shrink-0 rounded bg-[#dbe1ff] px-2 py-0.5 text-xs font-semibold text-primary">#{citation.source_number}</span>
                    </div>
                    <p className="mt-1 text-xs text-subtle">
                      {citation.page_number ? `Page ${citation.page_number}` : "Page unknown"} - Score {citation.score.toFixed(2)}
                    </p>
                    <p className="mt-2 line-clamp-6 text-sm leading-5 text-subtle">{citation.text}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-subtle">Citations and context snippets will appear here after an answer.</p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
