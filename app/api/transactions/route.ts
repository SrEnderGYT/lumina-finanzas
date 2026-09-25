import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { cards, categories, subcategories, transactions } from "@/db/schema";
import { resolveCategory } from "@/lib/domain";
import { requireSession } from "@/lib/session";
import { amountSchema, operationDateSchema } from "@/lib/validation";

const createSchema = z.object({
  merchant: z.string().trim().min(2).max(120), description: z.string().trim().max(300).optional(), amount: amountSchema,
  currency: z.enum(["PEN", "USD"]).default("PEN"), operationDate: operationDateSchema, operationType: z.enum(["expense", "card_charge", "subscription", "refund", "transfer", "income"]).default("expense"),
  bank: z.string().trim().min(2).max(80).default("Manual"), cardId: z.string().uuid().optional(), categoryId: z.string().uuid().optional(), subcategoryId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Revisa los datos del movimiento." }, { status: 400 });
    const db = getDb();
    const value = parsed.data;
    const subcategory = value.subcategoryId ? (await db.select().from(subcategories).where(and(eq(subcategories.id, value.subcategoryId), eq(subcategories.userId, session.userId))).limit(1))[0] : undefined;
    if (value.subcategoryId && !subcategory) return Response.json({ error: "Subcategoría no encontrada." }, { status: 404 });
    if (value.categoryId && subcategory && subcategory.categoryId !== value.categoryId) return Response.json({ error: "La subcategoría no pertenece a la categoría seleccionada." }, { status: 400 });
    const selectedCategoryId = value.categoryId || subcategory?.categoryId;
    const category = selectedCategoryId ? (await db.select().from(categories).where(and(eq(categories.id, selectedCategoryId), eq(categories.userId, session.userId))).limit(1))[0] : undefined;
    if (selectedCategoryId && !category) return Response.json({ error: "Categoría no encontrada." }, { status: 404 });
    const automatic = category ? undefined : await resolveCategory(session.userId, value.merchant, value.description);
    const card = value.cardId ? (await db.select().from(cards).where(and(eq(cards.id, value.cardId), eq(cards.userId, session.userId))).limit(1))[0] : undefined;
    if (value.cardId && !card) return Response.json({ error: "Tarjeta no encontrada." }, { status: 404 });
    const id = crypto.randomUUID();
    const [created] = await db.insert(transactions).values({
      id, userId: session.userId, gmailMessageId: `manual:${id}`, merchant: value.merchant, description: value.description, amountCents: Math.round(value.amount * 100), currency: value.currency,
      operationDate: value.operationDate, operationType: value.operationType, bank: card?.bank || value.bank, cardId: card?.id, cardLast4: card?.last4, cardType: card?.cardType,
      category: category?.name || automatic?.name || "Otros", categoryId: category?.id || automatic?.categoryId, subcategoryId: subcategory?.id || automatic?.subcategoryId,
      categorySource: category ? "manual" : automatic?.source || "system", confidence: 1, parserId: "manual-v1", source: "manual",
    }).returning();
    return Response.json({ transaction: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: "No se pudo guardar el movimiento." }, { status: 500 });
  }
}
