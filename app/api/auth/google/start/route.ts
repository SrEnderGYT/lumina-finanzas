import { requireSecret } from "@/lib/runtime-env";

export async function GET(request: Request) {
  try {
    const origin = new URL(request.url).origin;
    const state = crypto.randomUUID();
    const params = new URLSearchParams({ client_id: requireSecret("GOOGLE_CLIENT_ID"), redirect_uri: `${origin}/api/auth/google/callback`, response_type: "code", access_type: "offline", prompt: "consent", include_granted_scopes: "true", state, scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly" });
    const response = Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
    response.headers.append("set-cookie", `lumina_oauth_state=${state}; Path=/api/auth/google/callback; HttpOnly; SameSite=Lax; Max-Age=600${origin.startsWith("https:") ? "; Secure" : ""}`);
    return response;
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "OAuth no está configurado." }, { status: 503 });
  }
}
