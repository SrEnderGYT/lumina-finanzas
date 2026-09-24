import assert from "node:assert/strict";
import { parseBankEmail } from "../lib/banks/index";

const cases = [
  { from: "alertas@bcp.com.pe", subject: "Compra realizada", body: "Compra por S/ 89.90 en WONG con tarjeta **1234 el 24/09/2026.", bank: "BCP", amount: 8990, last4: "1234" },
  { from: "noreply@interbank.pe", subject: "Realizaste una compra", body: "Realizaste una compra en TOTTUS por S/ 142.50 con tu tarjeta terminada en 4821 el 23/09/2026.", bank: "Interbank", amount: 14250, last4: "4821" },
  { from: "bbva@bbva.pe", subject: "Consumo con tarjeta", body: "Consumo en NETFLIX por USD 12.99 con tarjeta ****9934 el 22/09/2026.", bank: "BBVA", amount: 1299, last4: "9934" },
  { from: "alertas@scotiabank.com.pe", subject: "Alerta de compra", body: "Compra en INKAFARMA por S/ 67,40 con tu tarjeta últimos 4 3344 el 21/09/2026.", bank: "Scotiabank", amount: 6740, last4: "3344" },
];

for (const [index, item] of cases.entries()) {
  const parsed = parseBankEmail({ id: String(index), from: item.from, subject: item.subject, body: item.body, internalDate: Date.now() });
  assert.ok(parsed, `${item.bank}: debe interpretar el correo`);
  assert.equal(parsed.bank, item.bank);
  assert.equal(parsed.amountCents, item.amount);
  assert.equal(parsed.cardLast4, item.last4);
  assert.notEqual(parsed.merchant, "Comercio no identificado");
}

console.log(`Parsers verificados: ${cases.length}`);
