import { parseCommon } from "./helpers";
import type { BankParser } from "./types";

export const ripleyParser: BankParser = {
  id: "ripley-v1",
  sender: /bancoripley|banco\s*ripley/i,
  canParse: ({ from, subject, body }) => /banco\s*ripley|bancoripley/i.test(`${from} ${subject} ${body}`),
  parse: (email) => parseCommon(email, "Banco Ripley", "ripley-v1", [/\b(?:comercio|establecimiento|compra en|consumo en)\s*[:\-]?\s*(?!\d)([^|]{3,70}?)(?=\s+(?:por|monto|importe|el día|con (?:tu|tarjeta))|[.;])/i], .95),
};
