import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { transactions } from "@/db/schema";
import { requireSession } from "@/lib/session";

const spendTypes = new Set(["expense", "card_charge", "subscription"]);
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getTime();

export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    const rows = await getDb().select().from(transactions).where(eq(transactions.userId, session.userId)).orderBy(desc(transactions.operationDate)).limit(500);
    const url = new URL(request.url);
    const search = (url.searchParams.get("q") ?? "").toLowerCase();
    const bank = url.searchParams.get("bank");
    const category = url.searchParams.get("category");
    const filtered = rows.filter((row) => (!search || `${row.merchant} ${row.description} ${row.bank} ${row.category}`.toLowerCase().includes(search)) && (!bank || row.bank === bank) && (!category || row.category === category));
    const now = new Date();
    const monthStart = startOfMonth(now);
    const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const previousEnd = monthStart - 1;
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const amount = (items: typeof rows) => items.filter((row) => spendTypes.has(row.operationType)).reduce((sum, row) => sum + row.amountCents, 0);
    const current = amount(rows.filter((row) => row.operationDate >= monthStart));
    const previous = amount(rows.filter((row) => row.operationDate >= previousStart && row.operationDate <= previousEnd));
    const today = amount(rows.filter((row) => row.operationDate >= todayStart));
    const group = (key: "bank" | "category" | "cardLast4") => Object.entries(rows.filter((row) => row.operationDate >= monthStart && spendTypes.has(row.operationType)).reduce<Record<string, number>>((acc, row) => { const label = row[key] || "Sin identificar"; acc[label] = (acc[label] ?? 0) + row.amountCents; return acc; }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const trend = Array.from({ length: now.getDate() }, (_, index) => {
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), index + 2).getTime() - 1;
      const prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, index + 2).getTime() - 1;
      return { day: String(index + 1).padStart(2, "0"), current: amount(rows.filter((row) => row.operationDate >= monthStart && row.operationDate <= dayEnd)), previous: amount(rows.filter((row) => row.operationDate >= previousStart && row.operationDate <= prevEnd)) };
    });
    return Response.json({
      user: { email: session.email, name: session.email.split("@")[0] }, summary: { currentMonthCents: current, todayCents: today, previousMonthCents: previous, changePercent: previous ? ((current - previous) / previous) * 100 : null }, trend,
      byBank: group("bank"), byCategory: group("category"), byCard: group("cardLast4"), filters: { banks: [...new Set(rows.map((row) => row.bank))], categories: [...new Set(rows.map((row) => row.category))] },
      transactions: filtered.slice(0, 100).map((row) => ({ id: row.id, merchant: row.merchant, detail: row.description, amountCents: row.amountCents, currency: row.currency, operationDate: row.operationDate, bank: row.bank, card: [row.cardType, row.cardLast4 ? `• ${row.cardLast4}` : ""].filter(Boolean).join(" "), category: row.category, operationType: row.operationType, confidence: row.confidence })),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo cargar el dashboard." }, { status: 500 });
  }
}
