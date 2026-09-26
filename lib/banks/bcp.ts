import { parseCommon } from "./helpers";
import type { BankParser } from "./types";

export const bcpParser: BankParser = {
  id: "bcp-v1",
  sender: /bcp|viabcp/i,
  canParse: ({ from, subject, body }) => /bcp|viabcp/i.test(`${from} ${subject} ${body}`),
  parse: (email) => parseCommon(email, "BCP", "bcp-v1", [
    /\bEmpresa\s+(.{2,80}?)(?=\s+(?:N[uú]mero de operaci[oó]n|Canal|$))/i,
    /\bPagado a\s+(.{2,80}?)(?=\s+(?:Tipo de pago|Desde|Canal|N[uú]mero de operaci[oó]n|$))/i,
    /\bEnviado a\s+(.{2,80}?)(?=\s+(?:Desde|Canal|N[uú]mero de operaci[oó]n|$))/i,
    /\bDestino\s+(.{2,80}?)(?=\s+(?:Canal|N[uú]mero de operaci[oó]n|¿|No reconoces|$))/i,
    /\b(?:establecimiento|comercio|en)\s*[:\-]?\s*(?!\d)([^|]{3,70}?)(?=\s+(?:por|monto|importe|el día|con (?:tu|tarjeta))|[.;])/i,
  ], .95),
};
