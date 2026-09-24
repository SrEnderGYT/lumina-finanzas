import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { gmailAccounts, users } from "@/db/schema";
import { encryptSecret } from "@/lib/crypto";
import { requireSecret } from "@/lib/runtime-env";
import { createSessionToken, sessionCookie } from "@/lib/session";
import { ensureUserDefaults } from "@/lib/domain";

function readCookie(request: Request, name: string) { return (request.headers.get("cookie") ?? "").split(";").map((x) => x.trim()).find((x) => x.startsWith(`${name}=`))?.slice(name.length + 1); }

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || readCookie(request, "lumina_oauth_state") !== state) return Response.redirect(`${url.origin}/?auth=error`, 302);
  try {
    const body = new URLSearchParams({ code, client_id: requireSecret("GOOGLE_CLIENT_ID"), client_secret: requireSecret("GOOGLE_CLIENT_SECRET"), redirect_uri: `${url.origin}/api/auth/google/callback`, grant_type: "authorization_code" });
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
    if (!tokenResponse.ok) throw new Error("No se pudo completar la autorización de Google.");
    const token = await tokenResponse.json() as { access_token: string; refresh_token?: string; expires_in: number; scope: string };
    const profileResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { authorization: `Bearer ${token.access_token}` } });
    if (!profileResponse.ok) throw new Error("No se pudo leer el perfil de Gmail.");
    const profile = await profileResponse.json() as { emailAddress: string; historyId?: string };
    const db = getDb();
    const [existing] = await db.select().from(users).where(eq(users.email, profile.emailAddress)).limit(1);
    const userId = existing?.id ?? crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    await db.insert(users).values({ id: userId, email: profile.emailAddress, displayName: profile.emailAddress.split("@")[0] }).onConflictDoUpdate({ target: users.email, set: { updatedAt: now } });
    const secret = requireSecret("APP_ENCRYPTION_KEY");
    const [previous] = await db.select().from(gmailAccounts).where(eq(gmailAccounts.userId, userId)).limit(1);
    const historyId = previous?.lastSyncAt ? previous.historyId : profile.historyId;
    await db.insert(gmailAccounts).values({ userId, email: profile.emailAddress, accessTokenEncrypted: await encryptSecret(token.access_token, secret), refreshTokenEncrypted: token.refresh_token ? await encryptSecret(token.refresh_token, secret) : previous?.refreshTokenEncrypted, tokenExpiresAt: now + token.expires_in, scope: token.scope, historyId, updatedAt: now }).onConflictDoUpdate({ target: gmailAccounts.userId, set: { email: profile.emailAddress, accessTokenEncrypted: await encryptSecret(token.access_token, secret), refreshTokenEncrypted: token.refresh_token ? await encryptSecret(token.refresh_token, secret) : previous?.refreshTokenEncrypted, tokenExpiresAt: now + token.expires_in, scope: token.scope, historyId, updatedAt: now } });
    await ensureUserDefaults(userId);
    const response = Response.redirect(`${url.origin}/app?auth=connected`, 302);
    response.headers.append("set-cookie", sessionCookie(await createSessionToken(userId, profile.emailAddress), request));
    response.headers.append("set-cookie", "lumina_oauth_state=; Path=/api/auth/google/callback; HttpOnly; SameSite=Lax; Max-Age=0");
    return response;
  } catch { return Response.redirect(`${url.origin}/?auth=error`, 302); }
}
