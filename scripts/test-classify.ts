import assert from "node:assert/strict";
import { parseBankEmail } from "../lib/banks/index";
import { classifyEmail, decideConfidence, type Decision } from "../lib/banks/classify";
import type { EmailInput } from "../lib/banks/types";

const T = Date.UTC(2026, 8, 24, 15);
const mail = (from: string, subject: string, body: string, extra: Partial<EmailInput> = {}): EmailInput => ({ id: "t", from, subject, body, internalDate: T, ...extra });

/** Mismo recorrido que la sincronización: clasificar → extraer → decidir confianza. */
function run(email: EmailInput): Decision {
  const kind = classifyEmail(email);
  const parsed = parseBankEmail(email);
  if (!parsed) return { accepted: false, kind: kind.kind, confidence: "low", reason: "sin datos extraíbles" };
  return decideConfidence(parsed, email, kind);
}

// ---- Publicidad con montos: nunca debe registrarse.
const promos: EmailInput[] = [
  mail("promociones@bcp.com.pe", "Aprovecha: compra hasta S/ 500 en cuotas sin interés", "Con tu tarjeta BCP compra hasta S/ 500 y paga en cuotas sin interés. Válido hasta el 30/09/2026. Términos y condiciones."),
  mail("marketing@interbank.pe", "Obtén S/ 20,000 en efectivo al toque", "Solicita tu préstamo hoy. Línea disponible de S/ 20,000 con tasa desde 12% TCEA. Simula tu cuota."),
  mail("ofertas@bbva.pe", "Hasta 50% de descuento en restaurantes", "Aprovecha las ofertas de septiembre. Paga con tu tarjeta BBVA y ahorra hasta S/ 100. Stock limitado."),
  mail("no-reply@scotiabank.com.pe", "Tu línea de crédito adicional de S/ 8,000 está aprobada", "Tienes una línea pre-aprobada de S/ 8,000. Solicítala aquí.", { listUnsubscribe: true }),
  mail("alertas@bancofalabella.com.pe", "Cyber Days: cashback de S/ 50 en tu compra", "Gana S/ 50 de cashback por compras mayores a S/ 300 con tu CMR. Participa en el sorteo.", { labels: ["CATEGORY_PROMOTIONS"] }),
  mail("hola@bancoripley.com.pe", "Compra tu iPhone desde S/ 199 al mes", "Llévate tu iPhone con cuotas de S/ 199. Aprovecha, oferta solo por hoy."),
  mail("promo@bcp.com.pe", "Compra en Wong con tu tarjeta", "Gana puntos. Compra en WONG por S/ 200 y llévate un descuento del 10%. Válido hasta el 30/09/2026.", { labels: ["CATEGORY_PROMOTIONS"] }),
];
for (const email of promos) {
  const decision = run(email);
  assert.equal(decision.accepted, false, `debía rechazarse: ${email.subject} → ${decision.reason}`);
}

// ---- Estados de cuenta y operaciones fallidas tampoco son movimientos.
assert.equal(run(mail("estados@bcp.com.pe", "Tu estado de cuenta de septiembre", "Tu estado de cuenta ya está disponible. Pago mínimo S/ 150.00. Fecha de pago 15/10/2026. Saldo total S/ 2,340.10.")).accepted, false);
assert.equal(run(mail("alertas@bcp.com.pe", "Compra rechazada", "Tu compra por S/ 89.90 en WONG con tarjeta **1234 fue rechazada por fondos insuficientes el 24/09/2026.")).accepted, false);

// ---- Consumos reales: deben aceptarse (los mismos casos que test-parsers).
const real: Array<[EmailInput, "high" | "medium"]> = [
  [mail("alertas@bcp.com.pe", "Compra realizada", "Compra por S/ 89.90 en WONG con tarjeta **1234 el 24/09/2026 14:30."), "high"],
  [mail("noreply@interbank.pe", "Realizaste una compra", "Realizaste una compra en TOTTUS por S/ 142.50 con tu tarjeta terminada en 4821 el 23/09/2026."), "high"],
  [mail("bbva@bbva.pe", "Consumo con tarjeta", "Consumo en NETFLIX por USD 12.99 con tarjeta ****9934 el 22/09/2026."), "high"],
  [mail("alertas@scotiabank.com.pe", "Alerta de compra", "Compra en INKAFARMA por S/ 67,40 con tu tarjeta últimos 4 3344 el 21/09/2026."), "high"],
  [mail("alertas@bancofalabella.com.pe", "Compra con CMR", "Compra en SODIMAC por S/ 250.00 con tu tarjeta terminada en 8877 el 20/09/2026."), "high"],
  [mail("alertas@bancoripley.com.pe", "Consumo aprobado", "Consumo en RIPLEY SAN ISIDRO por S/ 199.90 con tarjeta ****5544 el 19/09/2026."), "high"],
  // Sin fecha explícita en el texto: confianza media (comercio + evidencia clara).
  [mail("alertas@bcp.com.pe", "Compra realizada", "Se realizó una compra por S/ 45.00 en RAPPI con tu tarjeta."), "medium"],
];
for (const [email, level] of real) {
  const decision = run(email);
  assert.equal(decision.accepted, true, `debía aceptarse: ${email.subject} → ${decision.reason}`);
  assert.equal(decision.confidence, level, `${email.subject}: ${decision.reason}`);
}

// ---- Operaciones reales menos obvias: no deben perderse (falsos negativos).
const tricky: Array<[string, EmailInput, string]> = [
  ["constancia BCP", mail("notificaciones@notificacionesbcp.com.pe", "Constancia de operación", "Realizaste una transferencia de S/ 500.00 a JUAN PEREZ desde tu cuenta *4521. Código de operación: 883421. Fecha: 24/09/2026 10:15"), "JUAN PEREZ"],
  ["pago de servicios", mail("alertas@interbank.pe", "Pago de servicios realizado", "Pagaste S/ 85.30 a LUZ DEL SUR con tu cuenta terminada en 9921 el 20/09/2026. Número de operación 55123."), "LUZ DEL SUR"],
  ["retiro en cajero", mail("alertas@bbva.pe", "Retiro en cajero", "Se realizó un retiro de S/ 300.00 en cajero BBVA MIRAFLORES con tu tarjeta terminada en 7710 el 21/09/2026 18:40."), "cajero BBVA MIRAFLORES"],
  ["Yape enviado", mail("notificaciones@yape.com.pe", "Yapeaste S/ 20", "Yapeaste S/ 20.00 a Carlos Ruiz. Código de operación 771233. 22/09/2026 09:12"), "Carlos Ruiz"],
  ["pago de tarjeta", mail("alertas@bcp.com.pe", "Pago de tarjeta realizado", "Se realizó el pago de tu tarjeta de crédito por S/ 1,250.00 desde tu cuenta *4521 el 15/09/2026."), ""],
  ["cargo de suscripción", mail("alertas@bbva.pe", "Cargo por suscripción", "Se ha cargado USD 9.99 por tu suscripción a SPOTIFY con tu tarjeta ****3321 el 10/09/2026."), "SPOTIFY"],
  ["cuota de compra", mail("alertas@bancofalabella.com.pe", "Cargo de cuota", "Se realizó el cargo de la cuota 3 de 12 por S/ 210.00 de tu compra en SAGA FALABELLA con tu tarjeta terminada en 6612 el 05/09/2026."), "SAGA FALABELLA"],
];
for (const [name, email, merchant] of tricky) {
  const decision = run(email);
  assert.equal(decision.accepted, true, `${name} debía aceptarse: ${decision.reason}`);
  const parsed = parseBankEmail(email);
  if (merchant) assert.ok(parsed?.merchant.includes(merchant), `${name}: comercio esperado "${merchant}", obtenido "${parsed?.merchant}"`);
}
// Un Yape recibido es un ingreso, no un gasto.
assert.equal(parseBankEmail(mail("notificaciones@yape.com.pe", "Te yapearon", "Recibiste S/ 50.00 de Ana Gomez. Te yapeó. Código de operación 991. 23/09/2026 12:00"))?.operationType, "income");

// ---- Más publicidad engañosa con montos.
for (const email of [
  mail("noreply@bbva.pe", "Tu compra en cuotas", "Compra con tu tarjeta en cuotas de S/ 99 sin interés en Tottus. Solicítalo ya. Válido hasta el 30/09/2026."),
  mail("noreply@interbank.pe", "Ganaste una oportunidad", "Por tu consumo de S/ 50 participas en el sorteo de S/ 10,000. Aprovecha."),
  mail("info@scotiabank.com.pe", "Compra tu deuda", "Consolida tus deudas y paga S/ 300 menos al mes con TCEA desde 15%. Simula aquí."),
  mail("info@bcp.com.pe", "Tu tarjeta te espera", "Realiza tu primera compra con tu nueva tarjeta y recibe S/ 50 de regalo."),
]) assert.equal(run(email).accepted, false, `debía rechazarse: ${email.subject}`);

// ---- Hallazgos de la revisión independiente (Codex).
// 1) Publicidad en imperativo con la misma estructura que un aviso real, en los 6 bancos y en Yape/Plin.
for (const from of ["noreply@bbva.pe", "noreply@bcp.com.pe", "noreply@interbank.pe", "noreply@scotiabank.com.pe", "noreply@bancofalabella.com.pe", "noreply@bancoripley.com.pe", "promo@yape.com.pe"]) {
  const promo = mail(from, "Compra y gana", "Compra en TOTTUS por S/ 50 con tu tarjeta y acumula puntos.", { listUnsubscribe: true });
  assert.equal(run(promo).accepted, false, `imperativo promocional aceptado (${from})`);
  const noHeader = mail(from, "Compra y gana", "Compra en TOTTUS por S/ 50 con tu tarjeta y acumula puntos.");
  assert.equal(run(noHeader).accepted, false, `imperativo promocional sin cabecera aceptado (${from})`);
}
// 4) "Usaste tu tarjeta …" en todos los bancos.
for (const from of ["alertas@bcp.com.pe", "alertas@interbank.pe", "alertas@bbva.pe", "alertas@scotiabank.com.pe", "alertas@bancofalabella.com.pe", "alertas@bancoripley.com.pe"]) {
  const email = mail(from, "Usaste tu tarjeta", "Usaste tu tarjeta terminada en 1234 en WONG. Monto S/ 89.90. Fecha 24/09/2026 14:30.");
  const decision = run(email);
  assert.equal(decision.accepted, true, `"Usaste tu tarjeta" rechazado (${from}): ${decision.reason}`);
  assert.equal(parseBankEmail(email)?.merchant, "WONG", `comercio en ${from}`);
}
assert.ok(run(mail("alertas@bbva.pe", "Nuevo consumo", "Nuevo consumo en RAPPI por S/ 32.00 con tu tarjeta terminada en 5566 el 24/09/2026 20:10.")).accepted);
// 3) Ingresos por Yape/Plin sin tarjeta.
const incomeYape = mail("notificaciones@yape.com.pe", "Te yapearon", "Recibiste S/ 50.00 de Ana Gomez. Te yapeó. Código de operación 991. 23/09/2026 12:00");
assert.equal(run(incomeYape).accepted, true, run(incomeYape).reason);
assert.ok(parseBankEmail(incomeYape)?.merchant.includes("Ana Gomez"));
const incomePlin = mail("notificaciones@plin.pe", "Recibiste un Plin", "Recibiste S/ 35.00 de Carlos Ruiz por Plin. Código de operación 445. 22/09/2026 09:00");
assert.equal(run(incomePlin).accepted, true, run(incomePlin).reason);
// 8) Plin no se registra como Yape.
const plin = parseBankEmail(mail("notificaciones@plin.pe", "Plineaste S/ 20", "Plineaste S/ 20.00 a Carlos Ruiz. Código de operación 771233. 22/09/2026 09:12"));
assert.equal(plin?.bank, "Plin");
assert.equal(plin?.parserId, "plin-v1");

// ---- Solo un monto, sin evidencia: baja confianza, no se registra.
assert.equal(run(mail("info@bcp.com.pe", "Novedades", "Tu saldo es S/ 1,200.00. Conoce más.")).accepted, false);
assert.equal(run(mail("info@interbank.pe", "Aviso", "Recuerda que S/ 300 es el monto mínimo.")).accepted, false);

// ---- Publicidad con evidencia real de operación: gana la evidencia (un consumo con pie promocional sigue siendo un consumo).
const withFooter = mail("alertas@bcp.com.pe", "Compra realizada", "Compra realizada en WONG por S/ 89.90 con tarjeta **1234 el 24/09/2026 14:30. Aprovecha nuestras promociones en bcp.com.pe.");
assert.equal(run(withFooter).accepted, true);

// Regresiones observadas en correos reales: CTAs dentro de un recibo y advertencias legales hipotéticas.
const uberReceipt = mail(
  "Recibos de Uber <noreply@uber.com>",
  "[Personal] Tu viaje del viernes por la noche con Uber",
  "Gracias por viajar. Recibo de tu viaje. Total PEN 5.90. Tarifa del viaje PEN 7.70. Promoción -PEN 2.00. Pagos Visa ••••9270 PEN 5.90. 25/09/2026 20:18. Visita la página de solicitud de viaje para conocer más.",
  { labels: ["CATEGORY_UPDATES"] },
);
assert.equal(run(uberReceipt).accepted, true, run(uberReceipt).reason);
assert.equal(parseBankEmail(uberReceipt)?.merchant, "UBER");
assert.equal(parseBankEmail(uberReceipt)?.amountCents, 590);

const bcpWithDisclaimer = mail(
  "BCP Notificaciones <notificaciones@notificacionesbcp.com.pe>",
  "Realizaste un consumo con tu Tarjeta de Crédito BCP - Servicio de Notificaciones BCP",
  "Total del consumo S/ 5.90. Datos de la operación. Operación realizada. Consumo. Tarjeta de Crédito ****9270. Comercio DLC*UBER RIDES. Código de operación 12345. 25/09/2026 20:12. Si la compra es rechazada, cancelada o duplicada, el tiempo estimado de devolución será de 3 a 7 días.",
);
assert.equal(run(bcpWithDisclaimer).accepted, true, run(bcpWithDisclaimer).reason);
assert.equal(parseBankEmail(bcpWithDisclaimer)?.operationType, "card_charge");
assert.equal(parseBankEmail(bcpWithDisclaimer)?.cardType, "Crédito");
assert.equal(parseBankEmail(mail("alertas@bcp.com.pe", "Reembolso realizado", "Te devolvimos S/ 5.90 de tu compra en UBER. Operación procesada el 25/09/2026."))?.operationType, "refund");

console.log(`Clasificación verificada: ${promos.length + 4} publicidades rechazadas, ${real.length + tricky.length + 2} operaciones aceptadas`);
