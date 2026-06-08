"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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

function initialsFromUser(email?: string, fullName?: string) {
  const source = fullName?.trim() || email?.split("@")[0] || "Contexta";
  const words = source.split(/[\s._-]+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "CT";
}

export function ChatWorkspace() {
  const searchParams = useSearchParams();
  const requestedQuestion = searchParams.get("question");
  const requestedDocumentId = searchParams.get("documentId");
  const [question, setQuestion] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [documentSearch, setDocumentSearch] = useState("");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<VisibleMessage[]>([]);
  const [citations, setCitations] = useState<ChatCitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userInitials, setUserInitials] = useState("CT");
  const activeRequestRef = useRef<AbortController | null>(null);
  const latestMessageRef = useRef<HTMLDivElement | null>(null);

  const getAccessToken = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      setUserInitials(initialsFromUser(data.session.user.email, data.session.user.user_metadata?.full_name));
    }
    return data.session?.access_token ?? null;
  }, []);

  function inferDocumentIdFromMessages(loadedMessages: VisibleMessage[]) {
    const assistantWithSources = [...loadedMessages]
      .reverse()
      .find((message) => message.role === "assistant" && message.citations.length > 0);

    return assistantWithSources?.citations[0]?.document_id ?? null;
  }

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
      setIsSourcesOpen(false);
      return loadedMessages;
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
        if (requestedDocumentId) {
          const createdSession = await createChatSession(accessToken);
          setSessions((current) => [createdSession, ...current]);
          setActiveSessionId(createdSession.id);
          setMessages([]);
          setCitations([]);
          setSelectedDocumentId(requestedDocumentId);
          return;
        }

        const firstSession = loadedSessions[0];
        setActiveSessionId(firstSession.id);
        const loadedMessages = await loadSessionMessages(firstSession.id, accessToken);
        const sessionDocumentId = inferDocumentIdFromMessages(loadedMessages);
        if (sessionDocumentId) {
          setSelectedDocumentId(sessionDocumentId);
        }
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
  }, [getAccessToken, loadSessionMessages, requestedDocumentId]);

  useEffect(() => {
    if (requestedQuestion) {
      setQuestion(requestedQuestion);
    }
    if (requestedDocumentId) {
      setSelectedDocumentId(requestedDocumentId);
      setDocumentSearch("");
    }
  }, [requestedDocumentId, requestedQuestion]);

  useEffect(() => {
    if (documents.length === 0) {
      return;
    }

    const readyDocuments = documents.filter((document) => document.status === "ready");
    if (selectedDocumentId && readyDocuments.some((document) => document.id === selectedDocumentId)) {
      return;
    }
    setSelectedDocumentId(null);
  }, [documents, selectedDocumentId]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    latestMessageRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages.length, isSending, error, isLoading]);

  const handleSelectSession = async (sessionId: string) => {
    if (sessionId === activeSessionId) {
      return;
    }

    setActiveSessionId(sessionId);
    setError(null);
    setIsLoading(true);

    try {
      const loadedMessages = await loadSessionMessages(sessionId);
      const sessionDocumentId = inferDocumentIdFromMessages(loadedMessages);
      setSelectedDocumentId(sessionDocumentId);
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
      setSelectedDocumentId(null);
      setDocumentSearch("");
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

    try {
      if (!selectedDocumentId) {
        throw new Error("Please choose one ready document before asking.");
      }

      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Sign in to ask questions.");
      }

      setIsSending(true);
      setQuestion("");
      const abortController = new AbortController();
      activeRequestRef.current = abortController;
      setMessages((current) => [
        ...current,
        { role: "user", content: trimmedQuestion, citations: [] }
      ]);

      let sessionId = activeSessionId;
      if (!sessionId) {
        const createdSession = await createChatSession(accessToken);
        sessionId = createdSession.id;
        setSessions((current) => [createdSession, ...current]);
        setActiveSessionId(sessionId);
      }

      const response = await sendChatMessage(accessToken, sessionId, trimmedQuestion, [selectedDocumentId], abortController.signal);
      const answer = response.answer.trim() || "Maaf, Contexta belum menerima jawaban yang bisa ditampilkan. Coba kirim ulang pertanyaannya.";
      setMessages((current) => [
        ...current,
        { role: "assistant", content: answer, citations: response.citations }
      ]);
      setCitations(response.citations);
      setIsSourcesOpen(false);
      setSessions(await listChatSessions(accessToken));
    } catch (chatError) {
      const message = chatError instanceof Error ? chatError.message : "Unable to answer question.";
      if (message === "Request canceled.") {
        setMessages((current) => [
          ...current,
          { role: "assistant", content: "Jawaban dibatalkan.", citations: [] }
        ]);
      } else {
        setError(message);
      }
    } finally {
      activeRequestRef.current = null;
      setIsSending(false);
    }
  };

  const readyDocuments = documents.filter((document) => document.status === "ready");
  const selectedDocument = readyDocuments.find((document) => document.id === selectedDocumentId) ?? null;
  const chatScopeLabel = selectedDocument?.filename ?? "Choose a document to start";
  const isComposerDisabled = isLoading || !selectedDocument;
  const normalizedDocumentSearch = documentSearch.trim().toLowerCase();
  const filteredReadyDocuments = normalizedDocumentSearch
    ? readyDocuments.filter((document) => document.filename.toLowerCase().includes(normalizedDocumentSearch))
    : readyDocuments;

  function cancelActiveResponse() {
    activeRequestRef.current?.abort();
  }

  function handleChooseDocument(documentId: string) {
    setSelectedDocumentId(documentId);
    setDocumentSearch("");
  }

  return (
    <div className="relative min-h-[calc(100vh-120px)]">
      <section className="mx-auto flex min-h-[calc(100vh-132px)] w-full max-w-4xl flex-col">
        <div className="mb-5 flex flex-col gap-3 border-b border-[#dce2f3] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Ask about</p>
            <p className="mt-1 truncate text-sm font-medium text-ink">{chatScopeLabel}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {sessions.length > 0 ? (
              <select
                className="h-9 max-w-xs rounded border border-[#c3c6d7] bg-white px-3 text-sm text-ink outline-none transition focus:border-primary"
                value={activeSessionId ?? ""}
                disabled={isLoading || isSending}
                onChange={(event) => void handleSelectSession(event.target.value)}
                aria-label="Conversation history"
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
          {!isLoading && (!selectedDocument || messages.length === 0) ? (
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-primary text-sm font-bold text-white" aria-hidden="true">
                    AI
                  </div>
                  <div className="max-w-[80%] rounded border border-[#dce2f3] bg-white px-4 py-3 text-sm leading-6 text-ink">
                    Pilih dokumen yang mau kamu analisa, lalu kita lanjut ke percakapan.
                  </div>
                </div>
              ) : null}
              {selectedDocument ? (
                messages.length === 0 ? (
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-primary text-sm font-bold text-white" aria-hidden="true">
                      AI
                    </div>
                    <div className="max-w-[80%] rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-700">
                      Siap, kita bedah <span className="font-semibold">{selectedDocument.filename}</span>. Tulis pertanyaan pertama kamu, misalnya minta ringkasan, poin penting, atau data tertentu dari dokumen ini.
                    </div>
                  </div>
                ) : null
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-primary text-sm font-bold text-white" aria-hidden="true">
                    AI
                  </div>
                  <div className="max-w-[80%] rounded border border-[#dce2f3] bg-white p-3 shadow-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-ink">Pilih dokumen</p>
                        <p className="text-xs text-subtle">{readyDocuments.length} dokumen siap dianalisa</p>
                      </div>
                      <input
                        className="h-9 rounded border border-[#c3c6d7] bg-[#f9f9ff] px-3 text-sm text-ink outline-none transition placeholder:text-subtle focus:border-primary sm:w-64"
                        placeholder="Cari nama dokumen..."
                        type="search"
                        value={documentSearch}
                        onChange={(event) => setDocumentSearch(event.target.value)}
                      />
                    </div>
                    <div className="mt-3 max-h-72 overflow-y-auto rounded border border-[#dce2f3]">
                      {readyDocuments.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-subtle">
                          Belum ada dokumen ready. Upload atau tunggu proses indexing selesai dulu.
                        </div>
                      ) : filteredReadyDocuments.length > 0 ? (
                        filteredReadyDocuments.map((document) => (
                          <button
                            key={document.id}
                            className="flex w-full items-center justify-between gap-3 border-b border-[#dce2f3] px-4 py-3 text-left transition last:border-0 hover:bg-[#f9f9ff]"
                            type="button"
                            onClick={() => handleChooseDocument(document.id)}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-ink">{document.filename}</span>
                              <span className="mt-1 block text-xs text-subtle">
                                {document.file_type.toUpperCase()} - {document.chunk_count} chunks
                              </span>
                            </span>
                            <span className="shrink-0 rounded bg-[#dbe1ff] px-2 py-1 text-xs font-semibold text-primary">
                              Select
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-subtle">Tidak ada dokumen yang cocok.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
                  {userInitials}
                </div>
              ) : null}
            </div>
          ))}
          {isSending ? (
            <div className="flex items-start gap-3 justify-start">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-primary text-sm font-bold text-white" aria-hidden="true">
                AI
              </div>
              <div className="min-w-60 max-w-[78%] rounded border border-[#dce2f3] bg-white px-4 py-3">
                <ShiningText className="sr-only" text="Contexta is thinking..." />
                <span className="text-sm leading-6 text-subtle">Contexta is thinking...</span>
              </div>
            </div>
          ) : null}
          {error ? <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
          <div ref={latestMessageRef} className="h-1" aria-hidden="true" />
        </div>

        <div className="sticky bottom-0 border-t border-[#dce2f3] bg-[#f9f9ff] py-4">
          <AIInputWithLoading
            id="chat-question"
            placeholder={selectedDocumentId ? "Ask Contexta about this document..." : "Choose a document first..."}
            disabled={isComposerDisabled}
            isLoading={isSending}
            onSubmit={handleSubmit}
            onCancel={cancelActiveResponse}
            initialValue={question}
            helperText={
              isSending
                ? "AI is thinking... click the spinning square to cancel."
                : selectedDocument
                  ? `Chatting with ${selectedDocument.filename}`
                  : "Choose one document in the chat to start."
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
