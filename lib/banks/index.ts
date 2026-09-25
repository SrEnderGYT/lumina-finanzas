import { bbvaParser } from "./bbva";
import { bcpParser } from "./bcp";
import { genericParser } from "./generic";
import { interbankParser } from "./interbank";
import { falabellaParser } from "./falabella";
import { ripleyParser } from "./ripley";
import { scotiabankParser } from "./scotiabank";
import type { BankParser, EmailInput, ParsedTransaction } from "./types";
import { validateParsed } from "./validate";

export const bankParsers: BankParser[] = [bcpParser, interbankParser, bbvaParser, scotiabankParser, falabellaParser, ripleyParser, genericParser];

export function parseBankEmail(email: EmailInput): ParsedTransaction | null {
  // Primero los parsers cuyo remitente coincide, para que un correo de un banco que menciona a otro no se asigne mal.
  const bySender = bankParsers.filter((parser) => parser.sender?.test(email.from));
  for (const parser of [...bySender, ...bankParsers.filter((item) => !bySender.includes(item))]) {
    if (!bySender.includes(parser) && !parser.canParse(email)) continue;
    const result = parser.parse(email);
    const valid = result && validateParsed(result, email);
    if (valid) return valid;
  }
  return null;
}

export { validateParsed } from "./validate";
export type { EmailInput, ParsedTransaction } from "./types";
