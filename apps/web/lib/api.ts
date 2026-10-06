export type DocumentStatus = "uploaded" | "processing" | "ready" | "failed";

export type DocumentType =
  | "unclassified"
  | "sop"
  | "policy"
  | "contract"
  | "report"
  | "thesis"
  | "reference"
  | "other";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  unclassified: "Unclassified",
  sop: "SOP",
  policy: "Policy",
  contract: "Contract",
  report: "Report",
  thesis: "Thesis / paper",
  reference: "Reference",
  other: "Other"
};

export type DocumentItem = {
  id: string;
  user_id: string;
  filename: string;
  file_type: "pdf" | "docx";
  file_size: number;
  storage_path: string;
  status: DocumentStatus;
  error_message: string | null;
  chunk_count: number;
  doc_type: DocumentType;
  source_url: string | null;
  doc_version: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentIntelligence = {
  document_id: string;
  filename: string;
  status: DocumentStatus;
  chunk_count: number;
  summary: string;
  key_points: string[];
  emails: string[];
  links: string[];
  candidate_names: string[];
  top_pages: number[];
  suggested_questions: string[];
};

export type DocumentAIBrief = {
  document_id: string;
  brief: string;
};

export type DocumentChunkRow = {
  chunk_index: number;
  page_number: number | null;
  char_count: number;
  preview: string;
};

export type DocumentChunksPage = {
  document_id: string;
  total: number;
  page: number;
  page_size: number;
  items: DocumentChunkRow[];
};

export type MarkdownConversion = {
  filename: string;
  markdown: string;
  size_bytes: number;
  output_filename: string;
};

export type IndexingHealth = {
  status: "ok" | "attention";
  service: "indexing";
  source: "supabase" | "in_memory" | "unknown";
  processing_documents: number;
  queued_documents: number;
  stale_processing_documents: number;
  stale_after_minutes: number;
  checked_at: string;
};

export type ServiceHealth = {
  status: "ok" | "unavailable";
  service: string;
};

export type ChatCitation = {
  source_number: number;
  document_id: string;
  document_name: string;
  chunk_index: number;
  page_number: number | null;
  text: string;
  score: number;
};

export type ChatQueryResponse = {
  answer: string;
  citations: ChatCitation[];
};

export type ChatSession = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  session_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  citations: ChatCitation[];
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ChatSessionMessageResponse = ChatQueryResponse & {
  session_id: string;
};

/** Rows per page in the chunk table; matches the API default. */
export const CHUNK_PAGE_SIZE = 20;

export function apiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";
}

const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
const CHAT_ANSWER_TIMEOUT_MS = 120000;
/** Multipart uploads wait on the user's uplink: 50 MB at a slow connection is minutes, not seconds. */
const FILE_TRANSFER_TIMEOUT_MS = 300000;

function apiBaseUrls() {
  const primaryUrl = apiBaseUrl().replace(/\/$/, "");
  const urls = [primaryUrl];

  try {
    const parsedUrl = new URL(primaryUrl);
    if (parsedUrl.hostname === "127.0.0.1") {
      parsedUrl.hostname = "localhost";
      urls.push(parsedUrl.toString().replace(/\/$/, ""));
    } else if (parsedUrl.hostname === "localhost") {
      parsedUrl.hostname = "127.0.0.1";
      urls.push(parsedUrl.toString().replace(/\/$/, ""));
    }
  } catch {
    return urls;
  }

  return Array.from(new Set(urls));
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const requestSignal = init.signal;

  function handleRequestAbort() {
    controller.abort();
  }

  if (requestSignal) {
    if (requestSignal.aborted) {
      controller.abort();
    } else {
      requestSignal.addEventListener("abort", handleRequestAbort, { once: true });
    }
  }

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(requestSignal?.aborted ? "Request canceled." : "Request timed out. Please try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    requestSignal?.removeEventListener("abort", handleRequestAbort);
  }
}

async function fetchApi(path: string, init: RequestInit = {}, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
  let lastError: unknown = null;

  for (const baseUrl of apiBaseUrls()) {
    try {
      return await fetchWithTimeout(`${baseUrl}${path}`, init, timeoutMs);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error && lastError.message.includes("timed out")) {
    throw lastError;
  }

  throw new Error(`Unable to reach Contexta API at ${apiBaseUrls().join(" or ")}. Make sure the API server is running.`);
}

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { detail?: unknown; message?: unknown };
    if (typeof body.detail === "string") {
      return body.detail;
    }
    if (typeof body.message === "string") {
      return body.message;
    }
    if (Array.isArray(body.detail)) {
      return body.detail
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }
          if (item && typeof item === "object" && "msg" in item && typeof item.msg === "string") {
            return item.msg;
          }
          return null;
        })
        .filter(Boolean)
        .join(", ");
    }
  } catch {
    return fallback;
  }

  return fallback;
}

export async function listDocuments(accessToken: string) {
  const response = await fetchApi("/documents", {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to load documents."));
  }

  return (await response.json()) as DocumentItem[];
}

export async function getIndexingHealth() {
  const response = await fetchApi("/health/indexing", {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to load indexing health."));
  }

  return (await response.json()) as IndexingHealth;
}

export async function getApiHealth() {
  const response = await fetchApi("/health", {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to reach the API."));
  }

  return (await response.json()) as ServiceHealth;
}

export async function getVectorHealth() {
  const response = await fetchApi("/health/vector", {
    cache: "no-store"
  });

  // An unreachable vector store is an honest 503 with a body, not a transport failure.
  return (await response.json()) as ServiceHealth;
}

export async function getDocument(accessToken: string, documentId: string) {
  const response = await fetchApi(`/documents/${documentId}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to load document."));
  }

  return (await response.json()) as DocumentItem;
}

export async function getDocumentIntelligence(accessToken: string, documentId: string) {
  const response = await fetchApi(`/documents/${documentId}/intelligence`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to load document intelligence."));
  }

  return (await response.json()) as DocumentIntelligence;
}

export async function listDocumentChunks(
  accessToken: string,
  documentId: string,
  page: number,
  pageSize: number = CHUNK_PAGE_SIZE
) {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  const response = await fetchApi(`/documents/${documentId}/chunks?${query.toString()}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to load document chunks."));
  }

  return (await response.json()) as DocumentChunksPage;
}

export async function generateDocumentAIBrief(accessToken: string, documentId: string) {
  const response = await fetchApi(`/documents/${documentId}/brief`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  }, CHAT_ANSWER_TIMEOUT_MS);

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to generate AI brief."));
  }

  return (await response.json()) as DocumentAIBrief;
}

export async function uploadDocument(
  accessToken: string,
  file: File,
  docType: DocumentType = "unclassified"
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("doc_type", docType);

  const response = await fetchApi("/documents/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: formData
  }, FILE_TRANSFER_TIMEOUT_MS);

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to upload document."));
  }

  return (await response.json()) as DocumentItem;
}

export async function convertPdfToMarkdown(accessToken: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetchApi("/convert/markdown", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: formData
  }, FILE_TRANSFER_TIMEOUT_MS);

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to convert PDF to Markdown."));
  }

  return (await response.json()) as MarkdownConversion;
}

export async function deleteDocument(accessToken: string, documentId: string) {
  const response = await fetchApi(`/documents/${documentId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to delete document."));
  }
}

export async function retryDocument(accessToken: string, documentId: string) {
  const response = await fetchApi(`/documents/${documentId}/retry`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to retry document."));
  }

  return (await response.json()) as DocumentItem;
}

export async function queryChat(accessToken: string, question: string) {
  const response = await fetchApi("/chat/query", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ question })
  }, CHAT_ANSWER_TIMEOUT_MS);

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to answer question."));
  }

  return (await response.json()) as ChatQueryResponse;
}

export async function listChatSessions(accessToken: string) {
  const response = await fetchApi("/chat/sessions", {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to load chat sessions."));
  }

  return (await response.json()) as ChatSession[];
}

export async function createChatSession(accessToken: string, title = "New chat") {
  const response = await fetchApi("/chat/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ title })
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to create chat session."));
  }

  return (await response.json()) as ChatSession;
}

export async function listChatMessages(accessToken: string, sessionId: string) {
  const response = await fetchApi(`/chat/sessions/${sessionId}/messages`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to load chat messages."));
  }

  return (await response.json()) as ChatMessage[];
}

export async function sendChatMessage(accessToken: string, sessionId: string, question: string, documentIds?: string[], signal?: AbortSignal) {
  const response = await fetchApi(`/chat/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ question, document_ids: documentIds }),
    signal
  }, CHAT_ANSWER_TIMEOUT_MS);

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to answer question."));
  }

  return (await response.json()) as ChatSessionMessageResponse;
}
