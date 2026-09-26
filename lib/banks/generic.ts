import { parseCommon, UNKNOWN_MERCHANT } from "./helpers";
import type { BankParser } from "./types";

export const genericParser: BankParser = {
  id: "generic-v1",
  canParse: ({ subject, body }) => /compra|consumo|cargo|pago|tarjeta|transacci[oó]n|movimiento/i.test(`${subject} ${body}`),
  parse: (email) => {
    const parsed = parseCommon(email, "Otro banco", "generic-v1", [/\b(?:comercio|establecimiento|compra en|consumo en|pago en)\s*[:\-]?\s*(?!\d)([^|]{3,70}?)(?=\s+(?:por|monto|importe|el día|con (?:tu|tarjeta))|[.;])/i], .65);
    if (!parsed || parsed.merchant !== UNKNOWN_MERCHANT) return parsed;
    // Remitentes transaccionales conocidos: el dominio identifica al comercio cuando el recibo no usa "compra en".
    if (/@(?:[a-z0-9-]+\.)?uber\.com\b/i.test(email.from)) return { ...parsed, merchant: "UBER", confidence: .8 };
    return parsed;
  },
};
