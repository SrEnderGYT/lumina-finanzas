import { parseCommon } from "./helpers";
import type { BankParser } from "./types";

export const interbankParser: BankParser = {
  id: "interbank-v1",
  sender: /interbank/i,
  canParse: ({ from, subject, body }) => /interbank/i.test(`${from} ${subject} ${body}`),
  parse: (email) => parseCommon(email, "Interbank", "interbank-v1", [/\b(?:comercio|establecimiento|realizaste una compra en)\s*[:\-]?\s*(?!\d)([^|]{3,70}?)(?=\s+(?:por|monto|importe|el día|con (?:tu|tarjeta))|[.;])/i], .95),
};
