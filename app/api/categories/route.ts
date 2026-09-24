import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { categories, subcategories } from "@/db/schema";
import { requireSession } from "@/lib/session";

const schema = z.object({ name: z.string().trim().min(2).max(50), color: z.string().regex(/^#[0-9a-f]{6}$/i).default("#8a9893"), icon: z.string().trim().max(30).default("circle"), kind: z.enum(["expense", "income", "both"]).default("expense"), parentCategoryId: z.string().uuid().optional() });

export async function POST(request: Request) {
  try {
    const session = await requireSession(request); const payload = schema.safeParse(await request.json());
    if (!payload.success) return Response.json({ error: "Categoría no válida." }, { status: 400 });
    const db = getDb();
    if (payload.data.parentCategoryId) {
      const [parent] = await db.select().from(categories).where(and(eq(categories.id, payload.data.parentCategoryId), eq(categories.userId, session.userId))).limit(1);
      if (!parent) return Response.json({ error: "Categoría principal no encontrada." }, { status: 404 });
      const [subcategory] = await db.insert(subcategories).values({ id: crypto.randomUUID(), userId: session.userId, categoryId: parent.id, name: payload.data.name }).returning();
      return Response.json({ subcategory }, { status: 201 });
    }
    const [category] = await db.insert(categories).values({ id: crypto.randomUUID(), userId: session.userId, name: payload.data.name, color: payload.data.color, icon: payload.data.icon, kind: payload.data.kind }).returning();
    return Response.json({ category }, { status: 201 });
  } catch (error) { if (error instanceof Response) return error; return Response.json({ error: "No se pudo crear la categoría. Comprueba que no exista." }, { status: 409 }); }
}
