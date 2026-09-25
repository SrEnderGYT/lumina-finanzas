import { ReconnectRequiredError, SyncInProgressError, syncGmail } from "@/lib/gmail";
import { requireSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    return Response.json({ ok: true, ...(await syncGmail(session.userId)) });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof ReconnectRequiredError) return Response.json({ error: error.message, code: "reconnect_required" }, { status: 403 });
    if (error instanceof SyncInProgressError) return Response.json({ error: error.message }, { status: 409 });
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo sincronizar Gmail." }, { status: 500 });
  }
}
