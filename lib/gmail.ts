import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { gmailAccounts, syncRuns, transactions } from "@/db/schema";
import { parseWithAi } from "./ai-fallback";
import { parseBankEmail, type EmailInput } from "./banks";
import { categorize } from "./categorize";
import { decryptSecret, encryptSecret } from "./crypto";
import { requireSecret } from "./runtime-env";

type GmailHeader = { name: string; value: string };
type GmailPart = { mimeType?: string; body?: { data?: string }; parts?: GmailPart[] };
type GmailMessage = { id: string; threadId?: string; internalDate?: string; payload?: GmailPart & { headers?: GmailHeader[] } };

function decodeBody(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

function stripHtml(value: string): string {
  return value.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#39;/g, "'").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim();
}

function partText(part?: GmailPart): string {
  if (!part) return "";
  const own = part.body?.data ? decodeBody(part.body.data) : "";
  const children = part.parts?.map(partText).filter(Boolean).join("\n") ?? "";
  const combined = [own, children].filter(Boolean).join("\n");
  return part.mimeType === "text/html" ? stripHtml(combined) : combined;
}

function header(message: GmailMessage, name: string): string {
  return message.payload?.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

async function exchangeRefreshToken(refreshToken: string) {
  const body = new URLSearchParams({ client_id: requireSecret("GOOGLE_CLIENT_ID"), client_secret: requireSecret("GOOGLE_CLIENT_SECRET"), refresh_token: refreshToken, grant_type: "refresh_token" });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error("Google rechazó la renovación de la sesión. Vuelve a conectar Gmail.");
  return response.json() as Promise<{ access_token: string; expires_in: number }>;
}

async function validAccessToken(userId: string): Promise<string> {
  const db = getDb();
  const [account] = await db.select().from(gmailAccounts).where(eq(gmailAccounts.userId, userId)).limit(1);
  if (!account) throw new Error("Gmail no está conectado.");
  const secret = requireSecret("APP_ENCRYPTION_KEY");
  if (account.tokenExpiresAt > Math.floor(Date.now() / 1000) + 90) return decryptSecret(account.accessTokenEncrypted, secret);
  if (!account.refreshTokenEncrypted) throw new Error("La autorización de Gmail venció. Vuelve a conectar tu cuenta.");
  const refreshed = await exchangeRefreshToken(await decryptSecret(account.refreshTokenEncrypted, secret));
  await db.update(gmailAccounts).set({ accessTokenEncrypted: await encryptSecret(refreshed.access_token, secret), tokenExpiresAt: Math.floor(Date.now() / 1000) + refreshed.expires_in, updatedAt: Math.floor(Date.now() / 1000) }).where(eq(gmailAccounts.userId, userId));
  return refreshed.access_token;
}

async function gmailFetch<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Gmail API respondió ${response.status}.`);
  return response.json() as Promise<T>;
}

export async function syncGmail(userId: string) {
  const db = getDb();
  const runId = crypto.randomUUID();
  await db.insert(syncRuns).values({ id: runId, userId, status: "running" });
  const stats = { scanned: 0, created: 0, duplicates: 0, failures: 0 };
  try {
    const accessToken = await validAccessToken(userId);
    const query = encodeURIComponent('newer_than:180d (compra OR consumo OR cargo OR "pago con tarjeta" OR transacción OR movimiento)');
    let pageToken: string | undefined;
    const messageIds: string[] = [];
    for (let page = 0; page < 3; page++) {
      const suffix = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
      const result = await gmailFetch<{ messages?: Array<{ id: string }>; nextPageToken?: string }>(accessToken, `messages?q=${query}&maxResults=100${suffix}`);
      messageIds.push(...(result.messages ?? []).map((item) => item.id));
      pageToken = result.nextPageToken;
      if (!pageToken) break;
    }
    for (const messageId of messageIds) {
      stats.scanned++;
      const [existing] = await db.select({ id: transactions.id }).from(transactions).where(and(eq(transactions.userId, userId), eq(transactions.gmailMessageId, messageId))).limit(1);
      if (existing) { stats.duplicates++; continue; }
      const message = await gmailFetch<GmailMessage>(accessToken, `messages/${messageId}?format=full`);
      const email: EmailInput = { id: message.id, threadId: message.threadId, from: header(message, "From"), subject: header(message, "Subject"), body: partText(message.payload), internalDate: Number(message.internalDate ?? Date.now()) };
      const parsed = parseBankEmail(email) ?? await parseWithAi(email);
      if (!parsed) { stats.failures++; continue; }
      const inserted = await db.insert(transactions).values({
        id: crypto.randomUUID(), userId, gmailMessageId: message.id, gmailThreadId: message.threadId, gmailInternalDate: email.internalDate,
        bank: parsed.bank, merchant: parsed.merchant, operationDate: parsed.operationDate, amountCents: parsed.amountCents, currency: parsed.currency,
        cardType: parsed.cardType, cardLast4: parsed.cardLast4, operationType: parsed.operationType, category: categorize(parsed.merchant, parsed.description),
        categorySource: "rule", description: parsed.description, confidence: parsed.confidence, rawSubject: email.subject.slice(0, 500), parserId: parsed.parserId,
      }).onConflictDoNothing().returning({ id: transactions.id });
      if (inserted.length) stats.created++; else stats.duplicates++;
    }
    const now = Math.floor(Date.now() / 1000);
    await db.update(gmailAccounts).set({ lastSyncAt: now, updatedAt: now }).where(eq(gmailAccounts.userId, userId));
    await db.update(syncRuns).set({ status: "completed", messagesScanned: stats.scanned, transactionsCreated: stats.created, duplicatesSkipped: stats.duplicates, parseFailures: stats.failures, finishedAt: now }).where(eq(syncRuns.id, runId));
    return stats;
  } catch (error) {
    await db.update(syncRuns).set({ status: "failed", messagesScanned: stats.scanned, transactionsCreated: stats.created, duplicatesSkipped: stats.duplicates, parseFailures: stats.failures, errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Error inesperado", finishedAt: Math.floor(Date.now() / 1000) }).where(eq(syncRuns.id, runId));
    throw error;
  }
}
