/**
 * Redirección con cabeceras mutables. `Response.redirect()` devuelve cabeceras inmutables en
 * Cloudflare Workers, así que añadir `set-cookie` a esa respuesta lanza TypeError.
 */
export function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ location });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(null, { status: 302, headers });
}
