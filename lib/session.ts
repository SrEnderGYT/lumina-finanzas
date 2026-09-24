import { decodeBase64Url, encodeBase64Url, hmac } from "./crypto";
import { requireSecret } from "./runtime-env";

export type AppSession = { userId: string; email: string; exp: number };
export const SESSION_COOKIE = "lumina_session";

function cookieValue(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie") ?? "";
  const match = raw.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export async function createSessionToken(userId: string, email: string): Promise<string> {
  const payload = encodeBase64Url(JSON.stringify({ userId, email, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 }));
  return `${payload}.${await hmac(payload, requireSecret("APP_ENCRYPTION_KEY"))}`;
}

export async function getSession(request: Request): Promise<AppSession | null> {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = await hmac(payload, requireSecret("APP_ENCRYPTION_KEY"));
  if (signature.length !== expected.length) return null;
  let mismatch = 0;
  for (let index = 0; index < signature.length; index++) mismatch |= signature.charCodeAt(index) ^ expected.charCodeAt(index);
  if (mismatch !== 0) return null;
  const session = JSON.parse(decodeBase64Url(payload)) as AppSession;
  return session.exp > Math.floor(Date.now() / 1000) ? session : null;
}

export function sessionCookie(token: string, request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`;
}

export function clearSessionCookie(request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export async function requireSession(request: Request): Promise<AppSession> {
  const session = await getSession(request);
  if (!session) throw new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: { "content-type": "application/json" } });
  return session;
}
