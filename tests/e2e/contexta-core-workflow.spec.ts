import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(__dirname, "../..");
const qaEmail = "contexta.core.qa.local@example.com";
const qaPassword = "ContextaQaLocal!2026";
const workflowQuestion = "Ringkas dokumen ini dalam satu kalimat.";

test.use({
  baseURL: process.env.CONTEXTA_BASE_URL || "http://127.0.0.1:3000",
});

type EnvMap = Record<string, string>;

function readEnvFile(filePath: string): EnvMap {
  const values: EnvMap = {};
  if (!fs.existsSync(filePath)) {
    return values;
  }

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#") || !trimmedLine.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmedLine.split("=");
    values[key.trim()] = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
  }

  return values;
}

const rootEnv = readEnvFile(path.join(rootDir, ".env"));
const webEnv = readEnvFile(path.join(rootDir, "apps", "web", ".env.local"));
const env = { ...rootEnv, ...webEnv, ...process.env };

async function ensureQaUser() {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase URL and service role key are required for authenticated E2E testing.");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) {
    throw users.error;
  }

  const existingUser = users.data.users.find((user) => user.email?.toLowerCase() === qaEmail);
  if (existingUser) {
    const updated = await admin.auth.admin.updateUserById(existingUser.id, {
      password: qaPassword,
      email_confirm: true,
      user_metadata: {
        full_name: "Vaneza Core Inspector",
      },
    });
    if (updated.error) {
      throw updated.error;
    }
    return;
  }

  const created = await admin.auth.admin.createUser({
    email: qaEmail,
    password: qaPassword,
    email_confirm: true,
    user_metadata: {
      full_name: "Vaneza Core Inspector",
    },
  });

  if (created.error) {
    throw created.error;
  }
}

function samplePdfBuffer(filename: string) {
  return Buffer.from(
    `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 160 >>
stream
BT
/F1 14 Tf
72 720 Td
(Contexta QA core workflow document.) Tj
0 -24 Td
(This tiny PDF verifies upload, indexing, chat, citations, and cleanup for ${filename}.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
trailer
<< /Root 1 0 R /Size 6 >>
%%EOF`,
    "utf8",
  );
}

async function loginAsQaUser(page: Page) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  await page.getByLabel("Email address").fill(qaEmail);
  await page.getByLabel("Password", { exact: true }).fill(qaPassword);
  await page.getByRole("button", { name: /sign in to contexta/i }).click();
  await page.waitForURL("**/", { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /dashboard overview/i })).toBeVisible();
}

function documentRow(page: Page, filename: string) {
  return page
    .getByRole("link", { name: filename })
    .locator("xpath=ancestor::div[contains(@class, 'grid') and contains(@class, 'grid-cols-12')][1]");
}

async function cleanupUploadedDocument(page: Page, filename: string) {
  await page.goto("/documents");
  await expect(page.getByText(/loading documents/i)).toHaveCount(0, { timeout: 30_000 });

  const row = documentRow(page, filename);
  if ((await row.count()) === 0) {
    return;
  }

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });

  await row.getByRole("button", { name: /^delete$/i }).click();
  await expect(page.getByText(`${filename} deleted.`)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: filename })).toHaveCount(0, { timeout: 30_000 });
}

test.beforeAll(async () => {
  await ensureQaUser();
});

test("QA user can upload, index, chat with, and delete a PDF document", async ({ page }) => {
  test.setTimeout(240_000);
  page.setDefaultTimeout(20_000);

  const filename = `contexta-core-workflow-${Date.now()}.pdf`;
  let uploaded = false;

  await loginAsQaUser(page);

  try {
    await page.goto("/documents");
    await expect(page.getByRole("heading", { name: /upload & manage/i })).toBeVisible();
    await expect(page.getByText(/loading documents/i)).toHaveCount(0, { timeout: 30_000 });

    await page.locator("input[type=file]").setInputFiles({
      name: filename,
      mimeType: "application/pdf",
      buffer: samplePdfBuffer(filename),
    });

    uploaded = true;
    await expect(page.getByText(`${filename} uploaded.`)).toBeVisible({ timeout: 30_000 });

    const row = documentRow(page, filename);
    await expect(row).toBeVisible();
    await expect(row.getByText(/^Ready$/)).toBeVisible({ timeout: 120_000 });

    await page.goto("/chat");
    await expect(page.getByText(/loading chat/i)).toHaveCount(0, { timeout: 30_000 });
    const sourceDrawer = page.locator('aside[aria-label="Source drawer"]');
    const newChatButton = page.getByRole("button", { name: /^new chat$/i });
    await expect(async () => {
      const drawerClass = await sourceDrawer.getAttribute("class");
      if (drawerClass?.includes("translate-x-0")) {
        await sourceDrawer.getByRole("button", { name: /^close$/i }).click({ force: true });
        await expect(sourceDrawer).toHaveClass(/translate-x-full/, { timeout: 1_000 });
      }
      await expect(newChatButton).toBeEnabled({ timeout: 1_000 });
      await newChatButton.click({ trial: true, timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await newChatButton.click();
    await expect(page.getByText(/loading chat/i)).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByText(/pilih dokumen yang mau kamu analisa/i)).toBeVisible();

    await page.getByPlaceholder(/cari nama dokumen/i).fill(filename);
    await page.getByRole("button", { name: new RegExp(`${filename}.*select`, "i") }).click();
    await expect(page.getByText(new RegExp(`Chatting with ${filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"))).toBeVisible();

    await page.locator("#chat-question").fill(workflowQuestion);
    await page.getByRole("button", { name: /send message/i }).click();

    const userQuestion = page
      .locator("xpath=//div[contains(@class, 'max-w-[78%]') and contains(@class, 'bg-primary') and contains(@class, 'text-white')]")
      .filter({ hasText: workflowQuestion });
    await expect(userQuestion).toBeVisible();
    const visibleThinkingIndicator = page.locator("span").filter({ hasText: /contexta is thinking/i });
    await expect(visibleThinkingIndicator).toBeVisible({ timeout: 10_000 });
    await expect(visibleThinkingIndicator).toHaveCount(0, { timeout: 120_000 });

    const assistantAnswer = page
      .locator("xpath=//div[contains(@class, 'max-w-[78%]') and contains(@class, 'bg-white') and contains(@class, 'text-ink')]")
      .last();
    await expect(assistantAnswer).toBeVisible({ timeout: 120_000 });
    await expect(assistantAnswer).not.toHaveText("");
  } finally {
    if (uploaded) {
      await cleanupUploadedDocument(page, filename);
    }
  }
});
