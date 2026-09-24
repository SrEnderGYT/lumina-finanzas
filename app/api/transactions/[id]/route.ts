import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { cards, categories, subcategories, transactions } from "@/db/schema";
import { requireSession } from "@/lib/session";

const updateSchema = z.object({
  merchant: z.string().trim().min(2).max(120).optional(), description: z.string().trim().max(300).nullable().optional(), amount: z.number().positive().max(100000000).optional(),
  currency: z.enum(["PEN", "USD"]).optional(), operationDate: z.number().int().positive().optional(), operationType: z.enum(["expense", "card_charge", "subscription", "refund", "transfer", "income"]).optional(),
  bank: z.string().trim().min(2).max(80).optional(), cardId: z.string().uuid().nullable().optional(), categoryId: z.string().uuid().optional(), subcategoryId: z.string().uuid().nullable().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession(request);
    const payload = updateSchema.safeParse(await request.json());
    if (!payload.success) return Response.json({ error: "Revisa los datos del movimiento." }, { status: 400 });
    const { id } = await context.params;
    const db = getDb();
    const value = payload.data;
    const subcategory = value.subcategoryId ? (await db.select().from(subcategories).where(and(eq(subcategories.id, value.subcategoryId), eq(subcategories.userId, session.userId))).limit(1))[0] : undefined;
    if (value.subcategoryId && !subcategory) return Response.json({ error: "Subcategoría no encontrada." }, { status: 404 });
    if (value.categoryId && subcategory && subcategory.categoryId !== value.categoryId) return Response.json({ error: "La subcategoría no pertenece a la categoría seleccionada." }, { status: 400 });
    const selectedCategoryId = value.categoryId || subcategory?.categoryId;
    const category = selectedCategoryId ? (await db.select().from(categories).where(and(eq(categories.id, selectedCategoryId), eq(categories.userId, session.userId))).limit(1))[0] : undefined;
    if (value.categoryId && !category) return Response.json({ error: "Categoría no encontrada." }, { status: 404 });
    const card = value.cardId ? (await db.select().from(cards).where(and(eq(cards.id, value.cardId), eq(cards.userId, session.userId))).limit(1))[0] : undefined;
    if (value.cardId && !card) return Response.json({ error: "Tarjeta no encontrada." }, { status: 404 });
    const [updated] = await db.update(transactions).set({
      ...(value.merchant !== undefined ? { merchant: value.merchant } : {}), ...(value.description !== undefined ? { description: value.description } : {}),
      ...(value.amount !== undefined ? { amountCents: Math.round(value.amount * 100) } : {}), ...(value.currency ? { currency: value.currency } : {}),
      ...(value.operationDate ? { operationDate: value.operationDate } : {}), ...(value.operationType ? { operationType: value.operationType } : {}),
      ...(value.bank ? { bank: value.bank } : {}), ...(value.cardId !== undefined ? { cardId: value.cardId, cardLast4: card?.last4 ?? null, cardType: card?.cardType ?? null, bank: card?.bank ?? value.bank } : {}),
      ...(category ? { categoryId: category.id, category: category.name, categorySource: "manual" } : {}), ...(value.subcategoryId !== undefined ? { subcategoryId: subcategory?.id ?? null } : {}),
      updatedAt: Math.floor(Date.now() / 1000),
    }).where(and(eq(transactions.id, id), eq(transactions.userId, session.userId))).returning();
    if (!updated) return Response.json({ error: "Movimiento no encontrado." }, { status: 404 });
    return Response.json({ transaction: updated });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: "No se pudo actualizar el movimiento." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession(request);
    const { id } = await context.params;
    const [deleted] = await getDb().update(transactions).set({ deletedAt: Math.floor(Date.now() / 1000), updatedAt: Math.floor(Date.now() / 1000) }).where(and(eq(transactions.id, id), eq(transactions.userId, session.userId))).returning({ id: transactions.id });
    if (!deleted) return Response.json({ error: "Movimiento no encontrado." }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: "No se pudo eliminar el movimiento." }, { status: 500 });
  }
}
