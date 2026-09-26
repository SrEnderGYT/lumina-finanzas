import { parseCommon } from "./helpers";
import type { BankParser } from "./types";

export const scotiabankParser: BankParser = {
  id: "scotiabank-v1",
  sender: /scotiabank/i,
  canParse: ({ from, subject, body }) => /scotiabank/i.test(`${from} ${subject} ${body}`),
  parse: (email) => parseCommon(email, "Scotiabank", "scotiabank-v1", [/\b(?:comercio|establecimiento|consumo en|compra en)\s*[:\-]?\s*(?!\d)([^|]{3,70}?)(?=\s+(?:por|monto|importe|el día|con (?:tu|tarjeta))|[.;])/i], .95),
};
