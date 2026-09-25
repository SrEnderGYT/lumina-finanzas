/**
 * Los Workers corren en UTC y Perú es UTC-5 todo el año (sin horario de verano). Todos los límites de mes y de día se calculan
 * con este desfase fijo, así una compra a las 22:00 en Lima del último día del mes sigue perteneciendo a ese mes.
 */
export const LIMA_OFFSET_MS = -5 * 3_600_000;
export const DAY_MS = 86_400_000;

/** Año, mes (0-11) y día del instante `ms` según la hora de Lima. */
export function limaParts(ms: number): { year: number; month: number; day: number } {
  const date = new Date(ms + LIMA_OFFSET_MS);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() };
}

/** Instante (ms UTC) del inicio de un mes en Lima. Acepta meses fuera de rango (-1, 12…) y normaliza el año. */
export function limaMonthStart(year: number, month: number): number {
  return Date.UTC(year, month, 1) - LIMA_OFFSET_MS;
}

/** Instante (ms UTC) de una fecha y hora dadas en horario de Lima. */
export function limaTimestamp(year: number, month: number, day: number, hour = 12, minute = 0): number {
  return Date.UTC(year, month, day, hour, minute) - LIMA_OFFSET_MS;
}

/** Clave "YYYY-MM" del mes en Lima al que pertenece el instante. */
export function limaMonthKey(ms: number): string {
  const { year, month } = limaParts(ms);
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}
