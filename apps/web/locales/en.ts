import type { DocumentType } from "@/lib/api";

export const en = {
  common: {
    language: "Language",
    status: {
      ready: "Ready",
      processing: "Processing",
      failed: "Failed"
    },
    docTypes: {
      unclassified: "Unclassified",
      sop: "SOP",
      policy: "Policy",
      contract: "Contract",
      report: "Report",
      thesis: "Thesis / paper",
      reference: "Reference",
      other: "Other"
    } satisfies Record<DocumentType, string>,
  },
  shell: {
    home: "Contexta home",
    primaryNav: "Primary",
    mobileNav: "Mobile primary",
    openNav: "Open navigation",
    closeNav: "Close navigation",
    accountMenu: "Account menu",
    signedIn: "Signed in",
    profile: "Profile",
    settings: "Settings",
    help: "Help",
    signOut: "Sign out",
    signingOut: "Signing out",
    signOutFailed: "Sign out failed.",
    checkingTitle: "Checking access",
    checkingBody: "Please sign in to open your Contexta workspace.",
    nav: {
      dashboard: "Dashboard",
      pipeline: "Pipeline",
      documents: "Documents",
      chat: "Chat",
      convert: "Convert",
      apiKeys: "API keys"
    }
  },
  auth: {
    emailAddress: "Email address",
    email: "Email",
    emailPlaceholder: "you@company.com",
    fullName: "Full name",
    fullNamePlaceholder: "Your name",
    password: "Password",
    passwordPlaceholder: "Password",
    show: "Show",
    hide: "Hide",
    showPassword: "Show password",
    hidePassword: "Hide password",
    submitting: "Working...",
    fallbackError: "Something went wrong. Please try again.",
    login: {
      button: "Sign in to Contexta",
      error: "Enter your email and password.",
      success: "Signed in. Taking you to your dashboard."
    },
    register: {
      button: "Create Contexta account",
      error: "Enter your name, email, and password.",
      success: "Account created. Check your email to confirm your account."
    },
    reset: {
      button: "Send reset link",
      error: "Enter your email.",
      success: "Password reset link sent. Check your inbox."
    },
    hero: {
      eyebrow: "Private document intelligence",
      titleLead: "Turn private documents into",
      titleAccent: "clear decisions",
      titleTail: ".",
      subtitle: "Contexta combines grounded RAG chat, citations, and document intelligence in one focused workspace.",
      chatLabel: "Grounded RAG chat",
      chatNote: "every answer carries page-level citations",
      intelligenceLabel: "Document intelligence",
      intelligenceNote: "briefs, key points and detected fields",
      conversionLabel: "Markdown conversion",
      conversionNote: "PDF and DOCX out to portable text",
      caption: "© 2026 Contexta. Private document intelligence."
    },
    signIn: {
      eyebrow: "Sign in",
      title: "Welcome back",
      description: "Continue your document intelligence workspace.",
      requestAccess: "Request access",
      forgot: "Forgot password?",
      footnote: "Secure access for your private RAG document workspace."
    },
    registerPage: {
      eyebrow: "Get access",
      title: "Create account",
      hasAccount: "Already have an account?",
      signIn: "Sign in"
    },
    forgotPage: {
      eyebrow: "Recovery",
      title: "Reset password",
      description: "Enter your email and Contexta will send a reset link.",
      back: "Back to sign in"
    },
    updatePage: {
      eyebrow: "Account security",
      title: "Create a new password",
      description: "Choose a new password for your Contexta account.",
      newPassword: "New password",
      confirmPassword: "Confirm password",
      updating: "Updating...",
      checkingSession: "Checking session...",
      submit: "Update password",
      requestNew: "Request a new reset link",
      noSession: "Password reset session was not found. Request a new reset link.",
      tooShort: "Use at least 8 characters for your new password.",
      mismatch: "Password confirmation does not match.",
      updated: "Password updated. Taking you to Contexta.",
      failed: "Unable to update password."
    },
    callback: {
      eyebrowOk: "Workspace session",
      eyebrowFail: "Sign-in failed",
      titleOk: "Authentication complete",
      titleFail: "Authentication error",
      titlePending: "Completing authentication",
      dashboard: "Dashboard",
      login: "Login",
      messages: {
        checking: "Checking your Contexta sign-in session.",
        done: "Authentication complete. Continue to your dashboard.",
        noSessionReturned: "No authenticated session was returned.",
        paramsNoSession: "Auth parameters were found, but no active session is available.",
        noActiveSession: "No active sign-in session was found.",
        failed: "Unable to complete authentication."
      }
    }
  },
  documents: {
    upload: {
      eyebrow: "Knowledge base",
      title: "Upload & manage",
      description: "Add documents to the index. Supported formats: PDF and DOCX.",
      docTypeLabel: "Document type",
      refresh: "Refresh",
      exportWorkspace: "Export workspace",
      exporting: "Exporting...",
      browse: "Browse files",
      uploading: "Uploading...",
      dropTitle: "Drag and drop files here",
      dropBody: "Files are uploaded to your workspace and indexed automatically for grounded answers.",
      formatHint: "PDF or DOCX · max 50 MB",
      statusEyebrow: "System status",
      storageUsed: "Storage used",
      indexingQueue: "Indexing queue",
      readyCount: "Ready",
      fileCount: (count: number) => (count === 1 ? "1 file" : `${count} files`),
      indexingNote: "Large PDFs may take up to 2 minutes to fully index for vector search.",
      loading: "Loading documents...",
      uploadingOne: "Uploading document...",
      activityEyebrow: "Activity",
      recentTitle: "Recent documents",
      showRecent: "Show recent",
      viewAll: "View all",
      colFile: "File name",
      colSize: "Size",
      colType: "Type",
      colStatus: "Status",
      colActions: "Actions",
      docTypeFor: (name: string) => `Document type for ${name}`,
      retry: "Retry",
      reindex: "Re-index",
      delete: "Delete",
      emptyList: "No documents uploaded yet.",
      showing: (visible: number, total: number) =>
        `Showing ${visible} of ${total} ${total === 1 ? "document" : "documents"}.`,
      deleteConfirm: (name: string) => `Delete "${name}"? This removes its indexed chunks too.`,
      messages: {
        uploaded: (name: string) => `${name} uploaded.`,
        classified: (name: string, type: string) => `${name} classified as ${type}.`,
        deleted: (name: string) => `${name} deleted.`,
        retried: (name: string) => `${name} queued for retry.`,
        reindexed: (name: string) => `${name} queued for re-indexing.`,
        exported: (name: string) => `Exported ${name}.`
      },
      health: {
        unknownLabel: "Indexing health: unknown",
        attentionLabel: "Indexing health: needs attention",
        activeLabel: "Indexing health: active",
        unknownDetail: "Unable to infer worker health yet.",
        staleDetail: (count: number, minutes: number) =>
          `${count} processing file${count === 1 ? "" : "s"} stale for ${minutes}+ minutes.`,
        queuedDetail: (count: number) => `${count} queued file${count === 1 ? "" : "s"} waiting to start.`,
        processingDetail: (count: number) => `${count} file${count === 1 ? "" : "s"} currently processing.`,
        noStaleDetail: "No stale indexing jobs detected."
      },
      errors: {
        signIn: "Sign in to view and upload documents.",
        loadFailed: "Unable to load documents.",
        uploadFailed: "Unable to upload document.",
        typeFailed: "Unable to update document type.",
        signInDelete: "Sign in to delete documents.",
        deleteFailed: "Unable to delete document.",
        signInRetry: "Sign in to retry documents.",
        retryFailed: "Unable to retry document.",
        signInReindex: "Sign in to re-index documents.",
        reindexFailed: "Unable to re-index document.",
        signInExport: "Sign in to export your workspace.",
        exportFailed: "Unable to export workspace.",
        wrongFormat: "Only PDF and DOCX files are supported.",
        emptyFile: "The selected file is empty.",
        tooLarge: "Files must be 50 MB or smaller.",
        notConfigured: "Document uploads are not configured yet. Please contact an administrator."
      }
    },
    chunks: {
      eyebrow: "Chunks",
      title: "Chunk lines",
      zero: "0 chunks",
      range: (from: number, to: number, total: number) => `${from}\u2013${to} of ${total}`,
      counting: "Counting chunks...",
      colPage: "Page",
      colChars: "Chars",
      colPreview: "Preview",
      loading: "Loading chunks...",
      retry: "Retry",
      empty: "No chunks stored for this document yet.",
      tableTag: "table",
      pages: "Chunk pages",
      previous: "Previous chunk page",
      next: "Next chunk page",
      errors: {
        signIn: "Sign in to view chunks.",
        failed: "Unable to load chunks."
      }
    },
    intelligence: {
      loading: "Loading document intelligence...",
      notFound: "Document not found.",
      backToDocuments: "Back to documents",
      allDocuments: "All documents",
      eyebrow: "Document intelligence",
      chunkCount: (count: number) => `${count} ${count === 1 ? "chunk" : "chunks"}`,
      export: "Export",
      exporting: "Exporting...",
      processingTitle: "Indexing in progress",
      processingBody: "Contexta is extracting text and creating searchable chunks. This page refreshes automatically every few seconds.",
      failedTitle: "Processing failed",
      failedBody: "The worker could not process this document.",
      failedBack: "Go back to documents to retry or delete it.",
      loadingDetails: "Loading processed document details...",
      summaryEyebrow: "Summary",
      summaryTitle: "Automatic brief",
      generating: "Generating...",
      generateBrief: "Generate AI brief",
      aiBriefTitle: "AI brief",
      copyBrief: "Copy brief",
      extractedEyebrow: "Extracted",
      keyPointsTitle: "Key points",
      noText: "No text has been extracted yet.",
      entitiesEyebrow: "Entities",
      detectedFields: "Detected fields",
      names: "Names",
      emails: "Emails",
      links: "Links",
      noNames: "No names detected yet.",
      noEmails: "No emails detected yet.",
      noLinks: "No links detected yet.",
      askEyebrow: "Ask",
      suggestedTitle: "Suggested questions",
      notices: {
        copied: "Brief copied.",
        copyFailed: "Unable to copy brief."
      },
      errors: {
        signInView: "Sign in to view this document.",
        loadFailed: "Unable to load document.",
        signInBrief: "Sign in to generate an AI brief.",
        briefFailed: "Unable to generate AI brief.",
        signInExport: "Sign in to export this document.",
        exportFailed: "Unable to export document."
      }
    }
  },
  dashboard: {
    indexEyebrow: "Knowledge index",
    badgeSynced: "SYNCED",
    badgeAttention: "ATTENTION",
    title: "Document workspace",
    staleThreshold: (minutes: number) => `stale > ${minutes} min`,
    healthUnknown: "index health unknown",
    stats: {
      documents: "Documents",
      ready: "Ready",
      inQueue: "In queue",
      chunks: "Chunks",
      storage: "Storage"
    },
    refresh: "Refresh",
    uploadDocument: "Upload document",
    convert: "Convert",
    libraryTitle: "Document library",
    librarySubtitle: "Indexing status across every uploaded file.",
    filterLabel: "Filter library",
    filterPlaceholder: "Filter by name, type, status",
    colName: "Name",
    colType: "Type",
    colSize: "Size",
    colUploaded: "Uploaded",
    colStatus: "Status",
    colAction: "Action",
    loadingLibrary: "Loading document library...",
    open: "Open",
    noMatching: "No matching documents",
    noDocuments: "No documents yet",
    noMatchingHint: "Try another filename, type, or status.",
    noDocumentsHint: "Upload a PDF or DOCX to start building your searchable knowledge base.",
    showing: (visible: number, total: number) => `Showing ${visible} of ${total}`,
    showingLoading: "Showing —",
    viewAll: "View all",
    recentTitle: "Recent analyses",
    loadingRecent: "Loading recent analyses...",
    chunkCount: (count: number) => `${count} ${count === 1 ? "chunk" : "chunks"}`,
    uploadFirst: "Upload a document to create your first analysis workspace.",
    healthTitle: "Workspace health",
    healthRow: "Indexing health",
    healthNeedsAttention: "Needs attention",
    healthActive: "Active",
    healthUnknownValue: "Unknown",
    healthStale: (count: number, minutes: number) => `${count} stale for ${minutes}+ min`,
    healthQueued: (count: number) => `${count} queued`,
    healthNoStale: "No stale jobs",
    healthNoDetail: "Indexing health could not be inferred.",
    readyDocuments: "Ready documents",
    indexedChunks: "Indexed chunks",
    nextActionsTitle: "Next actions",
    nextActions: {
      upload: "Upload or manage documents",
      chat: "Ask questions with citations",
      profile: "Review retrieval settings"
    },
    errors: {
      signIn: "Sign in to view dashboard insights.",
      failed: "Unable to load dashboard insights."
    }
  },
  profile: {
    eyebrow: "User Profile",
    userFallback: "Contexta user",
    loadingAccount: "Loading account...",
    loading: "Loading...",
    emailVerified: "Email verified",
    emailNotVerified: "Email not verified",
    displayName: "Display name",
    displayNamePlaceholder: "Add your display name",
    accountEmail: "Account email",
    save: "Save profile",
    saving: "Saving",
    saved: "Profile updated.",
    refresh: "Refresh",
    accountSummary: "Account Summary",
    emailLabel: "Email address",
    userIdLabel: "User ID",
    joined: "Joined",
    notAvailable: "Not available",
    today: "Today",
    yesterday: "Yesterday",
    daysAgo: (days: number) => `${days} ${days === 1 ? "day" : "days"} ago`,
    provider: {
      emailAndPassword: "Email & password",
      google: "Google",
      github: "GitHub",
      magicLink: "Magic link",
      oauth: "OAuth"
    },
    documentCount: (count: number) => `${count} ${count === 1 ? "document" : "documents"}`,
    stats: {
      documents: "Documents",
      chatSessions: "Chat sessions",
      indexedChunks: "Indexed chunks",
      storageUsed: "Storage used",
      documentsHelper: (ready: number, failed: number) => `${ready} ready, ${failed} failed`,
      questions7d: (count: number) =>
        `${count} ${count === 1 ? "question" : "questions"} in the last 7 days`,
      chunksHelper: "Searchable text blocks",
      storageHelper: "Total size of uploaded files"
    },
    activityTitle: "Activity in the last 7 days",
    activity: {
      upload: "Upload",
      indexing: "Indexing",
      chat: "Chat"
    },
    lastAt: (value: string) => `Last: ${value}`,
    noActivity: "No activity in this window",
    activityError: "Activity numbers could not be loaded. Try Refresh.",
    keysLine: {
      loading: "Loading API keys...",
      summary: (keys: number, requests: number) =>
        `${keys} ${keys === 1 ? "active key" : "active keys"} · ${requests} ${requests === 1 ? "request" : "requests"} in the last 14 days`,
      error: "API key usage could not be loaded."
    },
    manageKeys: "Manage API keys",
    errors: {
      loadFailed: "Unable to load profile.",
      saveFailed: "Unable to update profile."
    }
  },
  settings: {
    eyebrow: "Workspace Settings",
    title: "System controls",
    description:
      "Read-only configuration for this workspace. Core secrets stay on the API server and are not exposed here.",
    apiKeys: "API keys",
    manageDocuments: "Manage documents",
    openChat: "Open chat",
    runtimeTitle: "Runtime Status",
    runtimeSubtitle: "Configuration currently used by the web app and API.",
    editAccessTitle: "Edit access",
    editAccessHead: "Nothing here is writable",
    editAccessBody:
      "Changing these values means editing the API server environment and restarting the service.",
    securityTitle: "Security Note",
    securityBody:
      "Supabase service role, DeepSeek key, and database credentials must stay in backend `.env` files. The web app should only receive public client settings.",
    serviceTitle: "Service Status",
    recheck: "Re-check",
    checking: "Checking",
    services: {
      api: "API service",
      vector: "Vector store",
      indexing: "Indexing queue"
    },
    words: {
      checking: "Checking",
      reachable: "Reachable",
      unreachable: "Unreachable",
      noAnswer: "No answer",
      active: "Active",
      needsAttention: "Needs attention"
    },
    details: {
      pingHealth: "Pinging /health",
      pingVector: "Pinging /health/vector",
      pingIndexing: "Reading /health/indexing",
      apiUnreachable: "The API did not answer /health.",
      unknown: "Status unknown — no answer from the API.",
      vectorOk: "Qdrant reported healthy.",
      vectorUnreachable: "Qdrant is not reachable from the API.",
      queueCounts: (queued: number, processing: number, stale: number, minutes: number) =>
        `${queued} queued, ${processing} processing, ${stale} stale over ${minutes} min.`
    },
    runtime: {
      apiBaseUrl: "API base URL",
      vectorCollection: "Vector collection",
      vectorCollectionUnknown: "Not reported",
      supportedUploads: "Supported uploads",
      supportedUploadsValue: "PDF and DOCX up to 50 MB",
      answerGeneration: "Answer generation"
    },
    capabilities: {
      authentication: "Authentication",
      authenticationValue: "Supabase email sign-in",
      documentStorage: "Document storage",
      documentStorageValue: "Supabase Storage",
      vectorSearch: "Vector search",
      vectorSearchValue: "Qdrant, called by the API",
      privateKeys: "Private keys",
      privateKeysValue: "Server env only, never sent here"
    }
  },
  developer: {
    loading: "Loading developer settings...",
    eyebrow: "Developer",
    title: "API keys",
    description:
      "Machine access to retrieval over your indexed documents. Keys are limited to 60 requests a minute and 5.000 a day, and every call is logged for 90 days.",
    refresh: "Refresh",
    createdTitle: "Copy it now — this is the only time it is shown",
    createdBody:
      "Contexta stores only a hash of the key, so a lost one cannot be recovered; revoke it and create a new one.",
    copy: "Copy",
    copied: "Copied",
    done: "Done",
    createTitle: "Create a key",
    nameLabel: "Name",
    namePlaceholder: "notebook, CI, internal tool...",
    createKey: "Create key",
    creating: "Creating...",
    scopeLegend: "Documents this key may read",
    scopeAll: "All documents",
    scopeSelected: "Selected only",
    noReadyDocuments: "No indexed document to select yet.",
    existingTitle: "Existing keys",
    emptyKeys: "No API key created yet.",
    states: {
      active: "Active",
      expired: "Expired",
      revoked: "Revoked"
    },
    never: "never",
    documentCount: (count: number) => `${count} document${count === 1 ? "" : "s"}`,
    createdOn: (value: string) => `created ${value}`,
    lastUsedOn: (value: string) => `last used ${value}`,
    usage: "Usage",
    hideUsage: "Hide usage",
    loadingShort: "Loading...",
    revoke: "Revoke",
    revoking: "Revoking...",
    revokeConfirm: (name: string) =>
      `Revoke "${name}"? Any client using this key stops working immediately and the key cannot be restored.`,
    usageSummary: (total: number, days: number, allowed: number, rejected: number) =>
      `${total} request${total === 1 ? "" : "s"} in the last ${days} days · ${allowed} allowed · ${rejected} rejected`,
    dayAllowed: (count: number) => `${count} ok`,
    dayRejected: (count: number) => `${count} blocked`,
    noRequests: "No requests recorded yet.",
    rejectedByCause: "Rejected by cause:",
    usingTitle: "Using a key",
    usingIntro:
      "Retrieval only — no answer generation. Send the key as a bearer token; a browser login token is not accepted here. Full endpoint reference lives in",
    usingMcp: "The same key works on our MCP server at",
    usingMcpTail: "for Claude, Cursor, or any other MCP client.",
    errors: {
      signIn: "Sign in to manage API keys.",
      loadFailed: "Unable to load API keys.",
      needName: "Give the key a name, and pick at least one document if it is scoped.",
      signInCreate: "Sign in to create an API key.",
      createFailed: "Unable to create an API key.",
      clipboard: "The browser blocked clipboard access. Select the key and copy it manually.",
      signInRevoke: "Sign in to revoke this key.",
      revokeFailed: "Unable to revoke this key.",
      signInUsage: "Sign in to load usage.",
      usageFailed: "Unable to load usage for this key."
    }
  },
  convert: {
    title: "PDF to Markdown",
    description: "Convert a PDF into clean Markdown without adding it to your document library.",
    browsePdf: "Browse PDF",
    convert: "Convert",
    converting: "Converting...",
    dropTitle: "Drag and drop a PDF",
    dropBody: "The converter accepts one PDF at a time and returns Markdown for preview, copy, or download.",
    maxLimit: "Max 50 MB",
    clearPdf: "Clear selected PDF",
    previewTitle: "Markdown Preview",
    previewEmptyMeta: "Converted Markdown will appear here.",
    previewFile: (name: string, size: string) => `${name} - source PDF ${size}`,
    copy: "Copy",
    download: "Download",
    noMarkdown: "No Markdown generated yet.",
    notices: {
      ready: (name: string) => `${name} is ready.`,
      copied: "Markdown copied.",
      downloaded: "Markdown download started."
    },
    errors: {
      wrongFormat: "Choose a PDF file with a .pdf extension.",
      emptyFile: "The selected PDF is empty.",
      tooLarge: "PDF files must be 50 MB or smaller.",
      noFile: "Choose a PDF before converting.",
      signIn: "Sign in to convert PDFs.",
      notConfigured: "Authentication is not configured yet. Please contact an administrator.",
      failed: "Unable to convert PDF to Markdown.",
      copyFailed: "Unable to copy Markdown to the clipboard."
    }
  },
  pipeline: {
    embeddingEyebrow: "Hybrid dense retrieval",
    badgeSynced: "SYNCED",
    badgeAttention: "ATTENTION",
    indexUnknown: "Model not reported",
    collectionUnknown: "Collection not reported",
    dimensionsNotReported: "dims not reported",
    collectionLine: (collection: string, shape: string) => `Collection: ${collection} - ${shape}`,
    viewsLabel: "Pipeline views",
    tabs: {
      all: "All nodes",
      indexed: "Indexed chunks",
      queue: "Ingestion queue",
      failed: "Failed jobs"
    },
    sampleEyebrow: "Sample - not instrumented yet",
    sampleLabels: {
      queryLatency: "Query Latency",
      retrievalScore: "Retrieval Score",
      hitRate: "Hit Rate",
      cacheRatio: "Cache Ratio"
    },
    metrics: {
      documents: "Documents",
      ready: "Ready",
      inQueue: "In queue",
      chunks: "Chunks",
      storage: "Storage"
    },
    metricUnits: {
      files: "files",
      indexed: "indexed",
      pending: "pending",
      vectors: "vectors"
    },
    clusters: {
      indexed: {
        title: "Indexed Chunks",
        badge: "Ready",
        subtitle: (chunks: string) => `${chunks} in Qdrant`
      },
      queue: {
        title: "Ingestion Queue",
        badge: "Live",
        subtitle: (queued: number, processing: number) => `${queued} queued - ${processing} processing`
      },
      failed: {
        title: "Failed Jobs",
        subtitle: (count: number) => `${count} document${count === 1 ? "" : "s"} need a retry`
      }
    },
    tags: {
      queued: "QUEUED",
      working: "WORKING",
      retry: "RETRY"
    },
    rootName: "Contexta Workspace",
    activeClusters: (count: number) => `${count} active`,
    chunkCount: (count: number) => `${count} ${count === 1 ? "chunk" : "chunks"}`,
    leaf: {
      tokens: (count: string) => `[${count} tok]`,
      moreInCluster: (count: number) => `+${count} more in this cluster`,
      workerError: "Worker error",
      agoMinutes: (minutes: number) => `${minutes}m ago`,
      agoHours: (hours: number) => `${hours}h ago`,
      agoDays: (days: number) => `${days}d ago`
    },
    graph: {
      ariaLabel: "Live synapse graph",
      title: "Live Synapse Graph",
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
      reset: "Reset",
      nodes: (count: number) => `Nodes: ${count}`,
      empty: "No nodes in this view - pick another tab or upload a document.",
      hint: "drag to pan - expand a file to fan its chunks",
      knowledgeRoot: "Knowledge Root",
      clustersLabel: "Clusters",
      documentsLabel: "Documents"
    },
    fan: {
      expand: (count: number) => `Fan out ${count} chunk positions`,
      collapse: "Collapse chunk positions",
      position: (position: string, total: string) =>
        `Chunk position ${position} of ${total} - the text itself lives in the document`,
      openDocument: "Open the document to read every chunk",
      more: "more",
      chunk: "chunk",
      point: (arms: number) => `${arms} point${arms === 1 ? "" : "s"}`
    },
    timeline: {
      ranges: {
        d24h: "Past 24 Hours",
        d7d: "Past 7 Days",
        d30d: "Past 30 Days"
      },
      noEvents: "No uploads inside this window.",
      plotted: (count: number, rangeLabel: string) =>
        `${count} upload${count === 1 ? "" : "s"} plotted across ${rangeLabel.toLowerCase()}.`,
      ingested: "Ingested:",
      pending: (count: number) => `${count} pending`
    },
    errors: {
      signIn: "Sign in to view pipeline dynamics.",
      failed: "Unable to load pipeline dynamics."
    }
  },
  // Server text arrives in English: keys are the exact message, values reword it for the UI.
  // Anything not listed here renders verbatim rather than pretending to be translated.
  errors: {
    server: {
      "uploaded file is too large": "The uploaded file is too large.",
      "uploaded file must be a PDF": "The uploaded file must be a PDF.",
      "uploaded file must not be empty": "The uploaded file is empty.",
      "unsupported upload file type": "That file type is not supported.",
      "unsupported upload content type": "That content type is not supported.",
      "filename extension must match upload content type": "The file extension must match its content type.",
      "filename must be a safe basename": "That file name is not allowed.",
      "No extractable text found": "No extractable text was found in this file.",
      "Stored file is no longer available": "The stored file for this document is no longer available.",
      "Indexing failed unexpectedly. Please retry.": "Indexing failed unexpectedly. Please retry, and contact support if it keeps happening.",
      "Unsupported document type": "This document type is not supported.",
      "Vector point count did not match chunk count": "The indexed vectors did not match the chunk count.",
      "Document storage is not configured": "Document storage is not configured on the server.",
      "Document extractor is not configured": "The document extractor is not configured on the server.",
      "Embedding provider is not configured": "The embedding provider is not configured on the server.",
      "Vector store is not configured": "The vector store is not configured on the server.",
      "document not found": "That document no longer exists.",
      "only failed documents can be retried": "Only a failed document can be retried.",
      "only ready documents can be re-indexed": "Only a document that finished indexing can be re-indexed.",
      "document metadata cannot be edited while indexing is running":
        "Metadata cannot be edited while the document is still indexing.",
      "document has no processed chunks": "This document has no chunks to read yet.",
      "document has no indexed chunks to export yet": "This document has nothing indexed to export yet.",
      "format must be md or jsonl": "The export format must be md or jsonl.",
      "chat session is not accessible": "That chat session is not accessible.",
      "api key not found": "That API key no longer exists.",
      "Invalid authentication token": "The sign-in token is no longer valid.",
      "Invalid login credentials": "That email and password combination is wrong.",
      "Email not confirmed": "This email address has not been confirmed yet.",
      "User already registered": "An account with this email already exists.",
      "Password should be at least 6 characters.": "The password must be at least 6 characters.",
      "Unable to validate email address: invalid format": "That email address is not valid.",
      "For security, password login is not allowed for this user.":
        "Password sign-in is not allowed for this account.",
      "Request timed out. Please try again.": "The request timed out. Please try again.",
      "Unable to reach the API.": "The API could not be reached.",
      "Unable to load documents.": "Unable to load documents.",
      "Unable to load document.": "Unable to load the document.",
      "Unable to load document intelligence.": "Unable to load document intelligence.",
      "Unable to load document chunks.": "Unable to load the document chunks.",
      "Unable to load indexing health.": "Unable to load indexing health.",
      "Unable to upload document.": "Unable to upload the document.",
      "Unable to delete document.": "Unable to delete the document.",
      "Unable to delete this document.": "Unable to delete this document.",
      "Unable to retry document.": "Unable to retry the document.",
      "Unable to retry this document.": "Unable to retry this document.",
      "Unable to re-index this document.": "Unable to re-index this document.",
      "Unable to remove the indexed chunks for this document.": "The indexed chunks for this document could not be removed.",
      "Unable to remove the stored file for this document.": "The stored file for this document could not be removed.",
      "Unable to clear the previous indexing attempt for this document.":
        "The previous indexing attempt could not be cleared.",
      "Unable to update document metadata.": "Unable to update the document metadata.",
      "Document metadata was saved, but the search index is still stale.":
        "The metadata was saved, but the search index is still stale.",
      "Unable to export.": "Unable to start the export.",
      "Unable to convert PDF to Markdown.": "Unable to convert the PDF to Markdown.",
      "Markdown conversion service is unavailable.": "The Markdown conversion service is unavailable.",
      "Unable to answer question.": "The answer could not be generated.",
      "DeepSeek returned an empty answer. Try a content-generating model such as deepseek-v4-pro.":
        "The model returned an empty answer. Try again.",
      "DEEPSEEK_API_KEY is not configured": "The answer service is not configured.",
      "Unable to generate AI brief.": "The AI brief could not be generated.",
      "Unable to load chat sessions.": "Unable to load chat sessions.",
      "Unable to load chat messages.": "Unable to load the chat messages.",
      "Unable to create chat session.": "Unable to start a chat session.",
      "Unable to load account summary.": "Unable to load the account summary.",
      "Unable to load API keys.": "Unable to load API keys.",
      "Unable to create an API key.": "Unable to create an API key.",
      "Unable to revoke this key.": "Unable to revoke this key.",
      "Unable to load key usage.": "Unable to load the key usage.",
      "The uploaded file is corrupt or unreadable.": "The uploaded file is corrupt or unreadable."
    }
  },
  chat: {
    askAbout: "Ask about",
    chooseDocumentToStart: "Choose a document to start",
    conversationHistory: "Conversation history",
    newChat: "New chat",
    sourcesTitle: "Sources",
    loading: "Loading chat...",
    pickDocumentFirst: "Pick the document you want to analyse, then we continue from there.",
    readyBefore: "Ready, let's open up",
    readyAfter: ". Write your first question — ask for a summary, the key points, or specific data from this document.",
    chooseDocument: "Choose a document",
    readyCount: (count: number) => `${count} document${count === 1 ? "" : "s"} ready to analyse`,
    searchPlaceholder: "Search document name...",
    noReadyDocuments: "No document is Ready yet. Upload one, or wait for indexing to finish.",
    noMatch: "No document matches that search.",
    select: "Select",
    thinking: "Contexta is thinking...",
    cancelHelper: "AI is thinking... click the spinning square to cancel.",
    chattingWith: (filename: string) => `Chatting with ${filename}`,
    chooseOneHelper: "Choose one document in the chat to start.",
    askPlaceholderWithDoc: "Ask Contexta about this document...",
    askPlaceholderNoDoc: "Choose a document first...",
    emptyAnswer: "Sorry, Contexta did not return an answer that can be shown. Try sending the question again.",
    answerCancelled: "Answer cancelled.",
    truncatedNotice: "This answer hit the model's length limit and may end mid-sentence. Narrow the question and ask again for the missing part.",
    source: "Source",
    page: (pageNumber: number) => `p. ${pageNumber}`,
    pageUnknown: "page unknown",
    score: (value: string) => `Score ${value}`,
    openSource: (marker: number, label: string) => `Open source ${marker}: ${label}`,
    sourceDrawer: "Source drawer",
    send: "Send message",
    cancelResponse: "Cancel response",
    close: "Close",
    closeOverlay: "Close source drawer overlay",
    citationsEmpty: "Citations and context snippets will appear here after an answer.",
    errors: {
      signInToLoadChat: "Sign in to load chat.",
      signInToLoadHistory: "Sign in to load chat history.",
      signInToCreateChat: "Sign in to create a chat.",
      signInToAsk: "Sign in to ask questions.",
      chooseDocumentBeforeAsking: "Please choose one ready document before asking.",
      unableToLoadChat: "Unable to load chat.",
      unableToLoadMessages: "Unable to load chat messages.",
      unableToCreateChat: "Unable to create a new chat.",
      unableToAnswer: "Unable to answer question."
    }
  },
  help: {
    eyebrow: "Contexta Help",
    title: "Workspace guide",
    intro:
      "A short place to understand how Contexta works, how to ask your documents questions, and what to check when an upload or a chat goes wrong.",
    manageDocuments: "Manage documents",
    openChat: "Open chat",
    steps: {
      upload: {
        title: "Upload a document",
        description: "Open Documents, pick a PDF or DOCX, then wait for the status to change to Ready."
      },
      chat: {
        title: "Pick the document in Chat",
        description: "One conversation covers one document. Choose the document first so answers do not get mixed together."
      },
      ask: {
        title: "Ask something specific",
        description: "Request a summary, count rows or names, find the highest metric, or compare the contents of documents."
      }
    },
    troubleshooting: {
      title: "Troubleshooting",
      subtitle: "The problems that come up most often when running Contexta locally.",
      items: {
        stuck: {
          problem: "A document sits in Processing",
          answer: "Make sure the API, worker and Qdrant containers are running. Click Refresh in Documents to read the latest status."
        },
        slow: {
          problem: "Chat feels slow",
          answer: "Analytical questions over a large document need context extraction and an LLM call. If it takes too long, cancel and ask something narrower."
        },
        numbers: {
          problem: "The answer needs exact numbers",
          answer: "Ask explicitly, like 'count the total rows for name X' or 'the post with the most Likes'. Answers come from the model reading the retrieved chunks, so for a number that must be exact, ask for the rows to be listed and verify them against the source."
        },
        convert: {
          problem: "Converting a PDF to Markdown fails",
          answer: "Try a PDF that is neither corrupted nor encrypted. Convert runs the same extractor that built the document's index, so the Markdown is the text Contexta answers from."
        }
      }
    },
    examples: {
      title: "Example questions",
      summary: "Summarize this document in 5 points.",
      problem: "What main problem does this document address, and what solution does it offer?",
      topCreator: "Who is the creator with the most views?",
      countPosts: "Count the total posts for the name ISA.",
      topLiked: "Which post has the most Likes?",
      insights: "List insights from this document that could support a business decision."
    }
  }
};

export type Dictionary = typeof en;
