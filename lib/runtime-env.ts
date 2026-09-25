import { env } from "cloudflare:workers";

export type RuntimeEnv = Cloudflare.Env;

export function getRuntimeEnv(): RuntimeEnv {
  return new Proxy(env, {
    get(target, property, receiver) {
      const workerValue = Reflect.get(target, property, receiver);
      if (workerValue !== undefined) return workerValue;

      if (typeof property === "string" && typeof process !== "undefined") {
        return process.env[property];
      }

      return undefined;
    },
  });
}

export function requireSecret(name: keyof Pick<RuntimeEnv, "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" | "APP_ENCRYPTION_KEY">): string {
  const value = getRuntimeEnv()[name];
  if (!value) throw new Error(`Falta configurar ${name}.`);
  return value;
}
