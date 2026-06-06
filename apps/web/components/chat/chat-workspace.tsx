"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuestion = question.trim();
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
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_360px]">
      <aside className="rounded-contexta border border-border bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold">History</h2>
          <Button disabled={isLoading || isSending} onClick={() => void handleNewChat()} variant="secondary">
            New chat
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {sessions.map((session) => (
            <button
              key={session.id}
              className={`w-full rounded border px-3 py-2 text-left text-sm transition ${
                session.id === activeSessionId
                  ? "border-primary bg-blue-50 text-primary"
                  : "border-border bg-white text-ink hover:border-primary"
              }`}
              type="button"
              onClick={() => void handleSelectSession(session.id)}
            >
              <span className="block truncate">{session.title}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">Documents in chat</h3>
            {selectedDocumentIds.length > 0 ? (
              <button className="text-xs font-medium text-primary hover:underline" type="button" onClick={() => setSelectedDocumentIds([])}>
                All
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-5 text-subtle">Select documents to narrow the answer scope.</p>
          <div className="mt-3 space-y-2">
            {readyDocuments.length > 0 ? (
              readyDocuments.map((document) => {
                const isSelected = selectedDocumentIds.includes(document.id);
                return (
                  <label
                    key={document.id}
                    className={`flex cursor-pointer items-start gap-2 rounded border px-3 py-2 text-sm transition ${
                      isSelected ? "border-primary bg-blue-50 text-primary" : "border-border bg-white text-ink hover:border-primary"
                    }`}
                  >
                    <input
                      className="mt-1 h-4 w-4 rounded border-border text-primary"
                      checked={isSelected}
                      type="checkbox"
                      onChange={() => toggleDocument(document.id)}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{document.filename}</span>
                      <span className="block text-xs text-subtle">{document.chunk_count} chunks</span>
                    </span>
                  </label>
                );
              })
            ) : (
              <p className="rounded border border-border bg-muted p-3 text-xs leading-5 text-subtle">
                No ready documents yet. Upload and wait until processing finishes.
              </p>
            )}
          </div>
        </div>
      </aside>

      <section className="flex min-h-[560px] flex-col rounded-contexta border border-border bg-white p-5">
        <div className="mb-4 rounded border border-blue-200 bg-blue-50 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Chat scope</p>
              <p className="mt-1 truncate text-sm font-medium text-ink">{chatScopeLabel}</p>
            </div>
            <Link className="text-xs font-semibold text-primary hover:underline" href="/documents">
              Manage documents
            </Link>
          </div>
          {selectedDocuments.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedDocuments.map((document) => (
                <button
                  key={document.id}
                  className="inline-flex max-w-full items-center gap-2 rounded border border-blue-200 bg-white px-2.5 py-1 text-xs font-medium text-primary"
                  type="button"
                  onClick={() => toggleDocument(document.id)}
                  title="Remove from chat scope"
                >
                  <span className="max-w-[220px] truncate">{document.filename}</span>
                  <span aria-hidden="true">x</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="space-y-3">
          {isLoading ? <p className="text-sm text-subtle">Loading chat...</p> : null}
          {!isLoading && messages.length === 0 ? (
            <div className="max-w-[85%] rounded-contexta border border-border bg-muted px-4 py-3 text-sm leading-6 text-ink">
              Ask a question once your documents are ready.
            </div>
          ) : null}
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
          {selectedDocumentIds.length > 0 ? (
            <p className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 sm:mr-2 sm:self-center">
              Asking {selectedDocumentIds.length} selected document{selectedDocumentIds.length === 1 ? "" : "s"}
            </p>
          ) : null}
          <label className="sr-only" htmlFor="chat-question">
            Ask Contexta about your documents
          </label>
          <input
            id="chat-question"
            className="h-10 min-w-0 flex-1 rounded border border-border px-3 text-sm outline-none transition focus:border-primary"
            placeholder="Ask Contexta about your documents..."
            value={question}
            disabled={isSending || isLoading}
            onChange={(event) => setQuestion(event.target.value)}
          />
          <Button className="w-full sm:w-auto" disabled={isSending || isLoading || !question.trim()} type="submit">
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
                  <Link className="min-w-0 truncate text-sm font-medium text-primary hover:underline" href={`/documents/${citation.document_id}`}>
                    {citation.document_name}
                  </Link>
                  <span className="shrink-0 text-xs text-subtle">#{citation.source_number}</span>
                </div>
                <p className="mt-1 text-xs text-subtle">
                  {citation.page_number ? `Page ${citation.page_number}` : "Page unknown"} - Score{" "}
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
