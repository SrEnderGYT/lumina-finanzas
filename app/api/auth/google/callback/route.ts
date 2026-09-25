import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { gmailAccounts, users } from "@/db/schema";
import { encryptSecret } from "@/lib/crypto";
import { redirect } from "@/lib/http";
import { requireSecret } from "@/lib/runtime-env";
import { createSessionToken, sessionCookie } from "@/lib/session";
import { ensureUserDefaults } from "@/lib/domain";

function readCookie(request: Request, name: string) { return (request.headers.get("cookie") ?? "").split(";").map((x) => x.trim()).find((x) => x.startsWith(`${name}=`))?.slice(name.length + 1); }

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const clearState = `lumina_oauth_state=; Path=/api/auth/google/callback; HttpOnly; SameSite=Lax; Max-Age=0${url.protocol === "https:" ? "; Secure" : ""}`;
  const stateValid = Boolean(state) && readCookie(request, "lumina_oauth_state") === state;
  // Solo se acepta la cancelación si pertenece al flujo iniciado por este navegador.
  if (stateValid && url.searchParams.get("error") === "access_denied") return redirect(`${url.origin}/?auth=denied`, [clearState]);
  if (!code || !stateValid) return redirect(`${url.origin}/?auth=error`, [clearState]);
  try {
    const body = new URLSearchParams({ code, client_id: requireSecret("GOOGLE_CLIENT_ID"), client_secret: requireSecret("GOOGLE_CLIENT_SECRET"), redirect_uri: `${url.origin}/api/auth/google/callback`, grant_type: "authorization_code" });
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
    if (!tokenResponse.ok) throw new Error("No se pudo completar la autorización de Google.");
    const token = await tokenResponse.json() as { access_token: string; refresh_token?: string; expires_in: number; scope: string };
    if (!token.scope?.split(" ").includes("https://www.googleapis.com/auth/gmail.readonly")) throw new Error("Falta el permiso de lectura de Gmail.");
    const profileResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { authorization: `Bearer ${token.access_token}` } });
    if (!profileResponse.ok) throw new Error("No se pudo leer el perfil de Gmail.");
    const profile = await profileResponse.json() as { emailAddress: string; historyId?: string };
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    // El upsert devuelve el id canónico, así dos inicios de sesión simultáneos no generan usuarios distintos.
    const [user] = await db.insert(users).values({ id: crypto.randomUUID(), email: profile.emailAddress, displayName: profile.emailAddress.split("@")[0] }).onConflictDoUpdate({ target: users.email, set: { updatedAt: now } }).returning({ id: users.id });
    const userId = user.id;
    const secret = requireSecret("APP_ENCRYPTION_KEY");
    const [previous] = await db.select().from(gmailAccounts).where(eq(gmailAccounts.userId, userId)).limit(1);
    const historyId = previous?.lastSyncAt ? previous.historyId : profile.historyId;
    await db.insert(gmailAccounts).values({ userId, email: profile.emailAddress, accessTokenEncrypted: await encryptSecret(token.access_token, secret), refreshTokenEncrypted: token.refresh_token ? await encryptSecret(token.refresh_token, secret) : previous?.refreshTokenEncrypted, tokenExpiresAt: now + token.expires_in, scope: token.scope, historyId, updatedAt: now }).onConflictDoUpdate({ target: gmailAccounts.userId, set: { email: profile.emailAddress, accessTokenEncrypted: await encryptSecret(token.access_token, secret), refreshTokenEncrypted: token.refresh_token ? await encryptSecret(token.refresh_token, secret) : previous?.refreshTokenEncrypted, tokenExpiresAt: now + token.expires_in, scope: token.scope, historyId, updatedAt: now } });
    await ensureUserDefaults(userId);
    return redirect(`${url.origin}/app?auth=connected`, [sessionCookie(await createSessionToken(userId, profile.emailAddress), request), clearState]);
  } catch { return redirect(`${url.origin}/?auth=error`, [clearState]); }
}
