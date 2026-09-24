import type { EmailInput, OperationType, ParsedTransaction } from "./types";

export const normalize = (value: string) => value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

export function extractAmount(text: string): { amountCents: number; currency: "PEN" | "USD" } | null {
  const match = text.match(/(?:S\/?|PEN|USD|US\$|\$)\s*([\d.,]+)/i);
  if (!match) return null;
  const currency = /USD|US\$|\$/i.test(match[0]) && !/S\//i.test(match[0]) ? "USD" : "PEN";
  const raw = match[1];
  const decimal = raw.includes(",") && !raw.includes(".") ? raw.replace(",", ".") : raw.replace(/,/g, "");
  const amount = Number.parseFloat(decimal);
  return Number.isFinite(amount) ? { amountCents: Math.round(amount * 100), currency } : null;
}

export function extractLast4(text: string): string | undefined {
  return text.match(/(?:terminada?|final|últimos?\s*4|\*{2,}|x{2,}|•{2,})\s*(?:en\s*)?(\d{4})/i)?.[1] ?? text.match(/tarjeta[^\d]{0,20}(\d{4})(?!\d)/i)?.[1];
}

export function extractDate(text: string, fallback: number): number {
  const direct = text.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!direct) return fallback;
  const year = Number(direct[3]) < 100 ? 2000 + Number(direct[3]) : Number(direct[3]);
  const result = new Date(year, Number(direct[2]) - 1, Number(direct[1]), Number(direct[4] ?? 12), Number(direct[5] ?? 0));
  return Number.isNaN(result.getTime()) ? fallback : result.getTime();
}

export function operationType(text: string): OperationType {
  if (/devoluci[oó]n|reembolso|refund|revers[oa]/i.test(text)) return "refund";
  if (/transferencia|yape|plin|enviaste|transferiste/i.test(text)) return "transfer";
  if (/abono|dep[oó]sito|recibiste|ingreso/i.test(text)) return "income";
  if (/estado de cuenta|resumen mensual|statement/i.test(text)) return "statement";
  if (/suscripci[oó]n|pago recurrente|membres[ií]a/i.test(text)) return "subscription";
  return /cr[eé]dito/i.test(text) ? "card_charge" : "expense";
}

export function parseCommon(email: EmailInput, bank: string, parserId: string, merchantPatterns: RegExp[], confidence = .88): ParsedTransaction | null {
  const text = normalize(`${email.subject} ${email.body}`);
  const amount = extractAmount(text);
  if (!amount) return null;
  let merchant = "Comercio no identificado";
  for (const pattern of merchantPatterns) { const match = text.match(pattern); if (match?.[1]) { merchant = normalize(match[1]).replace(/[.,;:]$/, ""); break; } }
  return { bank, merchant, operationDate: extractDate(text, email.internalDate), ...amount, cardLast4: extractLast4(text), cardType: /d[eé]bito/i.test(text) ? "Débito" : /cr[eé]dito|visa|mastercard/i.test(text) ? "Crédito" : undefined, operationType: operationType(text), description: email.subject, confidence, parserId };
}
