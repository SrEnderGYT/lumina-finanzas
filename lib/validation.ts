import { z } from "zod";

const DAY_MS = 86_400_000;

/** Devuelve un mensaje de error si el patrón no es una regex utilizable y razonablemente segura; null si es válido. */
export function regexProblem(pattern: string): string | null {
  try { new RegExp(pattern, "i"); } catch { return "La expresión regular no es válida."; }
  if (hasRepeatedAmbiguousGroup(pattern)) return "La expresión regular es demasiado costosa (grupos repetidos con cuantificadores).";
  return null;
}

/**
 * Detecta grupos que se repiten (+, *, {n,}) y cuyo contenido, incluidos subgrupos, ya contiene un cuantificador o una alternación:
 * (a+)+, (a|aa)+, ((a)*)*, (?:(a)*)*. Conservador a propósito: puede rechazar patrones seguros pero no deja pasar los exponenciales.
 */
function hasRepeatedAmbiguousGroup(pattern: string): boolean {
  // Elimina escapes y clases de caracteres para que sus símbolos no cuenten como cuantificadores.
  const source = pattern.replace(/\\./g, "x").replace(/\[(?:[^\]\\]|\\.)*\]/g, "x").replace(/\(\?(?::|=|!|<=|<!|<[A-Za-z_][\w]*>)/g, "(");
  const stack: number[] = [];
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === "(") stack.push(index);
    else if (char === ")") {
      const open = stack.pop();
      if (open === undefined) continue;
      const next = source[index + 1];
      const repeated = next === "+" || next === "*" || (next === "{" && /^\{\d+(?:,\d*)?\}/.test(source.slice(index + 1)));
      if (repeated && /[+*?|]|\{\d+(?:,\d*)?\}/.test(source.slice(open + 1, index))) return true;
    }
  }
  return false;
}

/** Fecha de operación en ms: posterior al año 2000 y sin más de 2 días en el futuro. */
export const operationDateSchema = z.number().int().refine(
  (value) => value > Date.UTC(2000, 0, 1) && value <= Date.now() + 2 * DAY_MS,
  "Fecha fuera de rango.",
);

/** Monto positivo con máximo 2 decimales. */
export const amountSchema = z.number().positive().max(100_000_000).refine(
  (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
  "Máximo 2 decimales.",
);
