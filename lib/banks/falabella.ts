import { parseCommon } from "./helpers";
import type { BankParser } from "./types";

export const falabellaParser: BankParser = {
  id: "falabella-v1",
  sender: /bancofalabella|banco\s*falabella/i,
  canParse: ({ from, subject, body }) => /banco\s*falabella|bancofalabella/i.test(`${from} ${subject} ${body}`),
  parse: (email) => parseCommon(email, "Banco Falabella", "falabella-v1", [/\b(?:comercio|establecimiento|compra en|consumo en)\s*[:\-]?\s*(?!\d)([^|]{3,70}?)(?=\s+(?:por|monto|importe|el día|con (?:tu|tarjeta))|[.;])/i], .95),
};
