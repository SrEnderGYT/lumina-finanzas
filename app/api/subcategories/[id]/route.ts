import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { categorizationRules, categories, subcategories, transactions } from "@/db/schema";
import { requireSession } from "@/lib/session";

const schema = z.object({
  name: z.string().trim().min(2).max(50).optional(),
  categoryId: z.string().uuid().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession(request);
    const payload = schema.safeParse(await request.json());
    if (!payload.success) return Response.json({ error: "Subcategoría no válida." }, { status: 400 });
    const db = getDb();
    if (payload.data.categoryId) {
      const [parent] = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, payload.data.categoryId), eq(categories.userId, session.userId))).limit(1);
      if (!parent) return Response.json({ error: "Categoría principal no encontrada." }, { status: 404 });
    }
    const { id } = await context.params;
    const [subcategory] = await db.update(subcategories).set({ ...payload.data, updatedAt: Math.floor(Date.now() / 1000) }).where(and(eq(subcategories.id, id), eq(subcategories.userId, session.userId))).returning();
    return subcategory ? Response.json({ subcategory }) : Response.json({ error: "Subcategoría no encontrada." }, { status: 404 });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: "No se pudo actualizar la subcategoría." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession(request);
    const { id } = await context.params;
    const db = getDb();
    await db.update(transactions).set({ subcategoryId: null, updatedAt: Math.floor(Date.now() / 1000) }).where(and(eq(transactions.subcategoryId, id), eq(transactions.userId, session.userId)));
    await db.update(categorizationRules).set({ subcategoryId: null, updatedAt: Math.floor(Date.now() / 1000) }).where(and(eq(categorizationRules.subcategoryId, id), eq(categorizationRules.userId, session.userId)));
    const [deleted] = await db.delete(subcategories).where(and(eq(subcategories.id, id), eq(subcategories.userId, session.userId))).returning({ id: subcategories.id });
    return deleted ? new Response(null, { status: 204 }) : Response.json({ error: "Subcategoría no encontrada." }, { status: 404 });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: "No se pudo eliminar la subcategoría." }, { status: 500 });
  }
}
