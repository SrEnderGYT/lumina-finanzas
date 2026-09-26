import { parseCommon } from "./helpers";
import type { BankParser } from "./types";

export const bbvaParser: BankParser = {
  id: "bbva-v1",
  sender: /bbva/i,
  canParse: ({ from, subject, body }) => /bbva/i.test(`${from} ${subject} ${body}`),
  parse: (email) => parseCommon(email, "BBVA", "bbva-v1", [/\b(?:comercio|establecimiento|consumo en|compra en)\s*[:\-]?\s*(?!\d)([^|]{3,70}?)(?=\s+(?:por|monto|importe|el día|con (?:tu|tarjeta))|[.;])/i], .95),
};
