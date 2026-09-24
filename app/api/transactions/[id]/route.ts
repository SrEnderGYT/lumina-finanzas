import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { transactions } from "@/db/schema";
import { requireSession } from "@/lib/session";

const payloadSchema = z.object({ category: z.string().trim().min(2).max(60) });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession(request);
    const payload = payloadSchema.safeParse(await request.json());
    if (!payload.success) return Response.json({ error: "Categoría no válida." }, { status: 400 });
    const { id } = await context.params;
    const [updated] = await getDb().update(transactions).set({ category: payload.data.category, categorySource: "manual", updatedAt: Math.floor(Date.now() / 1000) }).where(and(eq(transactions.id, id), eq(transactions.userId, session.userId))).returning({ id: transactions.id, category: transactions.category });
    if (!updated) return Response.json({ error: "Movimiento no encontrado." }, { status: 404 });
    return Response.json({ transaction: updated });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: "No se pudo actualizar la categoría." }, { status: 500 });
  }
}
