# Lúmina

Gestor financiero personal que convierte notificaciones de Gmail en movimientos clasificados y visualizaciones útiles.

## Qué incluye

- OAuth 2.0 de Google con alcance `gmail.readonly`.
- Tokens OAuth cifrados con AES-GCM antes de guardarse.
- Sesión HTTP-only firmada; cada consulta filtra por propietario.
- Sincronización idempotente mediante el índice único `(user_id, gmail_message_id)`.
- Sincronización incremental mediante Gmail History API, con recuperación por fecha si el historial expiró.
- Parsers desacoplados para BCP, Interbank, BBVA, Scotiabank, Falabella y Ripley, además de un parser genérico.
- Clasificación determinística y fallback de IA opcional únicamente cuando las reglas no interpretan el correo.
- Dashboard responsive con KPIs, comparación mensual, tendencias, bancos, categorías, tarjetas, búsqueda y filtros.
- CRUD de movimientos, tarjetas enmascaradas, categorías, subcategorías y reglas de clasificación.
- Corrección manual de categorías y separación entre movimientos importados y manuales.
- PWA instalable con experiencia responsive, estados vacíos, skeletons, toasts y modo sin conexión seguro.
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
   npm run db:migrate:local
   ```

   `db:migrate:local` aplica en orden las migraciones de `drizzle/`. Si tu base local ya tiene las anteriores, indica desde cuál continuar, por ejemplo `npm run db:migrate:local -- 3`.

4. Inicia la aplicación:

   ```bash
   npm run dev
   ```

La aplicación no contiene datos financieros simulados. Sin credenciales OAuth válidas, la landing seguirá disponible pero Google no podrá completar el acceso.

## Configuración en Google Cloud

1. Crea o selecciona un proyecto en Google Cloud Console.
2. Habilita **Gmail API**.
3. Configura la pantalla de consentimiento OAuth y declara únicamente el alcance sensible `https://www.googleapis.com/auth/gmail.readonly`.
4. Crea un cliente OAuth de tipo **Aplicación web**.
5. Registra los URI de redirección autorizados:

   - Local: `http://localhost:5173/api/auth/google/callback`
   - Producción: `https://lumina-finanzas.rich-squid-5478.chatgpt.site/api/auth/google/callback`

6. Define `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y una clave aleatoria fuerte en `APP_ENCRYPTION_KEY` dentro de los secretos del entorno de producción. Nunca uses valores de `.env` en el frontend ni los confirmes en Git.

## Flujo de datos

```text
Gmail (solo lectura) → detección del banco/emisor
  → clasificación: transacción | publicidad | estado de cuenta | otro
  → validación de que exista una operación real (evidencia textual, no solo un monto)
  → extracción: monto, fecha, comercio, tarjeta/cuenta, código de operación
  → nivel de confianza (alta / media / baja) → control de duplicados por Gmail Message ID
  → registro en D1 → categorización → reportes mensuales
```

### Clasificación y confianza

Un monto como `S/ 100` **nunca** basta para registrar un movimiento. `lib/banks/classify.ts` puntúa señales de publicidad
(«compra hasta S/…», «obtén S/…», descuentos, líneas de crédito, sorteos, cabecera `List-Unsubscribe`, pestaña Promociones de Gmail)
y señales de una operación ya realizada (verbos en pasado, «alerta de compra», código de operación, fecha y hora).

| Confianza | Condición | Se registra |
|---|---|---|
| Alta | monto + comercio + tarjeta/cuenta + fecha explícita | sí |
| Media | monto + comercio (o tarjeta) + evidencia textual clara de la operación | sí, con etiqueta «Confianza media» |
| Baja | solo un monto, características promocionales u operación no comprobable | **no** |

Ante la duda no se registra. Los correos descartados se guardan en `processed_messages` con su clasificación y motivo, y cada
movimiento guarda `classification`, `confidence_level` y `decision_reason`, para auditar y afinar las reglas. Pagar la tarjeta
se trata como transferencia (no como gasto) para no duplicar los consumos; un Yape/Plin recibido es un ingreso.

### Reportes mensuales

`/api/bootstrap?month=YYYY-MM` devuelve **solo** los movimientos de ese mes (hora de Lima, UTC-5): gastos, ingresos, balance,
transferencias, suscripciones, tarjetas, categorías y comercios. Los totales van en soles; otras monedas se listan aparte y no se suman.
Para detectar suscripciones y pagos recurrentes se analizan hasta 6 meses de historial (comercio + moneda + monto aproximado +
periodicidad + tarjeta), solo como análisis: cada movimiento sigue perteneciendo al mes en que ocurrió. Una compra única nunca es
una suscripción, y solo los servicios de suscripción conocidos o declarados en el correo se muestran como «Suscripción»; el resto
aparece como «Posible recurrente».

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
- `npm run db:migrate:local`: aplica las migraciones de `drizzle/` a la base D1 local (requiere `npm run build`).
- `npm run typecheck`: valida TypeScript estricto.
- `npm test`: ejecuta todas las pruebas (`test:parsers`, `test:validation`, `test:classify`, `test:recurrence`).
- `npm run test:parsers`: pruebas determinísticas de los parsers bancarios.
- `npm run test:classify`: casos de publicidad que debe rechazar y operaciones reales que debe aceptar.
- `npm run lint`: revisión estática opcional.
