import { parseCommon } from "./helpers";
import type { BankParser } from "./types";

export const falabellaParser: BankParser = {
  id: "falabella-v1",
  canParse: ({ from, subject, body }) => /banco\s*falabella|bancofalabella/i.test(`${from} ${subject} ${body}`),
  parse: (email) => parseCommon(email, "Banco Falabella", "falabella-v1", [/(?:comercio|establecimiento|compra en|consumo en)\s*[:\-]?\s*([^|]{3,70}?)(?=\s+(?:por|monto|importe|el día|con (?:tu|tarjeta))|[.;])/i], .95),
};
