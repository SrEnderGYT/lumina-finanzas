import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cards, categories, categorizationRules, subcategories } from "@/db/schema";
import { categorize } from "./categorize";
import { regexProblem } from "./validation";

const categoryDefaults = [
  ["Alimentación", "#2bd9a8", "utensils"], ["Transporte", "#625cf6", "car"],
  ["Hogar", "#efb444", "home"], ["Salud", "#ff7f6e", "heart"],
  ["Entretenimiento", "#4a8fe7", "sparkles"], ["Compras", "#a96fe8", "bag"],
  ["Educación", "#36a2a5", "book"], ["Otros", "#8a9893", "circle"],
] as const;

const ruleDefaults = [
  ["Uber y Cabify", "UBER|CABIFY|DIDI", "Transporte"],
  ["Supermercados", "TOTTUS|WONG|PLAZA VEA|VIVANDA|METRO", "Alimentación"],
  ["Streaming", "NETFLIX|SPOTIFY|DISNEY|HBO", "Entretenimiento"],
  ["Farmacias", "INKAFARMA|MIFARMA|FARMACIA", "Salud"],
  ["Tiendas", "FALABELLA|RIPLEY|OECHSLE|MERCADO LIBRE|AMAZON", "Compras"],
] as const;

export async function ensureUserDefaults(userId: string) {
  const db = getDb();
  let existing = await db.select().from(categories).where(eq(categories.userId, userId));
  if (!existing.length) {
    const rows = categoryDefaults.map(([name, color, icon]) => ({ id: crypto.randomUUID(), userId, name, color, icon, kind: "expense" }));
    await db.insert(categories).values(rows).onConflictDoNothing();
    existing = await db.select().from(categories).where(eq(categories.userId, userId));
  }
  const currentRules = await db.select({ id: categorizationRules.id }).from(categorizationRules).where(eq(categorizationRules.userId, userId)).limit(1);
  if (!currentRules.length) {
    const byName = new Map(existing.map((item) => [item.name, item.id]));
    const values = ruleDefaults.flatMap(([name, pattern, categoryName], index) => {
      const categoryId = byName.get(categoryName);
      return categoryId ? [{ id: crypto.randomUUID(), userId, name, field: "merchant", operator: "regex", pattern, categoryId, priority: 10 + index, enabled: true }] : [];
    });
    if (values.length) await db.insert(categorizationRules).values(values).onConflictDoNothing();
  }
  return existing;
}

function matches(value: string, operator: string, pattern: string): boolean {
  if (operator === "equals") return value.toLocaleLowerCase() === pattern.toLocaleLowerCase();
  if (operator === "starts_with") return value.toLocaleLowerCase().startsWith(pattern.toLocaleLowerCase());
  if (operator === "regex") { if (regexProblem(pattern)) return false; try { return new RegExp(pattern, "i").test(value.slice(0, 150)); } catch { return false; } }
  return value.toLocaleLowerCase().includes(pattern.toLocaleLowerCase());
}

/** Carga categorías y reglas una sola vez; útil en la sincronización para no consultar la base por cada correo. */
export async function createClassifier(userId: string) {
  const db = getDb();
  const available = await ensureUserDefaults(userId);
  const rules = await db.select().from(categorizationRules).where(and(eq(categorizationRules.userId, userId), eq(categorizationRules.enabled, true))).orderBy(asc(categorizationRules.priority));
  return (merchant: string, description = "") => {
    // Acota el texto evaluado para limitar el costo de las expresiones regulares del usuario.
    const text = `${merchant} ${description}`.slice(0, 500);
    for (const rule of rules) {
      const value = rule.field === "description" ? description.slice(0, 500) : text;
      if (matches(value, rule.operator, rule.pattern)) {
        const category = available.find((item) => item.id === rule.categoryId);
        if (category) return { categoryId: category.id as string | undefined, subcategoryId: rule.subcategoryId ?? undefined, name: category.name, source: "rule" as const };
      }
    }
    const fallbackName = categorize(merchant, description);
    const fallback = available.find((item) => item.name === fallbackName) ?? available.find((item) => item.name === "Otros");
    return { categoryId: fallback?.id as string | undefined, subcategoryId: undefined as string | undefined, name: fallback?.name ?? "Otros", source: "system" as const };
  };
}

export async function resolveCategory(userId: string, merchant: string, description = "") {
  return (await createClassifier(userId))(merchant, description);
}

export async function ensureCard(userId: string, bank: string, last4?: string, cardType?: string, brand?: string) {
  if (!last4 || !/^\d{4}$/.test(last4)) return undefined;
  const db = getDb();
  const [existing] = await db.select().from(cards).where(and(eq(cards.userId, userId), eq(cards.bank, bank), eq(cards.last4, last4))).limit(1);
  if (existing) return existing;
  const id = crypto.randomUUID();
  await db.insert(cards).values({ id, userId, bank, last4, cardType: cardType || "Crédito", brand: brand || "Tarjeta" }).onConflictDoNothing();
  const [created] = await db.select().from(cards).where(and(eq(cards.userId, userId), eq(cards.bank, bank), eq(cards.last4, last4))).limit(1);
  return created;
}

export async function getUserTaxonomy(userId: string) {
  const db = getDb();
  await ensureUserDefaults(userId);
  const [categoryRows, subcategoryRows, cardRows, ruleRows] = await Promise.all([
    db.select().from(categories).where(eq(categories.userId, userId)).orderBy(asc(categories.name)),
    db.select().from(subcategories).where(eq(subcategories.userId, userId)).orderBy(asc(subcategories.name)),
    db.select().from(cards).where(eq(cards.userId, userId)).orderBy(asc(cards.bank), asc(cards.last4)),
    db.select().from(categorizationRules).where(eq(categorizationRules.userId, userId)).orderBy(asc(categorizationRules.priority)),
  ]);
  return { categories: categoryRows, subcategories: subcategoryRows, cards: cardRows, rules: ruleRows };
}
