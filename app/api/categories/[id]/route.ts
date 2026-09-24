import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { categories, categorizationRules, transactions } from "@/db/schema";
import { requireSession } from "@/lib/session";

const schema = z.object({ name: z.string().trim().min(2).max(50).optional(), color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(), icon: z.string().trim().max(30).optional(), kind: z.enum(["expense", "income", "both"]).optional() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const session = await requireSession(request); const payload = schema.safeParse(await request.json()); if (!payload.success) return Response.json({ error: "Categoría no válida." }, { status: 400 }); const { id } = await context.params; const [category] = await getDb().update(categories).set({ ...payload.data, updatedAt: Math.floor(Date.now() / 1000) }).where(and(eq(categories.id, id), eq(categories.userId, session.userId))).returning(); return category ? Response.json({ category }) : Response.json({ error: "Categoría no encontrada." }, { status: 404 }); } catch (error) { if (error instanceof Response) return error; return Response.json({ error: "No se pudo actualizar la categoría." }, { status: 500 }); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const session = await requireSession(request); const { id } = await context.params; const db = getDb(); const [fallback] = await db.select().from(categories).where(and(eq(categories.userId, session.userId), eq(categories.name, "Otros"))).limit(1); if (!fallback || fallback.id === id) return Response.json({ error: "La categoría Otros no se puede eliminar." }, { status: 400 }); await db.update(transactions).set({ categoryId: fallback.id, subcategoryId: null, category: fallback.name, categorySource: "system", updatedAt: Math.floor(Date.now() / 1000) }).where(and(eq(transactions.categoryId, id), eq(transactions.userId, session.userId))); await db.delete(categorizationRules).where(and(eq(categorizationRules.categoryId, id), eq(categorizationRules.userId, session.userId))); const [deleted] = await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, session.userId))).returning({ id: categories.id }); return deleted ? new Response(null, { status: 204 }) : Response.json({ error: "Categoría no encontrada." }, { status: 404 }); } catch (error) { if (error instanceof Response) return error; return Response.json({ error: "No se pudo eliminar la categoría." }, { status: 500 }); }
}
