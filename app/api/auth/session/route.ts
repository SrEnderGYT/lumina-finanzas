import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { gmailAccounts } from "@/db/schema";
import { getSession } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const session = await getSession(request);
    if (!session) return Response.json({ authenticated: false, connected: false });
    const [account] = await getDb().select({ lastSyncAt: gmailAccounts.lastSyncAt }).from(gmailAccounts).where(eq(gmailAccounts.userId, session.userId)).limit(1);
    return Response.json({ authenticated: true, connected: Boolean(account), email: session.email, lastSyncAt: account?.lastSyncAt ?? null });
  } catch { return Response.json({ authenticated: false, connected: false }); }
}
