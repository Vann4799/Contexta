"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { uploadDocument, listDocuments, type DocumentItem, type DocumentStatus } from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";

const allowedExtensions = new Set(["pdf", "docx"]);
const maxUploadBytes = 50 * 1024 * 1024;
const missingConfigMessage = "Document uploads are not configured yet. Please contact an administrator.";

function statusForPill(status: DocumentStatus) {
  return status === "uploaded" ? "processing" : status;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function getExtension(filename: string) {
  return filename.split(".").pop()?.toLowerCase() || "";
}

function uploadErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  if (error.message.includes("NEXT_PUBLIC_SUPABASE_")) {
    return missingConfigMessage;
  }

  return error.message;
}

export function DocumentUploadPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const getAccessToken = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setDocuments([]);
        setError("Sign in to view and upload documents.");
        return;
      }

      setDocuments(await listDocuments(accessToken));
    } catch (loadError) {
      setError(uploadErrorMessage(loadError, "Unable to load documents."));
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const handleUpload = async (file: File) => {
    setError(null);
    setSuccess(null);

    if (!allowedExtensions.has(getExtension(file.name))) {
      setError("Only PDF and DOCX files are supported.");
      return;
    }

    if (file.size === 0) {
      setError("The selected file is empty.");
      return;
    }

    if (file.size > maxUploadBytes) {
      setError("Files must be 50 MB or smaller.");
      return;
    }

    setIsUploading(true);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError("Sign in to view and upload documents.");
        return;
      }

      const uploadedDocument = await uploadDocument(accessToken, file);
      setDocuments((currentDocuments) => [uploadedDocument, ...currentDocuments]);
      setSuccess(`${uploadedDocument.filename} uploaded.`);
    } catch (uploadError) {
      setError(uploadErrorMessage(uploadError, "Unable to upload document."));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <section className="rounded-contexta border border-border bg-white">
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold">Upload and Manage</h2>
          <p className="mt-1 text-sm text-subtle">Upload PDF and DOCX documents for grounded chats.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <input
            ref={fileInputRef}
            className="block w-full rounded border border-border bg-white text-sm text-subtle file:mr-3 file:h-10 file:border-0 file:bg-muted file:px-3 file:text-sm file:font-medium file:text-ink hover:file:bg-border sm:w-72"
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            disabled={isUploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleUpload(file);
              }
            }}
          />
          <Button className="w-full sm:w-auto" disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
            {isUploading ? "Uploading..." : "Choose File"}
          </Button>
        </div>
      </div>

      <div className="border-b border-border px-5 py-3 text-sm">
        {isLoading ? <p className="text-subtle">Loading documents...</p> : null}
        {isUploading ? <p className="text-subtle">Uploading document...</p> : null}
        {success ? <p className="text-emerald-700">{success}</p> : null}
        {error ? <p className="text-red-700">{error}</p> : null}
        {!isLoading && !isUploading && !success && !error ? <p className="text-subtle">Ready for uploads.</p> : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-muted text-xs font-medium uppercase text-subtle">
            <tr>
              <th className="px-5 py-3">Filename</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Size</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {documents.length > 0 ? (
              documents.map((document) => (
                <tr key={document.id} className="border-b border-border last:border-0">
                  <td className="max-w-[320px] truncate px-5 py-3 font-medium">
                    <Link className="text-primary hover:underline" href={`/documents/${document.id}`}>
                      {document.filename}
                    </Link>
                  </td>
                  <td className="px-5 py-3 uppercase text-subtle">{document.file_type}</td>
                  <td className="px-5 py-3 text-subtle">{formatBytes(document.file_size)}</td>
                  <td className="px-5 py-3">
                    <StatusPill status={statusForPill(document.status)} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-5 py-8 text-center text-subtle" colSpan={4}>
                  {isLoading ? "Loading documents..." : "No documents uploaded yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
