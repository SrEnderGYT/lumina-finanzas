import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { gmailAccounts, syncRuns, transactions } from "@/db/schema";
import { getUserTaxonomy } from "@/lib/domain";
import { requireSession } from "@/lib/session";

const spendTypes = new Set(["expense", "card_charge", "subscription"]);
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getTime();

export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    const db = getDb();
    const [rows, taxonomy, accountRows, runRows] = await Promise.all([
      db.select().from(transactions).where(and(eq(transactions.userId, session.userId), isNull(transactions.deletedAt))).orderBy(desc(transactions.operationDate)).limit(1000),
      getUserTaxonomy(session.userId),
      db.select({ email: gmailAccounts.email, lastSyncAt: gmailAccounts.lastSyncAt }).from(gmailAccounts).where(eq(gmailAccounts.userId, session.userId)).limit(1),
      db.select().from(syncRuns).where(eq(syncRuns.userId, session.userId)).orderBy(desc(syncRuns.startedAt)).limit(1),
    ]);
    const url = new URL(request.url);
    const from = Number(url.searchParams.get("from") || 0);
    const to = Number(url.searchParams.get("to") || Number.MAX_SAFE_INTEGER);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const bank = url.searchParams.get("bank");
    const cardId = url.searchParams.get("cardId");
    const categoryId = url.searchParams.get("categoryId");
    const scoped = rows.filter((row) => (!q || `${row.merchant} ${row.description || ""} ${row.bank}`.toLowerCase().includes(q)) && (!bank || row.bank === bank) && (!cardId || row.cardId === cardId) && (!categoryId || row.categoryId === categoryId));
    const filtered = scoped.filter((row) => row.operationDate >= from && row.operationDate <= to);
    const now = new Date();
    const monthStart = startOfMonth(now);
    const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const total = (items: typeof rows) => items.filter((row) => spendTypes.has(row.operationType)).reduce((sum, row) => sum + row.amountCents, 0);
    const current = total(scoped.filter((row) => row.operationDate >= monthStart));
    const previous = total(scoped.filter((row) => row.operationDate >= previousStart && row.operationDate < monthStart));
    const today = total(scoped.filter((row) => row.operationDate >= todayStart));
    const grouped = (key: "bank" | "category") => Object.entries(filtered.filter((row) => spendTypes.has(row.operationType)).reduce<Record<string, number>>((acc, row) => { const name = row[key] || "Sin identificar"; acc[name] = (acc[name] || 0) + row.amountCents; return acc; }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const cardsById = new Map(taxonomy.cards.map((card) => [card.id, card]));
    const byCard = Object.entries(filtered.filter((row) => spendTypes.has(row.operationType)).reduce<Record<string, number>>((acc, row) => {
      const card = row.cardId ? cardsById.get(row.cardId) : undefined;
      const name = card ? (card.alias || `${card.brand} •••• ${card.last4}`) : row.cardLast4 ? `${row.cardType || "Tarjeta"} •••• ${row.cardLast4}` : "Sin tarjeta";
      acc[name] = (acc[name] || 0) + row.amountCents;
      return acc;
    }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const trend = Array.from({ length: now.getDate() }, (_, index) => {
      const currentEnd = new Date(now.getFullYear(), now.getMonth(), index + 2).getTime() - 1;
      const previousEnd = new Date(now.getFullYear(), now.getMonth() - 1, index + 2).getTime() - 1;
      return { day: String(index + 1).padStart(2, "0"), current: total(scoped.filter((row) => row.operationDate >= monthStart && row.operationDate <= currentEnd)), previous: total(scoped.filter((row) => row.operationDate >= previousStart && row.operationDate <= previousEnd)) };
    });
    return Response.json({
      user: { email: session.email, name: session.email.split("@")[0] },
      account: accountRows[0] ?? null,
      latestSync: runRows[0] ?? null,
      summary: { currentMonthCents: current, todayCents: today, previousMonthCents: previous, transactionCount: scoped.filter((row) => row.operationDate >= monthStart).length },
      trend, byBank: grouped("bank"), byCard, byCategory: grouped("category"), ...taxonomy,
      banks: [...new Set(rows.map((row) => row.bank))].sort(),
      transactions: filtered.map((row) => ({ ...row, maskedCard: row.cardLast4 ? `${row.cardType || "Tarjeta"} •••• ${row.cardLast4}` : null })),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: error instanceof Error ? error.message : "No se pudieron cargar tus datos." }, { status: 500 });
  }
}
