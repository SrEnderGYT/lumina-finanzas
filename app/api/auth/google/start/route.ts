import { redirect } from "@/lib/http";
import { requireSecret } from "@/lib/runtime-env";

export async function GET(request: Request) {
  try {
    const origin = new URL(request.url).origin;
    const state = crypto.randomUUID();
    const params = new URLSearchParams({ client_id: requireSecret("GOOGLE_CLIENT_ID"), redirect_uri: `${origin}/api/auth/google/callback`, response_type: "code", access_type: "offline", prompt: "consent", state, scope: "https://www.googleapis.com/auth/gmail.readonly" });
    return redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, [`lumina_oauth_state=${state}; Path=/api/auth/google/callback; HttpOnly; SameSite=Lax; Max-Age=600${origin.startsWith("https:") ? "; Secure" : ""}`]);
  } catch {
    return redirect(`${new URL(request.url).origin}/?auth=setup`);
  }
}
