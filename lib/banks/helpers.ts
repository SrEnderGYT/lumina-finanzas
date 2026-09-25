import type { EmailInput, OperationType, ParsedTransaction } from "./types";

export const normalize = (value: string) => value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

const AMOUNT_TOKEN = /^(?:\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d{1,2})?$/;

export function parseAmountToken(raw: string): number {
  const token = raw.replace(/[.,]+$/, "");
  // Rechaza formatos malformados ("1..2", "1,2,3") en lugar de aceptar un prefijo con parseFloat.
  if (!AMOUNT_TOKEN.test(token)) return Number.NaN;
  const lastDot = token.lastIndexOf(".");
  const lastComma = token.lastIndexOf(",");
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    // El último separador es el decimal: "1,234.50" (PE/US) o "1.234,50" (europeo).
    normalized = lastDot > lastComma ? token.replace(/,/g, "") : token.replace(/\./g, "").replace(",", ".");
  } else if (lastComma >= 0) {
    // "1,234" o "1,234,567" son miles; "67,40" es decimal.
    normalized = /^\d{1,3}(,\d{3})+$/.test(token) ? token.replace(/,/g, "") : token.replace(",", ".");
  } else if (lastDot >= 0) {
    normalized = /^\d{1,3}(\.\d{3}){2,}$/.test(token) ? token.replace(/\./g, "") : token;
  } else normalized = token;
  return Number.parseFloat(normalized);
}

export function extractAmount(text: string): { amountCents: number; currency: "PEN" | "USD" } | null {
  const match = text.match(/(S\/\.?|PEN|USD|US\$|\$)\s*(\d[\d.,]*)/i);
  if (!match) return null;
  const currency = /^(USD|US\$|\$)/i.test(match[1]) ? "USD" : "PEN";
  const amount = parseAmountToken(match[2]);
  return Number.isFinite(amount) && amount > 0 ? { amountCents: Math.round(amount * 100), currency } : null;
}

export function extractLast4(text: string): string | undefined {
  return text.match(/(?:terminada?|final|últimos?\s*4|\*{2,}|x{2,}|•{2,})\s*(?:en\s*)?(\d{4})/i)?.[1] ?? text.match(/tarjeta[^\d]{0,20}(\d{4})(?!\d)/i)?.[1];
}

export function extractDate(text: string, fallback: number): number {
  const direct = text.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!direct) return fallback;
  const [day, month] = [Number(direct[1]), Number(direct[2])];
  const year = Number(direct[3]) < 100 ? 2000 + Number(direct[3]) : Number(direct[3]);
  const hour = Number(direct[4] ?? 12), minute = Number(direct[5] ?? 0);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return fallback;
  const result = new Date(year, month - 1, day, hour, minute);
  // Rechaza desbordes como 31/02 que JS convertiría silenciosamente en marzo.
  if (result.getMonth() !== month - 1 || result.getDate() !== day) return fallback;
  return result.getTime();
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

/** Todos los montos (en centavos, por moneda) que aparecen en el texto; sirve para contrastar la salida de la IA. */
export function amountsInText(text: string): Set<string> {
  const found = new Set<string>();
  for (const match of text.matchAll(/(S\/\.?|PEN|USD|US\$|\$)\s*(\d[\d.,]*)/gi)) {
    const amount = parseAmountToken(match[2]);
    if (Number.isFinite(amount) && amount > 0) found.add(`${/^(USD|US\$|\$)/i.test(match[1]) ? "USD" : "PEN"}:${Math.round(amount * 100)}`);
  }
  return found;
}
