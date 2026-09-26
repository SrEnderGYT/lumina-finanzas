import assert from "node:assert/strict";
import { amountsInText, extractAmount, extractDate } from "../lib/banks/helpers";
import { limaTimestamp } from "../lib/time";
import { parseBankEmail, validateParsed } from "../lib/banks/index";
import { regexProblem } from "../lib/validation";

// Montos: separadores de miles y decimales en los formatos comunes de alertas bancarias.
const amounts: Array<[string, number, "PEN" | "USD"]> = [
  ["por S/ 89.90 en", 8990, "PEN"], ["por S/ 67,40 con", 6740, "PEN"], ["por S/ 1,234.50 en", 123450, "PEN"],
  ["por S/ 1,234 en", 123400, "PEN"], ["por S/ 1.234,50 en", 123450, "PEN"], ["por USD 12.99 con", 1299, "USD"],
  ["por US$ 1,000 con", 100000, "USD"], ["por S/ 89.90. Gracias", 8990, "PEN"],
];
for (const [text, cents, currency] of amounts) {
  const result = extractAmount(text);
  assert.ok(result, `monto no detectado: ${text}`);
  assert.equal(result.amountCents, cents, text);
  assert.equal(result.currency, currency, text);
}
assert.equal(extractAmount("sin monto"), null);
assert.equal(extractAmount("por S/ 0.00 en"), null);

// Fechas: los desbordes deben caer al valor de respaldo, no reinterpretarse.
const fallback = 1_700_000_000_000;
assert.equal(extractDate("el 31/02/2026", fallback), fallback);
assert.equal(extractDate("el 15/13/2026", fallback), fallback);
assert.equal(extractDate("el 24/09/2026 25:00", fallback), fallback);
assert.equal(new Date(extractDate("el 24/09/2026", fallback)).getDate(), 24);
assert.equal(extractDate("el 25/09/2026 8:18 p.m.", fallback), limaTimestamp(2026, 8, 25, 20, 18));
assert.equal(extractDate("el 25/09/2026 12:05 a.m.", fallback), limaTimestamp(2026, 8, 25, 0, 5));

// Validación de resultados no confiables (p. ej. IA con inyección en el correo).
const base = { bank: "BCP", merchant: "WONG", operationDate: Date.now(), amountCents: 5000, currency: "PEN" as const, operationType: "expense" as const, confidence: 0.7, parserId: "ai-fallback-v1" };
const email = { internalDate: fallback };
assert.ok(validateParsed(base, email));
assert.equal(validateParsed({ ...base, amountCents: -5 }, email), null);
assert.equal(validateParsed({ ...base, amountCents: 1.5 }, email), null);
assert.equal(validateParsed({ ...base, amountCents: 1e15 }, email), null);
assert.equal(validateParsed({ ...base, merchant: " " }, email), null);
assert.equal(validateParsed({ ...base, currency: "EUR" as never }, email), null);
assert.equal(validateParsed({ ...base, operationType: "gift" as never }, email), null);
assert.equal(validateParsed({ ...base, operationDate: 0 }, email)?.operationDate, fallback);
assert.equal(validateParsed({ ...base, operationDate: Date.now() + 400 * 86_400_000 }, email)?.operationDate, fallback);
assert.equal(validateParsed({ ...base, cardLast4: "12345" }, email)?.cardLast4, undefined);
assert.equal(validateParsed({ ...base, cardLast4: "1234" }, email)?.cardLast4, "1234");

// Un correo con fecha imposible se acepta usando la fecha del mensaje.
const parsed = parseBankEmail({ id: "x", from: "alertas@bcp.com.pe", subject: "Compra realizada", body: "Compra por S/ 89.90 en WONG con tarjeta **1234 el 31/02/2026.", internalDate: fallback });
assert.equal(parsed?.operationDate, fallback);

// Reglas regex del usuario.
assert.equal(regexProblem("UBER|CABIFY"), null);
assert.ok(regexProblem("(a+"), "regex inválida");
assert.ok(regexProblem("(a+)+$"), "regex con backtracking exponencial");
assert.ok(regexProblem("(.*)*x"), "regex con backtracking exponencial");

// Tokens monetarios malformados no deben aceptarse como un prefijo válido.
assert.equal(extractAmount("por S/ 1..2 en"), null);
assert.equal(extractAmount("por S/ 1,2,3 en"), null);

// Más patrones ReDoS y falsos positivos comunes.
assert.ok(regexProblem("(a|aa)+$"), "alternación repetida");
assert.ok(regexProblem("(?:a?)+$"), "grupo opcional repetido");
assert.equal(regexProblem("(?:UBER|CABIFY)"), null);
assert.equal(regexProblem("WONG|PLAZA VEA|TOTTUS"), null);

// Contraste de la salida de la IA con los montos presentes en el correo.
const seen = amountsInText("Compra por S/ 89.90 y USD 12.99 en WONG");
assert.ok(seen.has("PEN:8990") && seen.has("USD:1299"));
assert.ok(!seen.has("PEN:999900"), "un monto inventado no debe coincidir");

// Regresión: anidamiento a través de subgrupos (probado exponencial: 26 caracteres ≈ segundos).
for (const bad of ["^(?:(a)*)*$", "((a)*)*", "(a+)+$", "(?:a|aa)+", "(x+x+)+y", "((a|b)+)*", "(a{1,}){2,}"]) assert.ok(regexProblem(bad), `debe rechazar ${bad}`);
for (const good of ["UBER|CABIFY|DIDI", "^WONG\\s\\d+$", "(?:UBER|CABIFY)", "[+*?]", "TOTTUS.*SAN ISIDRO", "\\(a+\\)+"]) assert.equal(regexProblem(good), null, `debe aceptar ${good}`);

// Repeticiones exactas {n}: (.*a){20} tardó 241 ms con 50 caracteres y >5 s con 500.
for (const bad of ["(.*a){20}", "(a+){10}", "(a|b*){5}", "((a)*){3,}"]) assert.ok(regexProblem(bad), `debe rechazar ${bad}`);
for (const good of ["^\\d{4}$", "(?:UBER){1}", "WONG.{0,5}SAN"]) assert.equal(regexProblem(good), null, `debe aceptar ${good}`);

console.log("Validaciones verificadas");
