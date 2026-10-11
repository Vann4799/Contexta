export type DocumentStatus = "uploaded" | "processing" | "ready" | "failed" | "trashed";

export type DocumentType =
  | "unclassified"
  | "sop"
  | "policy"
  | "contract"
  | "report"
  | "thesis"
  | "reference"
  | "other";

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
  section_path?: string | null;
  is_table?: boolean;
  char_count: number;
  token_count?: number | null;
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

/** One vector slot of the active Qdrant collection, as Qdrant itself reports it. */
export type VectorSpaceInfo = {
  name: string;
  /** Null until Qdrant's own collection config confirmed the slot. */
  dimensions: number | null;
  model: string;
};

export type VectorHealth = ServiceHealth & {
  collection?: string | null;
  points_count?: number | null;
  vector_spaces?: VectorSpaceInfo[];
};

export type ChatCitation = {
  source_number: number;
  document_id: string;
  document_name: string;
  chunk_index: number;
  page_number: number | null;
  doc_type?: DocumentType;
  section_path?: string | null;
  text: string;
  score: number;
};

export type ChatQueryResponse = {
  answer: string;
  citations: ChatCitation[];
  truncated?: boolean;
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

// Compared by identity in the chat panel to tell "user cancelled" from a real failure, so
// this stays a stable protocol marker and must never be routed through the UI dictionaries.
export const REQUEST_CANCELED_MESSAGE = "Request canceled.";

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
      throw new Error(requestSignal?.aborted ? REQUEST_CANCELED_MESSAGE : "Request timed out. Please try again.");
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
    // The metered /v1 surface and the key routes answer with { detail: { code, message } }.
    if (body.detail && typeof body.detail === "object" && !Array.isArray(body.detail)) {
      const message = (body.detail as { message?: unknown }).message;
      if (typeof message === "string") {
        return message;
      }
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
  return (await response.json()) as VectorHealth;
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

export async function updateDocumentMetadata(
  accessToken: string,
  documentId: string,
  changes: Partial<Pick<DocumentItem, "doc_type" | "source_url" | "doc_version">>
) {
  const response = await fetchApi(`/documents/${documentId}/metadata`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(changes)
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to update document metadata."));
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

export async function trashDocument(accessToken: string, documentId: string) {
  const response = await fetchApi(`/documents/${documentId}/trash`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to move document to trash."));
  }

  return (await response.json()) as DocumentItem;
}

export async function restoreDocument(accessToken: string, documentId: string) {
  const response = await fetchApi(`/documents/${documentId}/restore`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to restore document."));
  }

  return (await response.json()) as DocumentItem;
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

export async function reindexDocument(accessToken: string, documentId: string) {
  const response = await fetchApi(`/documents/${documentId}/reindex`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to re-index this document."));
  }

  return (await response.json()) as DocumentItem;
}

export type DocumentExportFormat = "md" | "jsonl";

export interface ExportedFile {
  blob: Blob;
  filename: string;
}

/** The API names the download with RFC 5987 (`filename*=UTF-8''...`) so unicode and spaces survive. */
function filenameFromDisposition(header: string | null) {
  if (!header) {
    return null;
  }

  const extended = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (extended) {
    try {
      return decodeURIComponent(extended[1].trim().replace(/^"|"$/g, ""));
    } catch {
      return extended[1].trim();
    }
  }

  const quoted = /filename="([^"]+)"/i.exec(header);
  return quoted ? quoted[1] : null;
}

async function fetchExport(path: string, accessToken: string, fallbackName: string): Promise<ExportedFile> {
  const response = await fetchApi(path, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  }, FILE_TRANSFER_TIMEOUT_MS);

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to export."));
  }

  return {
    blob: await response.blob(),
    filename: filenameFromDisposition(response.headers.get("content-disposition")) ?? fallbackName
  };
}

export async function exportWorkspace(accessToken: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  return fetchExport("/export/workspace", accessToken, `contexta-workspace-${stamp}.zip`);
}

export async function exportDocument(
  accessToken: string,
  documentId: string,
  format: DocumentExportFormat,
  filename: string
) {
  return fetchExport(
    `/documents/${documentId}/export?format=${format}`,
    accessToken,
    `${filename.replace(/\.[^.]+$/, "")}.${format}`
  );
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

export type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  last_four: string;
  document_ids: string[];
  scopes: string[];
  revoked_at: string | null;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
};

export type CreatedApiKey = ApiKey & { api_key: string };

export type ApiKeyUsage = {
  key_id: string;
  days: number;
  total: number;
  allowed: number;
  rejected: number;
  by_outcome: Record<string, number>;
  by_day: { date: string; allowed: number; rejected: number }[];
};

export async function listApiKeys(accessToken: string): Promise<ApiKey[]> {
  const response = await fetchApi("/api-keys", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to load API keys."));
  }

  return (await response.json()) as ApiKey[];
}

export async function createApiKey(
  accessToken: string,
  name: string,
  documentIds: string[]
): Promise<CreatedApiKey> {
  const response = await fetchApi("/api-keys", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, document_ids: documentIds })
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to create an API key."));
  }

  return (await response.json()) as CreatedApiKey;
}

export async function revokeApiKey(accessToken: string, keyId: string): Promise<ApiKey> {
  const response = await fetchApi(`/api-keys/${keyId}/revoke`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to revoke this key."));
  }

  return (await response.json()) as ApiKey;
}

export async function getApiKeyUsage(accessToken: string, keyId: string, days = 14): Promise<ApiKeyUsage> {
  const response = await fetchApi(`/api-keys/${keyId}/usage?days=${days}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to load key usage."));
  }

  return (await response.json()) as ApiKeyUsage;
}

export type AccountSummary = {
  documents: {
    total: number;
    by_status: Record<DocumentStatus, number>;
  };
  chunks: number;
  storage_bytes: number;
  top_doc_type: { doc_type: DocumentType; documents: number } | null;
  sessions: number;
  activity: {
    uploads_7d: number;
    indexed_7d: number;
    chats_7d: number;
    last_upload_at: string | null;
    last_index_at: string | null;
    last_chat_at: string | null;
  };
  developer: {
    api_keys_active: number;
    api_requests_14d: number;
  };
};

export async function getAccountSummary(accessToken: string): Promise<AccountSummary> {
  const response = await fetchApi("/account/summary", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to load account summary."));
  }

  return (await response.json()) as AccountSummary;
}

export async function deleteAccount(accessToken: string): Promise<void> {
  const response = await fetchApi("/account", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to delete account."));
  }
}

export type ActivityEventType =
  | "document_uploaded"
  | "document_processing"
  | "document_ready"
  | "document_failed"
  | "document_trashed"
  | "chat_message"
  | "api_request";

export type ActivityEvent = {
  id: string;
  event_type: ActivityEventType;
  user_id: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type ActivityFeed = {
  events: ActivityEvent[];
  total: number;
  has_more: boolean;
};

export async function getActivityEvents(
  accessToken: string,
  limit = 50,
  offset = 0
): Promise<ActivityFeed> {
  const response = await fetchApi(`/activity?limit=${limit}&offset=${offset}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to load activity feed."));
  }

  return (await response.json()) as ActivityFeed;
}

export type NotificationType = "document_ready" | "document_failed" | "quota_warning" | "system";

export type NotificationItem = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
};

export type NotificationList = {
  notifications: NotificationItem[];
  unread_count: number;
};

export async function getNotifications(accessToken: string, limit = 20): Promise<NotificationList> {
  const response = await fetchApi(`/notifications?limit=${limit}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to load notifications."));
  }

  return (await response.json()) as NotificationList;
}

export async function markNotificationRead(accessToken: string, notificationId: string): Promise<NotificationItem> {
  const response = await fetchApi(`/notifications/${notificationId}/read`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to mark notification as read."));
  }

  return (await response.json()) as NotificationItem;
}

export async function markAllNotificationsRead(accessToken: string): Promise<void> {
  const response = await fetchApi("/notifications/read-all", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to mark all notifications as read."));
  }
}

export type PlanTier = "free" | "pro" | "enterprise";

export type PlanLimits = {
  max_documents: number;
  max_storage_bytes: number;
  max_api_keys: number;
  max_api_requests_per_day: number;
  max_chat_messages_per_day: number;
};

export type Plan = {
  tier: PlanTier;
  name: string;
  price_monthly: number;
  price_yearly: number;
  limits: PlanLimits;
};

export type Subscription = {
  id: string;
  user_id: string;
  plan_tier: PlanTier;
  status: "active" | "cancelled" | "past_due" | "trialing";
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
};

export type UsageSummary = {
  documents_count: number;
  storage_bytes: number;
  api_keys_count: number;
  api_requests_today: number;
  chat_messages_today: number;
};

export type BillingStatus = {
  subscription: Subscription | null;
  plan: Plan;
  usage: UsageSummary;
  overages: Record<string, boolean>;
};

export async function getBillingPlans(): Promise<Plan[]> {
  const response = await fetchApi("/billing/plans", { cache: "no-store" });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to load plans."));
  }

  return (await response.json()) as Plan[];
}

export async function getBillingStatus(accessToken: string): Promise<BillingStatus> {
  const response = await fetchApi("/billing/status", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to load billing status."));
  }

  return (await response.json()) as BillingStatus;
}

export type IntegrationProvider = "slack" | "notion" | "google_drive" | "github";
export type IntegrationStatus = "connected" | "disconnected" | "error";

export type IntegrationDefinition = {
  provider: IntegrationProvider;
  name: string;
  description: string;
  icon: string;
  scopes: string[];
  oauth_supported: boolean;
};

export type IntegrationConnection = {
  id: string;
  user_id: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  external_user_id: string | null;
  external_user_name: string | null;
  external_user_email: string | null;
  scopes: string[];
  metadata: Record<string, unknown> | null;
  connected_at: string | null;
  last_synced_at: string | null;
  error_message: string | null;
};

export type IntegrationListResponse = {
  definitions: IntegrationDefinition[];
  connections: IntegrationConnection[];
};

export async function getIntegrations(accessToken: string): Promise<IntegrationListResponse> {
  const response = await fetchApi("/integrations", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to load integrations."));
  }

  return (await response.json()) as IntegrationListResponse;
}

export async function connectIntegration(
  accessToken: string,
  provider: IntegrationProvider,
  oauthCode?: string
): Promise<IntegrationConnection> {
  const response = await fetchApi("/integrations/connect", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ provider, oauth_code: oauthCode ?? null }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to connect integration."));
  }

  return (await response.json()) as IntegrationConnection;
}

export async function disconnectIntegration(
  accessToken: string,
  provider: IntegrationProvider
): Promise<void> {
  const response = await fetchApi(`/integrations/${provider}/disconnect`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to disconnect integration."));
  }
}

/**
 * The origin a machine caller reaches. The browser itself talks to a same-origin proxy,
 * so apiBaseUrl() is the wrong thing to print inside a curl example.
 */
export function publicApiBaseUrl() {
  return process.env.NEXT_PUBLIC_PUBLIC_API_BASE_URL || "https://api.3.27.119.26.sslip.io";
}
