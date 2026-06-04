export type DocumentStatus = "uploaded" | "processing" | "ready" | "failed";

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
  created_at: string;
  updated_at: string;
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

export function apiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
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
  const response = await fetch(`${apiBaseUrl()}/documents`, {
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

export async function uploadDocument(accessToken: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${apiBaseUrl()}/documents/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to upload document."));
  }

  return (await response.json()) as DocumentItem;
}

export async function queryChat(accessToken: string, question: string) {
  const response = await fetch(`${apiBaseUrl()}/chat/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ question })
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Unable to answer question."));
  }

  return (await response.json()) as ChatQueryResponse;
}
