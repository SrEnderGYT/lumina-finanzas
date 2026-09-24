# Lúmina

Gestor financiero personal que convierte notificaciones de Gmail en movimientos clasificados y visualizaciones útiles.

## Qué incluye

- OAuth 2.0 de Google con alcance `gmail.readonly`.
- Tokens OAuth cifrados con AES-GCM antes de guardarse.
- Sesión HTTP-only firmada; cada consulta filtra por propietario.
- Sincronización idempotente mediante el índice único `(user_id, gmail_message_id)`.
- Parsers desacoplados para BCP, Interbank, BBVA y Scotiabank, además de un parser genérico.
- Clasificación determinística y fallback de IA opcional únicamente cuando las reglas no interpretan el correo.
- Dashboard responsive con KPIs, comparación mensual, tendencias, bancos, categorías, tarjetas, búsqueda y filtros.
- Corrección manual de categorías, persistida con la fuente `manual`.
- Base de datos D1/SQLite con migraciones Drizzle versionadas.

## Configuración local

1. Copia `.env.example` a `.env` y completa:

   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `APP_ENCRYPTION_KEY` (mínimo recomendado: 32 caracteres aleatorios)
   - `OPENAI_API_KEY` solo si deseas habilitar el fallback de IA

2. En Google Cloud Console habilita Gmail API y configura como URI autorizada:

   `http://localhost:5173/api/auth/google/callback`

3. Instala y prepara la base local:

   ```bash
   npm ci
   npm run build
   node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_greedy_dagger.sql
   ```

4. Inicia la aplicación:

   ```bash
   npm run dev
   ```

Sin credenciales, la interfaz abre en una vista de demostración claramente identificada. Ningún dato de demostración se escribe en la base.

## Flujo de datos

```text
Google OAuth → Gmail API (solo lectura) → normalización de correo
             → parser específico por banco → parser genérico → IA opcional
             → deduplicación por Gmail Message ID → D1
             → agregaciones y filtros → dashboard
```

## Añadir un banco

1. Crea un archivo en `lib/banks/` que implemente `BankParser`.
2. Mantén `canParse` específico para el remitente o marca del banco.
3. Devuelve montos en centavos y fechas en milisegundos.
4. Registra el parser antes de `genericParser` en `lib/banks/index.ts`.
5. No guardes el cuerpo completo del correo: Lúmina persiste solo campos normalizados y el asunto truncado.

## Seguridad

- El backend nunca solicita permisos de escritura de Gmail.
- Los tokens no se exponen al navegador.
- Las sesiones usan cookies `HttpOnly`, `SameSite=Lax` y `Secure` en HTTPS.
- Los filtros de propiedad se aplican en el servidor, incluso en actualizaciones.
- Los correos se tratan como contenido no confiable; el fallback de IA recibe una instrucción explícita para ignorar instrucciones dentro del mensaje.
- Los reembolsos, transferencias, ingresos y estados de cuenta se etiquetan por tipo de operación y no se suman como gasto ordinario.

## Comandos

- `npm run dev`: desarrollo local.
- `npm run build`: build de producción Cloudflare Worker compatible.
- `npm run db:generate`: genera una nueva migración después de modificar `db/schema.ts`.
- `npm run lint`: revisión estática opcional.
