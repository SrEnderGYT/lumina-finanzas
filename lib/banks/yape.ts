import { parseCommon } from "./helpers";
import type { BankParser, EmailInput } from "./types";

// Yape (BCP) y Plin (interbancario) se reportan por separado: el remitente manda; si no aclara, el texto del correo.
function walletOf(email: EmailInput): "Yape" | "Plin" {
  const from = email.from.toLowerCase();
  if (/plin/.test(from) && !/yape/.test(from)) return "Plin";
  if (/yape/.test(from)) return "Yape";
  const text = `${email.subject} ${email.body}`.toLowerCase();
  return /plin|plineaste/.test(text) && !/yape|yapeaste/.test(text) ? "Plin" : "Yape";
}

export const yapeParser: BankParser = {
  id: "yape-v1",
  sender: /yape|plin/i,
  canParse: ({ from, subject, body }) => /\b(?:yape|plin)\b|yapeaste|plineaste/i.test(`${from} ${subject} ${body}`),
  parse: (email) => {
    const wallet = walletOf(email);
    return parseCommon(email, wallet, wallet === "Plin" ? "plin-v1" : "yape-v1", [], .9);
  },
};
