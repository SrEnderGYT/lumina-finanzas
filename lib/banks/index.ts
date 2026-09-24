import { bbvaParser } from "./bbva";
import { bcpParser } from "./bcp";
import { genericParser } from "./generic";
import { interbankParser } from "./interbank";
import { falabellaParser } from "./falabella";
import { ripleyParser } from "./ripley";
import { scotiabankParser } from "./scotiabank";
import type { BankParser, EmailInput, ParsedTransaction } from "./types";

export const bankParsers: BankParser[] = [bcpParser, interbankParser, bbvaParser, scotiabankParser, falabellaParser, ripleyParser, genericParser];

export function parseBankEmail(email: EmailInput): ParsedTransaction | null {
  for (const parser of bankParsers) {
    if (!parser.canParse(email)) continue;
    const result = parser.parse(email);
    if (result) return result;
  }
  return null;
}

export type { EmailInput, ParsedTransaction } from "./types";
