import { syncGmail } from "@/lib/gmail";
import { requireSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    return Response.json({ ok: true, ...(await syncGmail(session.userId)) });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo sincronizar Gmail." }, { status: 500 });
  }
}
