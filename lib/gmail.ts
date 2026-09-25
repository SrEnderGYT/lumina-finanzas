import { and, eq, inArray, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { gmailAccounts, processedMessages, syncRuns, transactions } from "@/db/schema";
import { parseWithAi } from "./ai-fallback";
import { parseBankEmail, validateParsed, type EmailInput } from "./banks";
import { classifyEmail, decideConfidence, type Decision } from "./banks/classify";
import { amountsInText, extractAmount, normalize } from "./banks/helpers";
import { createClassifier, ensureCard } from "./domain";
import { decryptSecret, encryptSecret } from "./crypto";
import { requireSecret } from "./runtime-env";

type GmailHeader = { name: string; value: string };
type GmailPart = { mimeType?: string; body?: { data?: string }; parts?: GmailPart[] };
type GmailMessage = { id: string; threadId?: string; internalDate?: string; labelIds?: string[]; payload?: GmailPart & { headers?: GmailHeader[] } };

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
  if (!response.ok) throw new ReconnectRequiredError("Google rechazó la renovación de la sesión. Vuelve a conectar Gmail.");
  return response.json() as Promise<{ access_token: string; expires_in: number }>;
}

async function validAccessToken(userId: string): Promise<string> {
  const db = getDb();
  const [account] = await db.select().from(gmailAccounts).where(eq(gmailAccounts.userId, userId)).limit(1);
  if (!account) throw new ReconnectRequiredError("Gmail no está conectado.");
  const secret = requireSecret("APP_ENCRYPTION_KEY");
  if (account.tokenExpiresAt > Math.floor(Date.now() / 1000) + 90) return decryptSecret(account.accessTokenEncrypted, secret);
  if (!account.refreshTokenEncrypted) throw new ReconnectRequiredError("La autorización de Gmail venció. Vuelve a conectar tu cuenta.");
  const refreshed = await exchangeRefreshToken(await decryptSecret(account.refreshTokenEncrypted, secret));
  await db.update(gmailAccounts).set({ accessTokenEncrypted: await encryptSecret(refreshed.access_token, secret), tokenExpiresAt: Math.floor(Date.now() / 1000) + refreshed.expires_in, updatedAt: Math.floor(Date.now() / 1000) }).where(eq(gmailAccounts.userId, userId));
  return refreshed.access_token;
}

// Tope pensado para los límites de Workers/D1 (≈50 subrequests y consultas por invocación en el plan gratuito).
const MAX_NEW_MESSAGES_PER_RUN = 20;
const FETCH_CONCURRENCY = 5;
const RUN_LOCK_SECONDS = 600;

export class ReconnectRequiredError extends Error {
  constructor(message = "Gmail rechazó el acceso. Vuelve a conectar tu cuenta.") { super(message); }
}

export class GmailHttpError extends Error {
  constructor(readonly status: number) { super(`Gmail API respondió ${status}.`); }
}

export class SyncInProgressError extends Error {
  constructor() { super("Ya hay una sincronización en curso. Espera a que termine."); }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function gmailFetch<T>(accessToken: string, path: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { headers: { authorization: `Bearer ${accessToken}` } });
    if (response.ok) return response.json() as Promise<T>;
    // Reintenta límites de tasa y errores transitorios con backoff; el resto falla de inmediato.
    if ((response.status === 429 || response.status >= 500) && attempt < 3) { await sleep(400 * 2 ** attempt); continue; }
    if (response.status === 401) throw new ReconnectRequiredError();
    throw new GmailHttpError(response.status);
  }
}

async function mapLimit<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const index = next++; results[index] = await work(items[index]); }
  }));
  return results;
}

/** Bloqueo por usuario respaldado por un índice único parcial; una ejecución "running" vencida se considera caída. */
async function acquireRun(userId: string): Promise<string> {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  await db.update(syncRuns).set({ status: "failed", errorMessage: "La ejecución expiró sin terminar.", finishedAt: now }).where(and(eq(syncRuns.userId, userId), eq(syncRuns.status, "running"), lt(syncRuns.startedAt, now - RUN_LOCK_SECONDS)));
  const runId = crypto.randomUUID();
  try {
    await db.insert(syncRuns).values({ id: runId, userId, status: "running" });
  } catch (error) {
    if (/unique/i.test(String((error as { message?: string; cause?: { message?: string } })?.message) + String((error as { cause?: { message?: string } })?.cause?.message))) throw new SyncInProgressError();
    throw error;
  }
  return runId;
}

/** La IA solo se consulta si el correo parece financiero, y su resultado debe coincidir con montos presentes en el texto. */
function aiCandidate(email: EmailInput): boolean {
  return Boolean(extractAmount(normalize(`${email.subject} ${email.body}`)));
}

function aiAgrees(parsed: { amountCents: number; currency: string }, email: EmailInput): boolean {
  return amountsInText(normalize(`${email.subject} ${email.body}`)).has(`${parsed.currency}:${parsed.amountCents}`);
}

export async function syncGmail(userId: string) {
  const db = getDb();
  const runId = await acquireRun(userId);
  const stats = { scanned: 0, created: 0, duplicates: 0, failures: 0, promotions: 0, retry: 0, remaining: 0, hasMore: false };
  try {
    const accessToken = await validAccessToken(userId);
    const [account] = await db.select().from(gmailAccounts).where(eq(gmailAccounts.userId, userId)).limit(1);
    // El cursor nuevo se toma ANTES de listar: un correo que llegue durante el proceso queda cubierto por la siguiente ejecución.
    const startProfile = await gmailFetch<{ historyId?: string }>(accessToken, "profile");
    const messageIds = new Set<string>();
    let historyTruncatedAt: string | undefined;
    let fallbackIncomplete = false;
    if (account?.lastSyncAt && account.historyId) {
      let pageToken: string | undefined;
      let lastRecordId: string | undefined;
      try {
        for (let page = 0; page < 10; page++) {
          const suffix = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
          const result = await gmailFetch<{ history?: Array<{ id?: string; messagesAdded?: Array<{ message?: { id?: string } }> }>; nextPageToken?: string }>(accessToken, `history?startHistoryId=${encodeURIComponent(account.historyId)}&historyTypes=messageAdded&maxResults=100${suffix}`);
          for (const event of result.history ?? []) {
            if (event.id) lastRecordId = event.id;
            for (const added of event.messagesAdded ?? []) if (added.message?.id) messageIds.add(added.message.id);
          }
          pageToken = result.nextPageToken;
          if (!pageToken) break;
        }
        // Quedaron páginas sin leer: el cursor solo puede avanzar hasta el último registro procesado.
        if (pageToken) historyTruncatedAt = lastRecordId;
      } catch (error) {
        // Solo un historial vencido (404) justifica el respaldo por búsqueda; cualquier otro fallo aborta sin mover el cursor.
        if (!(error instanceof GmailHttpError && error.status === 404)) throw error;
        const after = Math.max(0, account.lastSyncAt - 300);
        const query = encodeURIComponent(`after:${after} (compra OR consumo OR cargo OR transacción OR movimiento)`);
        let fallbackToken: string | undefined;
        for (let page = 0; page < 10; page++) {
          const suffix = fallbackToken ? `&pageToken=${encodeURIComponent(fallbackToken)}` : "";
          const result = await gmailFetch<{ messages?: Array<{ id: string }>; nextPageToken?: string }>(accessToken, `messages?q=${query}&maxResults=100${suffix}`);
          for (const item of result.messages ?? []) messageIds.add(item.id);
          fallbackToken = result.nextPageToken;
          if (!fallbackToken) break;
        }
        // Sin poder leer todo, no se avanza el cursor: lo ya guardado se omite en la siguiente ejecución.
        if (fallbackToken) fallbackIncomplete = true;
      }
    } else {
      // Importación inicial: los últimos 12 meses, con tope de 5 páginas (≈500 correos más recientes).
      let pageToken: string | undefined;
      const query = encodeURIComponent('newer_than:365d (compra OR consumo OR cargo OR "pago con tarjeta" OR transacción OR movimiento)');
      for (let page = 0; page < 5; page++) {
        const suffix = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
        const result = await gmailFetch<{ messages?: Array<{ id: string }>; nextPageToken?: string }>(accessToken, `messages?q=${query}&maxResults=100${suffix}`);
        for (const item of result.messages ?? []) messageIds.add(item.id);
        pageToken = result.nextPageToken;
        if (!pageToken) break;
      }
    }
    const ids = [...messageIds];
    stats.scanned = ids.length;
    // Conocidos = ya convertidos en movimiento o revisados y descartados; una consulta por lote de 50.
    const known = new Set<string>();
    for (let offset = 0; offset < ids.length; offset += 50) {
      const chunk = ids.slice(offset, offset + 50);
      const [saved, ignored] = await Promise.all([
        db.select({ id: transactions.gmailMessageId }).from(transactions).where(and(eq(transactions.userId, userId), inArray(transactions.gmailMessageId, chunk))),
        db.select({ id: processedMessages.gmailMessageId }).from(processedMessages).where(and(eq(processedMessages.userId, userId), inArray(processedMessages.gmailMessageId, chunk))),
      ]);
      for (const row of [...saved, ...ignored]) known.add(row.id);
    }
    stats.duplicates = known.size;
    const fresh = ids.filter((id) => !known.has(id));
    const batch = fresh.slice(0, MAX_NEW_MESSAGES_PER_RUN);
    stats.remaining = fresh.length - batch.length;
    // Un fallo aislado de descarga no aborta el lote: ese correo se reintenta en la próxima ejecución.
    const messages = await mapLimit(batch, FETCH_CONCURRENCY, async (id) => {
      try { return await gmailFetch<GmailMessage>(accessToken, `messages/${id}?format=full`); }
      catch (error) {
        if (error instanceof ReconnectRequiredError) throw error;
        // El correo ya no existe (borrado tras listarse): descarte definitivo para no bloquear el cursor.
        if (error instanceof GmailHttpError && (error.status === 404 || error.status === 410)) {
          await db.insert(processedMessages).values({ userId, gmailMessageId: id, status: "gone" }).onConflictDoNothing();
          return null;
        }
        stats.retry++;
        return null;
      }
    });
    const classify = await createClassifier(userId);
    const cardCache = new Map<string, Awaited<ReturnType<typeof ensureCard>>>();
    for (const message of messages) {
      if (!message) continue;
      const email: EmailInput = { id: message.id, threadId: message.threadId, from: header(message, "From"), subject: header(message, "Subject"), body: partText(message.payload), internalDate: Number(message.internalDate ?? Date.now()), labels: message.labelIds, listUnsubscribe: Boolean(header(message, "List-Unsubscribe")) };
      // Flujo: clasificar el correo → extraer datos → decidir confianza → (solo si se acepta) registrar.
      const kind = classifyEmail(email);
      let parsed = parseBankEmail(email);
      let decision: Decision | null = null;
      let fromAi = false;
      let definitive = true;
      if (kind.kind === "transaction" && !parsed && aiCandidate(email)) {
        const ai = await parseWithAi(email);
        if (ai.kind === "parsed") {
          const checked = validateParsed(ai.value, email);
          if (checked && aiAgrees(checked, email)) { parsed = checked; fromAi = true; }
        } else if (ai.kind === "unavailable") {
          // Un fallo de infraestructura no es un veredicto sobre el correo: no se descarta.
          definitive = false;
          if (ai.retryable) stats.retry++;
        }
      }
      if (parsed) decision = decideConfidence(parsed, email, kind, fromAi);
      else decision = { accepted: false, kind: kind.kind, confidence: "low", reason: kind.kind === "transaction" ? "Rechazado: el correo parece una operación pero no se pudieron extraer los datos." : `Rechazado (${kind.kind}): ${kind.reasons.slice(0, 4).join("; ") || "sin señales de transacción"}` };
      if (!decision.accepted || !parsed) {
        stats.failures++;
        if (kind.kind === "promotion") stats.promotions++;
        if (definitive) await db.insert(processedMessages).values({ userId, gmailMessageId: message.id, status: "ignored", classification: decision.kind, confidenceLevel: decision.confidence, reason: decision.reason.slice(0, 500), subject: email.subject.slice(0, 200) }).onConflictDoNothing();
        continue;
      }
      const classification = classify(parsed.merchant, parsed.description);
      const cardKey = `${parsed.bank}|${parsed.cardLast4 ?? ""}`;
      if (!cardCache.has(cardKey)) cardCache.set(cardKey, await ensureCard(userId, parsed.bank, parsed.cardLast4, parsed.cardType, /visa/i.test(email.body) ? "VISA" : /mastercard/i.test(email.body) ? "Mastercard" : undefined));
      const card = cardCache.get(cardKey);
      const inserted = await db.insert(transactions).values({
        id: crypto.randomUUID(), userId, gmailMessageId: message.id, gmailThreadId: message.threadId, gmailInternalDate: email.internalDate,
        bank: parsed.bank, merchant: parsed.merchant, operationDate: parsed.operationDate, amountCents: parsed.amountCents, currency: parsed.currency,
        cardType: parsed.cardType, cardLast4: parsed.cardLast4, cardId: card?.id, operationType: parsed.operationType, category: classification.name,
        categoryId: classification.categoryId, subcategoryId: classification.subcategoryId, categorySource: classification.source, description: parsed.description,
        confidence: parsed.confidence, rawSubject: email.subject.slice(0, 500), parserId: parsed.parserId, source: "gmail",
        classification: decision.kind, confidenceLevel: decision.confidence, decisionReason: decision.reason.slice(0, 500),
      }).onConflictDoNothing().returning({ id: transactions.id });
      if (inserted.length) stats.created++; else stats.duplicates++;
    }
    const now = Math.floor(Date.now() / 1000);
    // El cursor solo avanza si no quedan correos por procesar ni descargas fallidas; lo ya guardado se omite al repetir.
    if (!stats.remaining && !stats.retry && !fallbackIncomplete) {
      if (historyTruncatedAt) await db.update(gmailAccounts).set({ historyId: historyTruncatedAt, updatedAt: now }).where(eq(gmailAccounts.userId, userId));
      else await db.update(gmailAccounts).set({ lastSyncAt: now, historyId: startProfile.historyId ?? account?.historyId, updatedAt: now }).where(eq(gmailAccounts.userId, userId));
    }
    stats.remaining += stats.retry;
    stats.hasMore = stats.remaining > 0 || Boolean(historyTruncatedAt) || fallbackIncomplete;
    await db.update(syncRuns).set({ status: "completed", messagesScanned: stats.scanned, transactionsCreated: stats.created, duplicatesSkipped: stats.duplicates, parseFailures: stats.failures, finishedAt: now }).where(eq(syncRuns.id, runId));
    return stats;
  } catch (error) {
    await db.update(syncRuns).set({ status: "failed", messagesScanned: stats.scanned, transactionsCreated: stats.created, duplicatesSkipped: stats.duplicates, parseFailures: stats.failures, errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Error inesperado", finishedAt: Math.floor(Date.now() / 1000) }).where(eq(syncRuns.id, runId));
    throw error;
  }
}
