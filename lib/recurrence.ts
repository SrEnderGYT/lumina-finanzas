import { DAY_MS, limaMonthStart, limaParts } from "./time";

export type RecurrenceInput = {
  merchant: string; amountCents: number; currency: string; operationDate: number;
  operationType: string; cardKey?: string | null; cardLabel?: string | null;
};

export type RecurringItem = {
  merchant: string; kind: "subscription" | "possible"; months: number; medianCents: number; currency: string;
  lastDate: number; cadenceDays: number | null; cardLabel: string | null; confidence: number; activeInPeriod: boolean;
};

const SPEND = new Set(["expense", "card_charge", "subscription"]);
const AMOUNT_TOLERANCE = 0.15;

export const HISTORY_MONTHS = 6;

/** Servicios que se cobran por suscripción. Un comercio general (supermercado, taxi) solo llega a "posible recurrente". */
const SUBSCRIPTION_SERVICES = /\b(?:NETFLIX|SPOTIFY|DISNEY|HBO|MAX|PRIME|AMAZON PRIME|YOUTUBE|GOOGLE ONE|GOOGLE STORAGE|GOOGLE CLOUD|ICLOUD|APPLE|MICROSOFT|OFFICE|ADOBE|CANVA|CHATGPT|OPENAI|ANTHROPIC|CLAUDE|CLARO|MOVISTAR|ENTEL|BITEL|WIN|DIRECTV|PARAMOUNT|CRUNCHYROLL|DEEZER|PLAYSTATION|XBOX|NINTENDO|DROPBOX|ZOOM|NOTION|LINKEDIN|SMART FIT|SMARTFIT|BODYTECH|GYM|SEGURO|MEMBRESIA)\b/;

/** ¿Este movimiento corresponde a la misma suscripción detectada? Compara comercio, moneda y rango de monto, no solo el nombre. */
export function matchesRecurring(item: Pick<RecurringItem, "merchant" | "currency" | "medianCents">, row: { merchant: string; currency: string; amountCents: number }): boolean {
  return merchantKey(item.merchant) === merchantKey(row.merchant) && item.currency === row.currency && Math.abs(row.amountCents - item.medianCents) <= item.medianCents * AMOUNT_TOLERANCE;
}

/** Clave estable de comercio: mayúsculas, sin números de sucursal/operación ni signos ("NETFLIX.COM 8842" → "NETFLIX COM"). */
export function merchantKey(merchant: string): string {
  return merchant.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z\s]/g, " ").replace(/\s+/g, " ").trim();
}

const monthIndex = (ms: number) => { const { year, month } = limaParts(ms); return year * 12 + month; };
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2); };

/**
 * Detecta suscripciones y pagos recurrentes con hasta 6 meses de historial que terminan en el mes analizado.
 * Solo sirve para el análisis: cada movimiento sigue perteneciendo al mes en que ocurrió.
 * Una compra que aparece una sola vez nunca es recurrente; la confianza sube con cada mes distinto en que
 * el mismo comercio cobra un monto parecido, y con periodicidad mensual y la misma tarjeta.
 */
export function detectRecurring(rows: RecurrenceInput[], periodStart: number, periodEnd: number): RecurringItem[] {
  const { year, month } = limaParts(periodStart);
  const windowStart = limaMonthStart(year, month - (HISTORY_MONTHS - 1));
  const inWindow = rows.filter((row) => SPEND.has(row.operationType) && row.operationDate >= windowStart && row.operationDate <= periodEnd && merchantKey(row.merchant).length >= 2);
  const groups = new Map<string, RecurrenceInput[]>();
  for (const row of inWindow) {
    const key = `${merchantKey(row.merchant)}|${row.currency}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const items: RecurringItem[] = [];
  for (const group of groups.values()) {
    // Agrupa por monto parecido: dos cobros de S/ 45 y uno de S/ 300 en el mismo comercio no son la misma suscripción.
    const base = median(group.map((row) => row.amountCents));
    const similar = group.filter((row) => Math.abs(row.amountCents - base) <= base * AMOUNT_TOLERANCE);
    const months = new Set(similar.map((row) => monthIndex(row.operationDate)));
    if (months.size < 2) continue;
    const dates = similar.map((row) => row.operationDate).sort((a, b) => a - b);
    const gaps = dates.slice(1).map((date, index) => Math.round((date - dates[index]) / DAY_MS)).filter((gap) => gap >= 5);
    const cadence = gaps.length ? median(gaps) : null;
    const monthly = cadence !== null && cadence >= 25 && cadence <= 35;
    const sameCard = new Set(similar.map((row) => row.cardKey ?? "")).size === 1 && Boolean(similar[0].cardKey);
    const explicit = similar.some((row) => row.operationType === "subscription");
    const consecutive = [...months].sort((a, b) => a - b).every((month, index, all) => index === 0 || month - all[index - 1] === 1);
    let confidence = 0.35 + 0.15 * Math.min(months.size - 2, 4);
    if (monthly) confidence += 0.2;
    if (sameCard) confidence += 0.1;
    if (consecutive) confidence += 0.1;
    if (explicit) confidence += 0.05;
    confidence = Math.min(0.99, confidence);
    const last = similar.reduce((a, b) => (b.operationDate > a.operationDate ? b : a));
    items.push({
      merchant: last.merchant, kind: confidence >= 0.65 && months.size >= 3 && (explicit || SUBSCRIPTION_SERVICES.test(merchantKey(last.merchant))) ? "subscription" : "possible", months: months.size,
      medianCents: median(similar.map((row) => row.amountCents)), currency: last.currency, lastDate: last.operationDate,
      cadenceDays: cadence, cardLabel: last.cardLabel ?? null, confidence: Math.round(confidence * 100) / 100,
      activeInPeriod: similar.some((row) => row.operationDate >= periodStart && row.operationDate <= periodEnd),
    });
  }
  return items.sort((a, b) => b.confidence - a.confidence || b.medianCents - a.medianCents);
}
