import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { cards, transactions } from "@/db/schema";
import { requireSession } from "@/lib/session";

const schema = z.object({ alias: z.string().trim().max(50).nullable().optional(), bank: z.string().trim().min(2).max(80).optional(), brand: z.string().trim().min(2).max(30).optional(), cardType: z.enum(["Crédito", "Débito"]).optional() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession(request); const payload = schema.safeParse(await request.json());
    if (!payload.success) return Response.json({ error: "Datos no válidos." }, { status: 400 });
    const { id } = await context.params;
    const [card] = await getDb().update(cards).set({ ...payload.data, updatedAt: Math.floor(Date.now() / 1000) }).where(and(eq(cards.id, id), eq(cards.userId, session.userId))).returning();
    return card ? Response.json({ card }) : Response.json({ error: "Tarjeta no encontrada." }, { status: 404 });
  } catch (error) { if (error instanceof Response) return error; return Response.json({ error: "No se pudo actualizar la tarjeta." }, { status: 500 }); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession(request); const { id } = await context.params; const db = getDb();
    await db.update(transactions).set({ cardId: null }).where(and(eq(transactions.cardId, id), eq(transactions.userId, session.userId)));
    const [card] = await db.delete(cards).where(and(eq(cards.id, id), eq(cards.userId, session.userId))).returning({ id: cards.id });
    return card ? new Response(null, { status: 204 }) : Response.json({ error: "Tarjeta no encontrada." }, { status: 404 });
  } catch (error) { if (error instanceof Response) return error; return Response.json({ error: "No se pudo eliminar la tarjeta." }, { status: 500 }); }
}
