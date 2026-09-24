import { parseCommon } from "./helpers";
import type { BankParser } from "./types";

export const scotiabankParser: BankParser = {
  id: "scotiabank-v1",
  canParse: ({ from, subject, body }) => /scotiabank/i.test(`${from} ${subject} ${body}`),
  parse: (email) => parseCommon(email, "Scotiabank", "scotiabank-v1", [/(?:comercio|establecimiento|consumo en|compra en)\s*[:\-]?\s*([^|]{3,70}?)(?=\s+(?:por|monto|importe|el día|con (?:tu|tarjeta))|[.;])/i], .95),
};
