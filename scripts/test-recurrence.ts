import assert from "node:assert/strict";
import { detectRecurring, merchantKey, type RecurrenceInput } from "../lib/recurrence";
import { limaMonthKey, limaMonthStart, limaTimestamp } from "../lib/time";

const d = (y: number, m: number, day = 5) => limaTimestamp(y, m - 1, day, 12);
const row = (merchant: string, amountCents: number, when: number, extra: Partial<RecurrenceInput> = {}): RecurrenceInput =>
  ({ merchant, amountCents, currency: "PEN", operationDate: when, operationType: "expense", cardKey: "c1", cardLabel: "VISA •••• 1234", ...extra });
const start = limaMonthStart(2026, 8), end = limaMonthStart(2026, 9) - 1;

assert.equal(merchantKey("NETFLIX.COM 8842"), "NETFLIX COM");

// Una sola compra nunca es suscripción, sin importar el monto.
assert.equal(detectRecurring([row("NETFLIX", 4490, d(2026, 9))], start, end).length, 0);

// Mismo comercio y monto parecido en 4 meses consecutivos, misma tarjeta, cada ~30 días → suscripción.
const netflix = [d(2026, 6), d(2026, 7), d(2026, 8), d(2026, 9)].map((when) => row("NETFLIX", 4490, when));
const found = detectRecurring(netflix, start, end);
assert.equal(found.length, 1);
assert.equal(found[0].kind, "subscription");
assert.equal(found[0].months, 4);
assert.equal(found[0].activeInPeriod, true);
assert.ok(found[0].confidence >= 0.8);

// Solo 2 meses: aparece como posible, con menos confianza que el patrón de 4 meses.
const two = detectRecurring([row("SPOTIFY", 2190, d(2026, 8)), row("SPOTIFY", 2190, d(2026, 9))], start, end);
assert.equal(two[0].months, 2);
assert.equal(two[0].kind, "possible", "con solo 2 meses es un posible recurrente, no una suscripción");
assert.ok(two[0].confidence < found[0].confidence);

// Montos muy distintos en el mismo comercio (compras normales) no forman recurrencia.
assert.equal(detectRecurring([row("WONG", 8990, d(2026, 7)), row("WONG", 31000, d(2026, 8)), row("WONG", 12050, d(2026, 9))], start, end).length, 0);

// Dos compras el mismo mes no cuentan como dos meses.
assert.equal(detectRecurring([row("UBER", 1500, d(2026, 9, 2)), row("UBER", 1500, d(2026, 9, 20))], start, end).length, 0);

// Historial fuera de 6 meses no cuenta; ingresos y transferencias no son recurrentes de gasto.
assert.equal(detectRecurring([row("GYM", 9900, d(2026, 1)), row("GYM", 9900, d(2026, 2))], start, end).length, 0);
assert.equal(detectRecurring([row("SUELDO", 300000, d(2026, 8), { operationType: "income" }), row("SUELDO", 300000, d(2026, 9), { operationType: "income" })], start, end).length, 0);

// Cada movimiento conserva su mes: un cobro anterior no marca actividad en el periodo si no hay cobro dentro.
const stale = detectRecurring([row("HBO", 2990, d(2026, 6)), row("HBO", 2990, d(2026, 7))], start, end);
assert.equal(stale[0]?.activeInPeriod, false);

// Zona horaria: 22:30 en Lima del último día del mes sigue en ese mes aunque el servidor (UTC) ya esté en el siguiente.
const lateNight = limaTimestamp(2026, 8, 30, 22, 30);
assert.equal(new Date(lateNight).getUTCMonth(), 9, "en UTC ya es octubre");
assert.equal(limaMonthKey(lateNight), "2026-09", "en Lima sigue siendo septiembre");
assert.ok(lateNight >= start && lateNight <= end);
assert.equal(limaMonthKey(limaTimestamp(2026, 9, 1, 0, 5)), "2026-10");

console.log("Recurrencia verificada");
