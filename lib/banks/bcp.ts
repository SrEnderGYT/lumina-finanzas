import { parseCommon } from "./helpers";
import type { BankParser } from "./types";

export const bcpParser: BankParser = {
  id: "bcp-v1",
  sender: /bcp|viabcp/i,
  canParse: ({ from, subject, body }) => /bcp|viabcp/i.test(`${from} ${subject} ${body}`),
  parse: (email) => parseCommon(email, "BCP", "bcp-v1", [/(?:establecimiento|comercio|en)\s*[:\-]?\s*([^|]{3,70}?)(?=\s+(?:por|monto|importe|el día|con (?:tu|tarjeta))|[.;])/i], .95),
};
