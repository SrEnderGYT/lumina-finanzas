import type { EmailInput, OperationType, ParsedTransaction } from "./types";

const MAX_AMOUNT_CENTS = 100_000_000 * 100;
const OPERATION_TYPES: OperationType[] = ["expense", "card_charge", "subscription", "refund", "transfer", "income", "statement"];
const DAY_MS = 86_400_000;

/**
 * Normaliza y valida el resultado de cualquier parser (incluida la IA, cuya salida no es confiable).
 * Devuelve null si el movimiento no es utilizable; corrige campos recuperables (fecha, last4, textos).
 */
export function validateParsed(parsed: ParsedTransaction, email: Pick<EmailInput, "internalDate">): ParsedTransaction | null {
  if (!Number.isSafeInteger(parsed.amountCents) || parsed.amountCents <= 0 || parsed.amountCents > MAX_AMOUNT_CENTS) return null;
  if (parsed.currency !== "PEN" && parsed.currency !== "USD") return null;
  if (!OPERATION_TYPES.includes(parsed.operationType)) return null;
  const merchant = String(parsed.merchant ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  const bank = String(parsed.bank ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (merchant.length < 2 || bank.length < 2) return null;
  const now = Date.now();
  const dateOk = Number.isFinite(parsed.operationDate) && parsed.operationDate > Date.UTC(2000, 0, 1) && parsed.operationDate <= now + 2 * DAY_MS;
  return {
    ...parsed,
    bank,
    merchant,
    operationDate: dateOk ? Math.trunc(parsed.operationDate) : email.internalDate,
    cardLast4: parsed.cardLast4 && /^\d{4}$/.test(parsed.cardLast4) ? parsed.cardLast4 : undefined,
    cardType: parsed.cardType ? parsed.cardType.slice(0, 30) : undefined,
    description: parsed.description?.slice(0, 300),
    confidence: Math.min(1, Math.max(0, parsed.confidence)),
  };
}
