import { parseCommon } from "./helpers";
import type { BankParser } from "./types";

export const yapeParser: BankParser = {
  id: "yape-v1",
  sender: /yape|plin/i,
  canParse: ({ from, subject, body }) => /\b(?:yape|plin)\b|yapeaste|plineaste/i.test(`${from} ${subject} ${body}`),
  parse: (email) => parseCommon(email, "Yape", "yape-v1", [], .9),
};
