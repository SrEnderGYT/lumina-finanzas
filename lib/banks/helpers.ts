import { limaTimestamp } from "../time";
import type { EmailInput, OperationType, ParsedTransaction } from "./types";

export const UNKNOWN_MERCHANT = "Comercio no identificado";

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
  return text.match(/(?:terminada?|final|últimos?\s*4|\*+|x{2,}|•{2,})\s*(?:en\s*)?(\d{4})/i)?.[1] ?? text.match(/tarjeta[^\d]{0,20}(\d{4})(?!\d)/i)?.[1];
}

export function extractDate(text: string, fallback: number): number {
  const direct = text.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?:\s*([ap])\.?\s*m\.?)?)?/i);
  if (!direct) return fallback;
  const [day, month] = [Number(direct[1]), Number(direct[2])];
  const year = Number(direct[3]) < 100 ? 2000 + Number(direct[3]) : Number(direct[3]);
  const rawHour = Number(direct[4] ?? 12), minute = Number(direct[5] ?? 0), meridiem = direct[6]?.toLowerCase();
  if (month < 1 || month > 12 || day < 1 || day > 31 || rawHour > (meridiem ? 12 : 23) || rawHour < (meridiem ? 1 : 0) || minute > 59) return fallback;
  const hour = meridiem ? (rawHour % 12) + (meridiem === "p" ? 12 : 0) : rawHour;
  // Rechaza desbordes como 31/02 que JS convertiría silenciosamente en marzo.
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return fallback;
  // Los correos traen la hora de Lima; se convierte a un instante UTC para que el mes no dependa del servidor.
  return limaTimestamp(year, month - 1, day, hour, minute);
}

export function operationType(text: string): OperationType {
  // No basta con que un pie legal mencione una posible devolución: debe describir un reembolso efectuado.
  if (/^(?:devoluci[oó]n|reembolso|refund|revers[oa])\b|\b(?:devoluci[oó]n|reembolso|refund|revers[oa])\s+(?:realizad[oa]|procesad[oa]|aprobad[oa]|efectuad[oa])\b|\b(?:te (?:devolvimos|reembolsamos)|hemos (?:devuelto|reembolsado))\b|\b(?:recibiste|te abonamos)\b[^.]{0,80}\b(?:una?\s+)?(?:devoluci[oó]n|reembolso|refund|revers[oa])\b/i.test(text)) return "refund";
  if (/recibiste|te (?:yape|pline|transfiri)[oó]|te (?:depositaron|abonaron)/i.test(text)) return "income";
  // Pagar la tarjeta es mover dinero entre tus productos: sumarlo como gasto duplicaría los consumos ya registrados.
  if (/pago de (?:tu |la )?tarjeta|pago de (?:tu )?l[ií]nea/i.test(text)) return "transfer";
  if (/transferencia|yape|plin|enviaste|transferiste/i.test(text)) return "transfer";
  if (/\bretiro\b/i.test(text)) return "expense";
  if (/abono|dep[oó]sito|recibiste|ingreso/i.test(text)) return "income";
  if (/estado de cuenta|resumen mensual|statement/i.test(text)) return "statement";
  if (/suscripci[oó]n|pago recurrente|membres[ií]a/i.test(text)) return "subscription";
  return /cr[eé]dito/i.test(text) ? "card_charge" : "expense";
}

// Comercio/contraparte cuando el parser del banco no lo encuentra: "pagaste … a X", "retiro … en cajero X", "suscripción a X".
const FALLBACK_MERCHANT_PATTERNS: RegExp[] = [
  // "Usaste tu tarjeta terminada en 1234 en WONG." / "Nuevo consumo en WONG" / "Cargo en WONG"
  /\b(?:usaste|utilizaste)\b[^.]{0,60}?\ben\s+(?!\d)([^.,;|]{2,40}?)(?=\s+(?:monto|por|el|con)\b|[.,;]|$)/i,
  /\b(?:nuevo consumo|cargo)\s+en\s+(?!\d)([^.,;|]{2,40}?)(?=\s+(?:monto|por|el|con|de tu)\b|[.,;]|$)/i,
  // Ingresos: "Recibiste S/ 50.00 de Ana Gomez"
  /\brecibiste\b(?:[^.]|\.\d){0,40}?\s+de\s+([^.,;|]{2,50}?)(?=\s+(?:por|con|el|desde)\b|[.,;]|$)/i,
  /\bte\s+(?:hicieron un|enviaron un)\s+(?:yape|plin)\s+(?:de\s+)?([^.,;|]{2,40}?)(?=\s+(?:por|con|el)\b|[.,;]|$)/i,
  /\b(?:pagaste|transferiste|transferencia|enviaste|yapeaste|plineaste|depositaste)\b(?:[^.]|\.\d){0,70}?\s+a\s+(?:nombre de\s+)?([^.,;|]{2,50}?)(?=\s+(?:con|desde|el|de tu|por|usando|mediante)\b|[.,;]|$)/i,
  /\bretiro\b(?:[^.]|\.\d){0,40}?\ben\s+(cajero(?:(?!\bretiro\b)[^.,;]){0,40}?)(?=\s+(?:con|de tu|el)\b|[.,;]|$)/i,
  /\bsuscripci[oó]n\s+a\s+([^.,;|]{2,40}?)(?=\s+(?:con|el|de tu|por)\b|[.,;]|$)/i,
  /\bcompra\s+en\s+([^.,;|]{2,40}?)(?=\s+(?:con|el|de tu|por)\b|[.,;]|$)/i,
];
// Capturas que en realidad son montos, números o frases del encabezado, no un comercio.
const merchantNoise = (value: string) => /\b(?:S\/|USD|US\$|PEN)\s*\d|^\d[\d\s.,-]*$|^\d{2,}\s+(?:en|por|con)\b|\bconstancia\b|\boperaci[oó]n\b|\bsorteos?\s+o\s+promociones?\b|\bnuestros correos\b|^(?:de|un|una|tu|su)\s/i.test(value) || value.length < 2;

export function parseCommon(email: EmailInput, bank: string, parserId: string, merchantPatterns: RegExp[], confidence = .88): ParsedTransaction | null {
  const text = normalize(`${email.subject} ${email.body}`);
  const amount = extractAmount(text);
  if (!amount) return null;
  let merchant = UNKNOWN_MERCHANT;
  search: for (const pattern of [...merchantPatterns, ...FALLBACK_MERCHANT_PATTERNS]) {
    // Se revisan todas las coincidencias: la primera puede caer en el asunto y ser ruido.
    for (const match of text.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))) {
      const candidate = match[1] ? normalize(match[1]).replace(/[.,;:]$/, "") : "";
      if (candidate && !merchantNoise(candidate)) { merchant = candidate; break search; }
    }
  }
  const cardType = /tarjeta\s+(?:de\s+)?cr[eé]dito/i.test(text) ? "Crédito" : /tarjeta\s+(?:de\s+)?d[eé]bito/i.test(text) ? "Débito" : /cr[eé]dito|visa|mastercard/i.test(text) ? "Crédito" : undefined;
  return { bank, merchant, operationDate: extractDate(text, email.internalDate), ...amount, cardLast4: extractLast4(text), cardType, operationType: operationType(text), description: email.subject, confidence, parserId };
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
