import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(__dirname, "../..");
const artifactsDir = path.join(rootDir, "tests", "artifacts", "contexta-smoke");
const qaEmail = "contexta.qa.local@example.com";
const qaPassword = "ContextaQaLocal!2026";

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
    throw new Error("Supabase URL and service role key are required for authenticated smoke testing.");
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
        full_name: "Vaneza Inspector",
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
      full_name: "Vaneza Inspector",
    },
  });

  if (created.error) {
    throw created.error;
  }
}

function samplePdfBuffer() {
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
<< /Length 73 >>
stream
BT
/F1 18 Tf
72 720 Td
(Contexta smoke PDF for markdown conversion.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000241 00000 n
0000000365 00000 n
trailer
<< /Root 1 0 R /Size 6 >>
startxref
435
%%EOF`,
    "utf8",
  );
}

test.beforeAll(async () => {
  fs.mkdirSync(artifactsDir, { recursive: true });
  await ensureQaUser();
});

test("Contexta authenticated page smoke review", async ({ page }) => {
  page.setDefaultTimeout(20_000);

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  await page.getByLabel("Email address").fill(qaEmail);
  await page.getByLabel("Password", { exact: true }).fill(qaPassword);
  await page.getByRole("button", { name: /sign in to contexta/i }).click();
  await page.waitForURL("**/", { timeout: 30_000 });

  await expect(page.getByRole("heading", { name: /dashboard overview/i })).toBeVisible();
  await expect(page.getByText(/loading dashboard/i)).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByText(/loading recent analyses/i)).toHaveCount(0, { timeout: 30_000 });
  await page.screenshot({ path: path.join(artifactsDir, "01-dashboard.png"), fullPage: true });

  await page.goto("/documents");
  await expect(page.getByRole("heading", { name: /upload & manage/i })).toBeVisible();
  await expect(page.getByText(/drag and drop files here/i)).toBeVisible();
  await expect(page.getByText(/loading documents/i)).toHaveCount(0, { timeout: 30_000 });
  await page.screenshot({ path: path.join(artifactsDir, "02-documents.png"), fullPage: true });

  await page.goto("/convert");
  await expect(page.getByRole("heading", { name: /pdf to markdown/i })).toBeVisible();
  await page.locator("input[type=file]").setInputFiles({
    name: "contexta-smoke.pdf",
    mimeType: "application/pdf",
    buffer: samplePdfBuffer(),
  });
  await page.getByRole("button", { name: /^convert$/i }).click();
  await expect(page.getByText(/is ready/i)).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/Contexta smoke PDF/i)).toBeVisible();
  await page.screenshot({ path: path.join(artifactsDir, "03-convert.png"), fullPage: true });

  await page.goto("/chat");
  await expect(page.getByText(/Pilih dokumen yang mau kamu analisa/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /sources/i })).toBeVisible();
  await page.screenshot({ path: path.join(artifactsDir, "04-chat.png"), fullPage: true });

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: /system controls/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /runtime status/i })).toBeVisible();
  await page.screenshot({ path: path.join(artifactsDir, "05-settings.png"), fullPage: true });

  await page.getByRole("link", { name: /^help$/i }).click();
  await page.waitForURL("**/help", { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /panduan workspace/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /troubleshooting/i })).toBeVisible();

  await page.goto("/profile");
  await expect(page.getByText(/user profile/i)).toBeVisible();
  await expect(page.getByText(/loading profile/i)).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByText(qaEmail).first()).toBeVisible();
  await page.screenshot({ path: path.join(artifactsDir, "06-profile.png"), fullPage: true });
});

test("protected route redirects unauthenticated users to login", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/chat");
  await page.waitForURL("**/login?next=%2Fchat", { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
});
