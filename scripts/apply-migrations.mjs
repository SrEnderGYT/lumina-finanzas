// Uso: npm run db:migrate:local [-- <número de la primera migración>]; p. ej. "-- 3" si la base ya tiene 0000-0002.
// Aplica en orden las migraciones de ./drizzle a la base D1 local (requiere `npm run build` previo).
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

const first = Number(process.argv[2] ?? 0);
const files = readdirSync("drizzle").filter((name) => name.endsWith(".sql") && Number(name.slice(0, 4)) >= first).sort();
for (const file of files) {
  console.log(`Aplicando ${file}`);
  const result = spawnSync(process.execPath, [
    "--import", "./scripts/sites-env.mjs", "./node_modules/wrangler/bin/wrangler.js", "d1", "execute", "DB",
    "--local", "--config", "dist/server/wrangler.json", "--persist-to", ".wrangler/state", "--file", `drizzle/${file}`,
  ], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
