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
  REQUEST_CANCELED_MESSAGE,
  type ChatCitation,
  type DocumentItem,
  type ChatMessage,
  type ChatSession
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { Dictionary } from "@/locales/en";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useServerError } from "@/lib/server-errors";
import { Button } from "@/components/ui/button";
import { AIInputWithLoading } from "@/components/ui/ai-input-with-loading";
import { ShiningText } from "@/components/ui/shining-text";

type VisibleMessage = Pick<ChatMessage, "role" | "content" | "citations">;

function initialsFromUser(email?: string, fullName?: string) {
  const source = fullName?.trim() || email?.split("@")[0] || "Contexta";
  const words = source.split(/[\s._-]+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "CT";
}

type MessageSegment = { kind: "text"; value: string } | { kind: "source"; number: number };

const CITATION_MARKER = /\[Source\s+(\d+)\]/g;

function splitCitationMarkers(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let cursor = 0;
  for (const match of content.matchAll(CITATION_MARKER)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      segments.push({ kind: "text", value: content.slice(cursor, start) });
    }
    segments.push({ kind: "source", number: Number(match[1]) });
    cursor = start + match[0].length;
  }
  if (cursor < content.length) {
    segments.push({ kind: "text", value: content.slice(cursor) });
  }
  return segments;
}

function citationLabel(citation: ChatCitation, t: Dictionary["chat"]) {
  const trail = [citation.document_name];
  if (citation.section_path) trail.push(citation.section_path);
  if (citation.page_number) trail.push(t.page(citation.page_number));
  return `${t.source} ${citation.source_number} — ${trail.join(", ")}`;
}

function CitationChip({
  marker,
  citation,
  onCite
}: {
  marker: number;
  citation?: ChatCitation;
  onCite: () => void;
}) {
  const t = useT().chat;

  if (!citation) {
    return <span className="nums">[Source {marker}]</span>;
  }

  const label = citationLabel(citation, t);

  return (
    <button
      aria-label={t.openSource(marker, label)}
      className="focus-ring nums ml-1 inline-flex shrink-0 items-center rounded-chip bg-accent px-1.5 py-0.5 align-baseline text-[11px] font-bold text-ink transition hover:brightness-95"
      onClick={onCite}
      title={label}
      type="button"
    >
      S{citation.source_number}
    </button>
  );
}

export function ChatWorkspace() {
  const t = useT().chat;
  const serverError = useServerError();
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
  const [highlightedSource, setHighlightedSource] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userInitials, setUserInitials] = useState("CT");
  const activeRequestRef = useRef<AbortController | null>(null);
  const latestMessageRef = useRef<HTMLDivElement | null>(null);

  const getAccessToken = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
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

  function focusCitedSource(messageCitations: ChatCitation[], sourceNumber: number) {
    setCitations(messageCitations);
    setIsSourcesOpen(true);
    setHighlightedSource(sourceNumber);
    document
      .getElementById(`chat-source-${sourceNumber}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  useEffect(() => {
    if (highlightedSource === null) return;
    const timeout = setTimeout(() => setHighlightedSource(null), 1600);
    return () => clearTimeout(timeout);
  }, [highlightedSource]);

  const loadSessionMessages = useCallback(
    async (sessionId: string, accessToken?: string) => {
      const token = accessToken ?? (await getAccessToken());
      if (!token) {
        throw new Error("signInToLoadHistory");
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
          throw new Error("signInToLoadChat");
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
          setError(chatError instanceof Error ? chatError.message : "unableToLoadChat");
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
      setError(chatError instanceof Error ? chatError.message : "unableToLoadMessages");
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
        throw new Error("signInToCreateChat");
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
      setError(chatError instanceof Error ? chatError.message : "unableToCreateChat");
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
        throw new Error("chooseDocumentBeforeAsking");
      }

      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("signInToAsk");
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
      const answer = response.answer.trim() || t.emptyAnswer;
      setMessages((current) => [
        ...current,
        { role: "assistant", content: answer, citations: response.citations }
      ]);
      setCitations(response.citations);
      setIsSourcesOpen(false);
      setSessions(await listChatSessions(accessToken));
    } catch (chatError) {
      const message = chatError instanceof Error ? chatError.message : "unableToAnswer";
      if (message === REQUEST_CANCELED_MESSAGE) {
        setMessages((current) => [
          ...current,
          { role: "assistant", content: t.answerCancelled, citations: [] }
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
  const chatScopeLabel = selectedDocument?.filename ?? t.chooseDocumentToStart;
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
        <div className="mb-4 flex flex-col gap-3 border-b border-paper-line pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="eyebrow">{t.askAbout}</p>
            <p className="mt-1 truncate text-[13.5px] font-medium">{chatScopeLabel}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {sessions.length > 0 ? (
              <select
                className="focus-ring h-9 max-w-xs rounded-control border border-paper-line bg-paper-soft px-3 text-[13px] outline-none"
                value={activeSessionId ?? ""}
                disabled={isLoading || isSending}
                onChange={(event) => void handleSelectSession(event.target.value)}
                aria-label={t.conversationHistory}
              >
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.title}
                  </option>
                ))}
              </select>
            ) : null}
            <Button disabled={isLoading || isSending} onClick={() => void handleNewChat()} variant="secondary">
              {t.newChat}
            </Button>
            <Button onClick={() => setIsSourcesOpen(true)} type="button" variant="secondary">
              {t.sourcesTitle} {citations.length > 0 ? `(${citations.length})` : ""}
            </Button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto pb-6">
          {isLoading ? <p className="text-[13px] text-ink-muted">{t.loading}</p> : null}
          {!isLoading && (!selectedDocument || messages.length === 0) ? (
            <div className="flex flex-col gap-4">
              {messages.length === 0 ? (
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-night font-mono text-[11px] font-bold text-accent" aria-hidden="true">
                    AI
                  </div>
                  <div className="max-w-[80%] rounded-card border border-paper-line bg-paper-card px-4 py-3 text-[13.5px] leading-6 shadow-card">
                    {t.pickDocumentFirst}
                  </div>
                </div>
              ) : null}
              {selectedDocument ? (
                messages.length === 0 ? (
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-night font-mono text-[11px] font-bold text-accent" aria-hidden="true">
                      AI
                    </div>
                    <div className="max-w-[80%] rounded-card border border-paper-line bg-accent px-4 py-3 text-[13.5px] leading-6 text-ink shadow-card">
                      {t.readyBefore} <span className="font-semibold">{selectedDocument.filename}</span>
                      {t.readyAfter}
                    </div>
                  </div>
                ) : null
              ) : (
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-night font-mono text-[11px] font-bold text-accent" aria-hidden="true">
                    AI
                  </div>
                  <div className="surface max-w-[80%] min-w-0 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-semibold">{t.chooseDocument}</p>
                        <p className="nums text-[12px] text-ink-muted">{t.readyCount(readyDocuments.length)}</p>
                      </div>
                      <input
                        className="focus-ring h-9 rounded-control border border-paper-line bg-paper-soft px-3 text-[13px] placeholder:text-ink-faint sm:w-64"
                        placeholder={t.searchPlaceholder}
                        type="search"
                        value={documentSearch}
                        onChange={(event) => setDocumentSearch(event.target.value)}
                      />
                    </div>
                    <div className="mt-3 max-h-72 overflow-y-auto rounded-control border border-paper-line">
                      {readyDocuments.length === 0 ? (
                        <div className="px-4 py-3 text-[13px] text-ink-muted">
                          {t.noReadyDocuments}
                        </div>
                      ) : filteredReadyDocuments.length > 0 ? (
                        filteredReadyDocuments.map((document) => (
                          <button
                            key={document.id}
                            className="flex w-full items-center justify-between gap-3 border-b border-paper-line/60 px-4 py-3 text-left transition-colors last:border-0 hover:bg-paper-chip"
                            type="button"
                            onClick={() => handleChooseDocument(document.id)}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-[13.5px] font-medium">{document.filename}</span>
                              <span className="nums mt-1 block font-mono text-[11.5px] text-ink-muted">
                                {document.file_type.toUpperCase()} · {document.chunk_count} chunks
                              </span>
                            </span>
                            <span className="shrink-0 rounded-chip bg-accent px-2 py-1 text-[11px] font-bold text-ink">
                              {t.select}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-[13px] text-ink-muted">{t.noMatch}</div>
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
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-night font-mono text-[11px] font-bold text-accent" aria-hidden="true">
                  AI
                </div>
              ) : null}
              <div
                className={`max-w-[78%] whitespace-pre-line rounded-card px-4 py-3 text-[13.5px] leading-6 ${
                  message.role === "user"
                    ? "bg-night text-white shadow-node"
                    : "border border-paper-line bg-paper-card text-ink shadow-card"
                }`}
              >
                {message.role === "assistant"
                  ? splitCitationMarkers(message.content).map((segment, segmentIndex) =>
                      segment.kind === "text" ? (
                        segment.value
                      ) : (
                        <CitationChip
                          key={`source-${segment.number}-${segmentIndex}`}
                          citation={message.citations.find(
                            (item) => item.source_number === segment.number
                          )}
                          marker={segment.number}
                          onCite={() => focusCitedSource(message.citations, segment.number)}
                        />
                      )
                    )
                  : message.content}
              </div>
              {message.role === "user" ? (
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-paper-chip font-mono text-[11px] font-bold text-ink-muted" aria-hidden="true">
                  {userInitials}
                </div>
              ) : null}
            </div>
          ))}
          {isSending ? (
            <div className="flex items-start gap-3 justify-start">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-night font-mono text-[11px] font-bold text-accent" aria-hidden="true">
                AI
              </div>
              <div className="min-w-60 max-w-[78%] rounded-card border border-paper-line bg-paper-card px-4 py-3 shadow-card">
                <ShiningText className="sr-only" text={t.thinking} />
                <span className="text-[13.5px] leading-6 text-ink-muted">{t.thinking}</span>
              </div>
            </div>
          ) : null}
          {error ? (
            <p className="rounded-card border border-danger-line bg-danger-soft px-4 py-3 text-[13px] text-danger" role="alert">
              {t.errors[error as keyof typeof t.errors] ?? serverError(error)}
            </p>
          ) : null}
          <div ref={latestMessageRef} className="h-1" aria-hidden="true" />
        </div>

        <div className="sticky bottom-0 border-t border-paper-line bg-paper py-4">
          <AIInputWithLoading
            id="chat-question"
            placeholder={selectedDocumentId ? t.askPlaceholderWithDoc : t.askPlaceholderNoDoc}
            disabled={isComposerDisabled}
            isLoading={isSending}
            onSubmit={handleSubmit}
            onCancel={cancelActiveResponse}
            initialValue={question}
            helperText={
              isSending
                ? t.cancelHelper
                : selectedDocument
                  ? t.chattingWith(selectedDocument.filename)
                  : t.chooseOneHelper
            }
          />
        </div>
      </section>

      {isSourcesOpen ? (
        <button
          className="fixed inset-0 z-30 bg-black/10 lg:hidden"
          type="button"
          aria-label={t.closeOverlay}
          onClick={() => setIsSourcesOpen(false)}
        />
      ) : null}
      <aside
        className={`fixed bottom-0 right-0 top-0 z-40 w-full max-w-md border-l border-paper-line bg-paper-card shadow-root transition-transform duration-200 ${
          isSourcesOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label={t.sourceDrawer}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-paper-line px-5 py-4">
            <div className="min-w-0">
              <p className="eyebrow">{t.sourceDrawer}</p>
              <h2 className="mt-1 text-[17px] font-semibold tracking-tight">{t.sourcesTitle}</h2>
            </div>
            <Button onClick={() => setIsSourcesOpen(false)} type="button" variant="ghost">
              {t.close}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {citations.length > 0 ? (
              <div className="flex flex-col gap-3">
                {citations.map((citation) => (
                  <article
                    id={`chat-source-${citation.source_number}`}
                    key={`${citation.document_id}-${citation.chunk_index}`}
                    className={`rounded-control border bg-paper-soft p-3 transition-shadow ${
                      highlightedSource === citation.source_number
                        ? "border-accent ring-2 ring-accent"
                        : "border-paper-line"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link className="min-w-0 truncate text-[13.5px] font-medium hover:underline" href={`/documents/${citation.document_id}`}>
                        {citation.document_name}
                      </Link>
                      <span className="nums shrink-0 rounded-chip bg-accent px-2 py-0.5 text-[11px] font-bold text-ink">
                        #{citation.source_number}
                      </span>
                    </div>
                    <p className="nums mt-1 font-mono text-[11.5px] text-ink-muted">
                      {citation.section_path ? `${citation.section_path} · ` : ""}
                      {citation.page_number ? t.page(citation.page_number) : t.pageUnknown} · {t.score(citation.score.toFixed(2))}
                    </p>
                    <p className="mt-2 line-clamp-6 text-[13px] leading-5 text-ink-muted">{citation.text}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-ink-muted">{t.citationsEmpty}</p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
