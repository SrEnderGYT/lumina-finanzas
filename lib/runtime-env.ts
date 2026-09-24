import { env } from "cloudflare:workers";

export type RuntimeEnv = Cloudflare.Env;

export function getRuntimeEnv(): RuntimeEnv {
  return env;
}

export function requireSecret(name: keyof Pick<RuntimeEnv, "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" | "APP_ENCRYPTION_KEY">): string {
  const value = env[name];
  if (!value) throw new Error(`Falta configurar ${name}.`);
  return value;
}
