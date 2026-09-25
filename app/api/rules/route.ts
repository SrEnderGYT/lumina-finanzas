import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { categories, categorizationRules, subcategories } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { regexProblem } from "@/lib/validation";

const schema = z.object({ name: z.string().trim().min(2).max(80), field: z.enum(["merchant", "description"]).default("merchant"), operator: z.enum(["contains", "equals", "starts_with", "regex"]).default("contains"), pattern: z.string().trim().min(1).max(200), categoryId: z.string().uuid(), subcategoryId: z.string().uuid().nullable().optional(), priority: z.number().int().min(1).max(1000).default(100), enabled: z.boolean().default(true) });

export async function POST(request: Request) {
  try { const session = await requireSession(request); const payload = schema.safeParse(await request.json()); if (!payload.success) return Response.json({ error: "Regla no válida." }, { status: 400 }); const problem = payload.data.operator === "regex" ? regexProblem(payload.data.pattern) : null; if (problem) return Response.json({ error: problem }, { status: 400 }); const db = getDb(); const [category] = await db.select().from(categories).where(and(eq(categories.id, payload.data.categoryId), eq(categories.userId, session.userId))).limit(1); if (!category) return Response.json({ error: "Categoría no encontrada." }, { status: 404 }); const subcategory = payload.data.subcategoryId ? (await db.select().from(subcategories).where(and(eq(subcategories.id, payload.data.subcategoryId), eq(subcategories.userId, session.userId), eq(subcategories.categoryId, category.id))).limit(1))[0] : undefined; if (payload.data.subcategoryId && !subcategory) return Response.json({ error: "Subcategoría no válida para esta categoría." }, { status: 400 }); const [rule] = await db.insert(categorizationRules).values({ id: crypto.randomUUID(), userId: session.userId, ...payload.data, subcategoryId: subcategory?.id }).returning(); return Response.json({ rule }, { status: 201 }); } catch (error) { if (error instanceof Response) return error; return Response.json({ error: "No se pudo crear la regla." }, { status: 500 }); }
}
