import { z } from "zod";
import { getDb } from "@/db";
import { cards } from "@/db/schema";
import { requireSession } from "@/lib/session";

const schema = z.object({ bank: z.string().trim().min(2).max(80), brand: z.string().trim().min(2).max(30).default("Tarjeta"), last4: z.string().regex(/^\d{4}$/), cardType: z.enum(["Crédito", "Débito"]).default("Crédito"), alias: z.string().trim().max(50).optional() });

export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Revisa los datos de la tarjeta." }, { status: 400 });
    const [card] = await getDb().insert(cards).values({ id: crypto.randomUUID(), userId: session.userId, ...parsed.data }).returning();
    return Response.json({ card }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: "No se pudo registrar la tarjeta. Comprueba que no exista." }, { status: 409 });
  }
}
