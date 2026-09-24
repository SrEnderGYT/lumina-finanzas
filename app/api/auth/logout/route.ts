import { clearSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  return new Response(null, { status: 204, headers: { "set-cookie": clearSessionCookie(request) } });
}
