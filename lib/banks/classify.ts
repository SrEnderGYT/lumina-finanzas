import { extractLast4, normalize, UNKNOWN_MERCHANT } from "./helpers";
import type { EmailInput, ParsedTransaction } from "./types";

export type EmailKind = "transaction" | "promotion" | "statement" | "other";
export type ConfidenceLevel = "high" | "medium" | "low";

export type Classification = { kind: EmailKind; reasons: string[]; hasTransactionEvidence: boolean };
export type Decision = {
  accepted: boolean;
  kind: EmailKind;
  confidence: ConfidenceLevel;
  /** Motivo legible de la aceptación o el rechazo, guardado para auditar y afinar reglas. */
  reason: string;
};

type Signal = [name: string, pattern: RegExp, weight: number];

const AMOUNT = String.raw`(?:S\/\.?|PEN|USD|US\$|\$)\s*\d`;

// Publicidad: cada señal suma; un solo monto nunca convierte un correo en movimiento.
const PROMO_SIGNALS: Signal[] = [
  ["monto promocional (hasta/desde/obtén S/…)", new RegExp(String.raw`\b(?:hasta|desde|obt[eé]n|obtenga|gana|ahorra|ahorro de|descuento de|dscto\.? de|cashback de|por solo|a solo|l[ií]nea de|pr[eé]stamo de|cr[eé]dito de|te presta|te prestamos|retira hasta)\s+(?:de\s+)?${AMOUNT}`, "i"), 3],
  ["compra hasta", /\bcompras?\s+hasta\b/i, 3],
  ["hasta X% de descuento", /\bhasta\s+(?:un\s+)?\d{1,3}\s*%/i, 3],
  ["llamado a la acción", /\b(?:aprovecha|no te lo pierdas|[uú]ltimos d[ií]as|solo por hoy|solicita(?:lo)? (?:ya|hoy|aqu[ií])|obt[eé]n(?:lo)? ya|reg[ií]strate|participa|ll[eé]vate|canjea|descubre|conoce)\b/i, 2],
  ["oferta/promoción", /\b(?:promoci[oó]n|promo|ofertas?|descuentos?|cupon(?:es)?|cup[oó]n|campa[ñn]a|sorteo|black friday|cyber\s?(?:wow|days)?|cashback|beneficios? exclusivos?|exclusivo para ti)\b/i, 2],
  ["préstamo/línea/simulación", /\b(?:pr[eé]stamo|cr[eé]dito pre-?aprobado|pre-?aprobad[oa]|l[ií]nea (?:de cr[eé]dito )?(?:disponible|aprobada|adicional)|simula(?:ci[oó]n|dor)?|tasa (?:desde|preferencial)|tcea|tea\b|cuotas? sin inter[eé]s|efectivo al toque|adelanto de sueldo|desembolso)\b/i, 2],
  ["cuotas de S/ (oferta)", new RegExp(String.raw`\bcuotas? de\s+${AMOUNT}`, "i"), 2],
  ["puntos/millas/premios", /\b(?:acumula|gana|canjea)\s+(?:tus\s+)?(?:puntos|millas)|\bpremios?\b/i, 1],
  ["ver en el navegador / baja", /\b(?:ver (?:este correo )?en (?:el |tu )?navegador|darte de baja|cancelar (?:tu )?suscripci[oó]n al bolet[ií]n|unsubscribe|no deseas recibir|newsletter)\b/i, 2],
  ["condiciones de campaña", /\b(?:v[aá]lido (?:hasta|del)|vigencia (?:hasta|del)|stock limitado|aplican (?:t[eé]rminos|restricciones)|sujeto a evaluaci[oó]n|sujeto a aprobaci[oó]n crediticia)\b/i, 1],
];

const STATEMENT_SIGNALS: Signal[] = [
  ["estado de cuenta", /\b(?:estado de cuenta|resumen (?:mensual|de cuenta|de tu tarjeta)|statement|fecha de pago|pago m[ií]nimo|pago total del mes|saldo (?:anterior|total|actual)|fecha de corte)\b/i, 2],
];

// Evidencia de una operación ya ocurrida (no de una invitación a comprar).
const COMPLETED_SIGNALS: Signal[] = [
  ["operación realizada/aprobada", /\b(?:compra|consumo|pago|cargo|retiro|transferencia|d[eé]bito|operaci[oó]n)(?:\s+de\s+(?:tu\s+)?[a-z ]{2,30}?)?\s+(?:realizad[oa]|aprobad[oa]|procesad[oa]|efectuad[oa]|exitos[oa]|con [eé]xito)\b/i, 2],
  ["verbo en pasado", /\b(?:realizaste|efectuaste|hiciste|pagaste|retiraste|transferiste|enviaste|recibiste|yapeaste|plineaste|te yape[oó]|te pline[oó]|depositaron|abonaron|se te carg[oó]|te cobramos|hemos (?:registrado|procesado))\b/i, 2],
  ["se realizó/procesó", /\bse\s+(?:ha\s+)?(?:realizado|realiz[oó]|procesado|proces[oó]|efectuado|efectu[oó]|cargado|carg[oó]|debitado|debit[oó]|registrado|registr[oó]|aprobado|aprob[oó])\b/i, 2],
  ["alerta de operación", /\b(?:alerta|notificaci[oó]n|aviso)\s+de\s+(?:compra|consumo|pago|cargo|retiro|transferencia|operaci[oó]n|movimiento)\b/i, 2],
  ["consumo con/aprobado", /\bconsumo\s+(?:con|aprobado|en)\b/i, 1.5],
  ["compra en X por S/ con tarjeta", new RegExp(String.raw`\b(?:compra|consumo|cargo|pago|retiro)\s+(?:en|de)\s+.{2,70}?\s+por\s+${AMOUNT}[\d.,]*\s+(?:con|usando)\s+(?:tu\s+)?(?:tarjeta|cuenta)`, "i"), 2],
  ["código de operación", /\b(?:c[oó]digo|n[uú]mero|nro\.?|n[°º])\s+de\s+operaci[oó]n\b|\boperaci[oó]n\s*(?:n[°º]|#|:)\s*\d+/i, 1.5],
  ["fecha y hora de la operación", /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\s*(?:,|a las|-)?\s*\d{1,2}:\d{2}/i, 1],
];

// Operaciones que no ocurrieron: nunca se registran.
const FAILED_SIGNALS: Signal[] = [
  ["operación rechazada/fallida", /\b(?:rechazad[oa]|denegad[oa]|declinad[oa]|fallid[oa]|no se pudo (?:realizar|procesar)|no fue (?:aprobad|procesad)|sin fondos|fondos insuficientes|anulad[oa])\b/i, 3],
];

/** Quita tildes: en JavaScript \b no trata las letras acentuadas como parte de una palabra ("realizó" rompía el límite). */
const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function sum(text: string, signals: Signal[]): { score: number; hits: string[] } {
  let score = 0;
  const hits: string[] = [];
  for (const [name, pattern, weight] of signals) if (pattern.test(text)) { score += weight; hits.push(name); }
  return { score, hits };
}

function senderHints(from: string): { promo: boolean; transactional: boolean } {
  const local = from.toLowerCase().replace(/^.*?<|>.*$/g, "").split("@")[0] ?? "";
  return {
    promo: /promo|marketing|news|oferta|campan|mailing|comunicacion|beneficio|publicidad|notiplus|hola\b/.test(local),
    transactional: /alerta|notific|transaccion|operacion|consumo|movimiento|serviciodealertas|noreply|no-reply|donotreply/.test(local),
  };
}

/**
 * Paso 1 del flujo: ¿qué tipo de correo es? Publicidad, estado de cuenta, transacción u otro.
 * Ante la duda no es transacción: preferimos perder un aviso dudoso a contaminar los reportes.
 */
export function classifyEmail(email: EmailInput): Classification {
  const text = fold(normalize(`${email.subject} ${email.body}`).slice(0, 12_000));
  const promo = sum(text, PROMO_SIGNALS);
  const statement = sum(text, STATEMENT_SIGNALS);
  const completed = sum(text, COMPLETED_SIGNALS);
  const failed = sum(text, FAILED_SIGNALS);
  const sender = senderHints(email.from);
  const reasons: string[] = [];

  let promoScore = promo.score;
  if (email.labels?.includes("CATEGORY_PROMOTIONS")) { promoScore += 3; reasons.push("Gmail: pestaña Promociones"); }
  if (email.listUnsubscribe) { promoScore += 2; reasons.push("cabecera List-Unsubscribe (correo masivo)"); }
  if (sender.promo) { promoScore += 1; reasons.push("remitente de marketing"); }

  const completedScore = completed.score + (sender.transactional ? 0.5 : 0) + (extractLast4(text) ? 1 : 0);
  const hasEvidence = completed.score >= 2;
  reasons.push(...promo.hits.map((hit) => `promo: ${hit}`), ...completed.hits.map((hit) => `evidencia: ${hit}`));

  if (failed.score > 0) return { kind: "other", reasons: [...reasons, ...failed.hits.map((hit) => `descartado: ${hit}`)], hasTransactionEvidence: false };
  // La publicidad gana salvo que exista evidencia clara de una operación ya realizada.
  if (promoScore >= 2 && !hasEvidence) return { kind: "promotion", reasons, hasTransactionEvidence: false };
  if (promoScore >= 4 && promoScore > completedScore) return { kind: "promotion", reasons, hasTransactionEvidence: hasEvidence };
  if (statement.score >= 2 && !hasEvidence) return { kind: "statement", reasons: [...reasons, ...statement.hits.map((hit) => `estado: ${hit}`)], hasTransactionEvidence: false };
  if (hasEvidence || completedScore >= 2.5) return { kind: "transaction", reasons, hasTransactionEvidence: hasEvidence };
  return { kind: "other", reasons: [...reasons, "sin evidencia de una operación realizada"], hasTransactionEvidence: false };
}

export function hasExplicitDate(text: string): boolean {
  return /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/.test(text);
}

const COUNTERPARTY_OPTIONAL = new Set(["transfer", "income", "refund"]);

/**
 * Pasos 4–5 del flujo: con el correo ya clasificado como transacción y los datos extraídos, decide el nivel de confianza.
 *  - alta:  monto + comercio + tarjeta/cuenta + fecha explícita
 *  - media: monto + comercio + evidencia textual clara de compra/pago
 *  - baja:  cualquier otra cosa → no se registra
 * La salida de la IA nunca supera "media".
 */
export function decideConfidence(parsed: ParsedTransaction, email: EmailInput, classification: Classification, fromAi = false): Decision {
  const text = normalize(`${email.subject} ${email.body}`);
  if (classification.kind !== "transaction") {
    const label = classification.kind === "promotion" ? "publicidad" : classification.kind === "statement" ? "estado de cuenta" : "sin evidencia de operación";
    return { accepted: false, kind: classification.kind, confidence: "low", reason: `Rechazado (${label}): ${classification.reasons.slice(0, 4).join("; ") || "sin señales de transacción"}` };
  }
  const merchantKnown = parsed.merchant !== UNKNOWN_MERCHANT && parsed.merchant.length >= 2;
  const counterpartyOk = merchantKnown || COUNTERPARTY_OPTIONAL.has(parsed.operationType);
  const hasCard = Boolean(parsed.cardLast4);
  const dated = hasExplicitDate(text);
  const evidence = classification.hasTransactionEvidence;

  if (!counterpartyOk) return { accepted: false, kind: "transaction", confidence: "low", reason: "Rechazado: no se pudo identificar el comercio." };
  if (merchantKnown && hasCard && dated && !fromAi) return { accepted: true, kind: "transaction", confidence: "high", reason: "Monto + comercio + tarjeta + fecha explícita." };
  if (evidence && (merchantKnown || hasCard)) return { accepted: true, kind: "transaction", confidence: "medium", reason: `Monto + ${merchantKnown ? "comercio" : "tarjeta"} + evidencia textual de la operación${fromAi ? " (extraído por IA)" : ""}.` };
  return { accepted: false, kind: "transaction", confidence: "low", reason: "Rechazado: no hay evidencia suficiente de que la operación ocurriera." };
}
