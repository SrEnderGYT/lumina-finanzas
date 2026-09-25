import { parseCommon } from "./helpers";
import type { BankParser } from "./types";

export const genericParser: BankParser = {
  id: "generic-v1",
  canParse: ({ subject, body }) => /compra|consumo|cargo|pago|tarjeta|transacci[oó]n|movimiento/i.test(`${subject} ${body}`),
  parse: (email) => parseCommon(email, "Otro banco", "generic-v1", [/\b(?:comercio|establecimiento|compra en|consumo en|pago en)\s*[:\-]?\s*([^|]{3,70}?)(?=\s+(?:por|monto|importe|el día|con (?:tu|tarjeta))|[.;])/i], .65),
};
