import { parseCommon } from "./helpers";
import type { BankParser } from "./types";

export const bbvaParser: BankParser = {
  id: "bbva-v1",
  sender: /bbva/i,
  canParse: ({ from, subject, body }) => /bbva/i.test(`${from} ${subject} ${body}`),
  parse: (email) => parseCommon(email, "BBVA", "bbva-v1", [/(?:comercio|establecimiento|consumo en|compra en)\s*[:\-]?\s*([^|]{3,70}?)(?=\s+(?:por|monto|importe|el día|con (?:tu|tarjeta))|[.;])/i], .95),
};
