import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { gmailAccounts, syncRuns, transactions } from "@/db/schema";
import { getUserTaxonomy } from "@/lib/domain";
import { detectRecurring, HISTORY_MONTHS, merchantKey } from "@/lib/recurrence";
import { requireSession } from "@/lib/session";
import { DAY_MS, limaMonthKey, limaMonthStart, limaParts } from "@/lib/time";

const spendTypes = new Set(["expense", "card_charge", "subscription"]);

/** Interpreta `?month=YYYY-MM`; sin valor o con un valor inválido usa el mes actual. */
function parseMonth(value: string | null): { year: number; month: number } {
  const match = value?.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (match) return { year: Number(match[1]), month: Number(match[2]) - 1 };
  const { year, month } = limaParts(Date.now());
  return { year, month };
}

export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    const db = getDb();
    const url = new URL(request.url);
    const { year, month } = parseMonth(url.searchParams.get("month"));
    const periodStart = limaMonthStart(year, month);
    const periodEnd = limaMonthStart(year, month + 1) - 1;
    const previousStart = limaMonthStart(year, month - 1);
    // El historial (hasta 6 meses) solo se usa para detectar recurrencia; los reportes se calculan con el mes seleccionado.
    const historyStart = limaMonthStart(year, month - (HISTORY_MONTHS - 1));
    const owned = and(eq(transactions.userId, session.userId), isNull(transactions.deletedAt));
    const [windowRows, dateRows, taxonomy, accountRows, runRows] = await Promise.all([
      db.select().from(transactions).where(and(owned, gte(transactions.operationDate, historyStart), lte(transactions.operationDate, periodEnd))).orderBy(desc(transactions.operationDate)).limit(5000),
      db.select({ date: transactions.operationDate }).from(transactions).where(owned),
      getUserTaxonomy(session.userId),
      db.select({ email: gmailAccounts.email, lastSyncAt: gmailAccounts.lastSyncAt }).from(gmailAccounts).where(eq(gmailAccounts.userId, session.userId)).limit(1),
      db.select().from(syncRuns).where(eq(syncRuns.userId, session.userId)).orderBy(desc(syncRuns.startedAt)).limit(1),
    ]);
    const cardsById = new Map(taxonomy.cards.map((card) => [card.id, card]));
    const cardLabel = (row: (typeof windowRows)[number]) => {
      const card = row.cardId ? cardsById.get(row.cardId) : undefined;
      return card ? (card.alias || `${card.brand} •••• ${card.last4}`) : row.cardLast4 ? `${row.cardType || "Tarjeta"} •••• ${row.cardLast4}` : null;
    };

    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const bank = url.searchParams.get("bank");
    const cardId = url.searchParams.get("cardId");
    const categoryId = url.searchParams.get("categoryId");
    const passes = (row: (typeof windowRows)[number]) =>
      (!q || `${row.merchant} ${row.description || ""} ${row.bank}`.toLowerCase().includes(q)) && (!bank || row.bank === bank) && (!cardId || row.cardId === cardId) && (!categoryId || row.categoryId === categoryId);
    const scoped = windowRows.filter(passes);
    const inPeriod = scoped.filter((row) => row.operationDate >= periodStart);
    const previousPeriod = scoped.filter((row) => row.operationDate >= previousStart && row.operationDate < periodStart);

    const sum = (items: typeof windowRows, predicate: (row: (typeof windowRows)[number]) => boolean = () => true) => items.filter(predicate).reduce((total, row) => total + row.amountCents, 0);
    const spend = (row: (typeof windowRows)[number]) => spendTypes.has(row.operationType);

    const recurring = detectRecurring(
      windowRows.map((row) => ({ merchant: row.merchant, amountCents: row.amountCents, currency: row.currency, operationDate: row.operationDate, operationType: row.operationType, cardKey: row.cardId ?? row.cardLast4, cardLabel: cardLabel(row) })),
      periodStart, periodEnd,
    );
    const subscriptionMerchants = new Set(recurring.filter((item) => item.kind === "subscription").map((item) => merchantKey(item.merchant)));
    const isSubscription = (row: (typeof windowRows)[number]) => spend(row) && (row.operationType === "subscription" || subscriptionMerchants.has(merchantKey(row.merchant)));

    const expenses = sum(inPeriod, spend);
    const income = sum(inPeriod, (row) => row.operationType === "income");
    const refunds = sum(inPeriod, (row) => row.operationType === "refund");
    const grouped = (label: (row: (typeof windowRows)[number]) => string) =>
      Object.entries(inPeriod.filter(spend).reduce<Record<string, number>>((acc, row) => { const name = label(row); acc[name] = (acc[name] || 0) + row.amountCents; return acc; }, {}))
        .map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const today = limaParts(Date.now());
    const isCurrentMonth = today.year === year && today.month === month;
    const trendDays = isCurrentMonth ? today.day : lastDay;
    const trend = Array.from({ length: trendDays }, (_, index) => {
      const currentEnd = periodStart + (index + 1) * DAY_MS - 1;
      const previousEnd = previousStart + (index + 1) * DAY_MS - 1;
      return {
        day: String(index + 1).padStart(2, "0"),
        current: sum(inPeriod, (row) => spend(row) && row.operationDate <= currentEnd),
        previous: sum(previousPeriod, (row) => spend(row) && row.operationDate <= previousEnd),
      };
    });

    const todayStart = limaMonthStart(today.year, today.month) + (today.day - 1) * DAY_MS;
    const availableMonths = [...new Set(dateRows.map((row) => limaMonthKey(row.date)))].sort().reverse();
    return Response.json({
      user: { email: session.email, name: session.email.split("@")[0] },
      account: accountRows[0] ?? null,
      latestSync: runRows[0] ?? null,
      period: { month: `${year}-${String(month + 1).padStart(2, "0")}`, start: periodStart, end: periodEnd },
      availableMonths,
      totals: {
        expensesCents: expenses, incomeCents: income, refundsCents: refunds,
        transfersCents: sum(inPeriod, (row) => row.operationType === "transfer"),
        subscriptionsCents: sum(inPeriod, isSubscription),
        balanceCents: income + refunds - expenses,
        transactionCount: inPeriod.length,
      },
      summary: {
        currentMonthCents: expenses,
        previousMonthCents: sum(previousPeriod, spend),
        todayCents: isCurrentMonth ? sum(inPeriod, (row) => spend(row) && row.operationDate >= todayStart) : 0,
        transactionCount: inPeriod.length,
      },
      trend,
      byBank: grouped((row) => row.bank || "Sin identificar"),
      byCard: grouped((row) => cardLabel(row) ?? "Sin tarjeta"),
      byCategory: grouped((row) => row.category || "Sin identificar"),
      byMerchant: grouped((row) => row.merchant || "Sin identificar").slice(0, 12),
      recurring,
      ...taxonomy,
      banks: [...new Set(windowRows.map((row) => row.bank))].sort(),
      transactions: inPeriod.map((row) => ({ ...row, maskedCard: row.cardLast4 ? `${row.cardType || "Tarjeta"} •••• ${row.cardLast4}` : null })),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: error instanceof Error ? error.message : "No se pudieron cargar tus datos." }, { status: 500 });
  }
}
