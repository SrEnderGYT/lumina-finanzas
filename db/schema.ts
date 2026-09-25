import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), email: text("email").notNull(), displayName: text("display_name"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`), updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
}, (table) => [uniqueIndex("idx_users_email").on(table.email)]);

export const gmailAccounts = sqliteTable("gmail_accounts", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }), email: text("email").notNull(),
  accessTokenEncrypted: text("access_token_encrypted").notNull(), refreshTokenEncrypted: text("refresh_token_encrypted"),
  tokenExpiresAt: integer("token_expires_at").notNull(), scope: text("scope").notNull(), historyId: text("history_id"),
  lastSyncAt: integer("last_sync_at"), createdAt: integer("created_at").notNull().default(sql`(unixepoch())`), updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
});

export const cards = sqliteTable("cards", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bank: text("bank").notNull(),
  brand: text("brand").notNull().default("Tarjeta"),
  last4: text("last4").notNull(),
  cardType: text("card_type").notNull().default("Crédito"),
  alias: text("alias"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
}, (table) => [
  uniqueIndex("idx_cards_user_bank_last4").on(table.userId, table.bank, table.last4),
  index("idx_cards_user").on(table.userId),
]);

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#8a9893"),
  icon: text("icon").notNull().default("circle"),
  kind: text("kind").notNull().default("expense"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
}, (table) => [uniqueIndex("idx_categories_user_name").on(table.userId, table.name)]);

export const subcategories = sqliteTable("subcategories", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  categoryId: text("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
}, (table) => [uniqueIndex("idx_subcategories_user_category_name").on(table.userId, table.categoryId, table.name)]);

export const categorizationRules = sqliteTable("categorization_rules", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  field: text("field").notNull().default("merchant"),
  operator: text("operator").notNull().default("contains"),
  pattern: text("pattern").notNull(),
  categoryId: text("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  subcategoryId: text("subcategory_id"),
  priority: integer("priority").notNull().default(100),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
}, (table) => [index("idx_rules_user_priority").on(table.userId, table.enabled, table.priority)]);

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  gmailMessageId: text("gmail_message_id").notNull(), gmailThreadId: text("gmail_thread_id"), gmailInternalDate: integer("gmail_internal_date"),
  bank: text("bank").notNull(), merchant: text("merchant").notNull(), operationDate: integer("operation_date").notNull(),
  amountCents: integer("amount_cents").notNull(), currency: text("currency").notNull().default("PEN"), cardType: text("card_type"),
  cardLast4: text("card_last4"), operationType: text("operation_type").notNull().default("expense"), category: text("category").notNull().default("Otros"),
  categorySource: text("category_source").notNull().default("rule"), description: text("description"), confidence: real("confidence").notNull().default(0),
  rawSubject: text("raw_subject"), parserId: text("parser_id").notNull(), createdAt: integer("created_at").notNull().default(sql`(unixepoch())`), updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
  source: text("source").notNull().default("gmail"), cardId: text("card_id"), categoryId: text("category_id"), subcategoryId: text("subcategory_id"), deletedAt: integer("deleted_at"),
}, (table) => [
  uniqueIndex("idx_transactions_user_message").on(table.userId, table.gmailMessageId),
  index("idx_transactions_user_date").on(table.userId, table.operationDate), index("idx_transactions_user_bank").on(table.userId, table.bank),
  index("idx_transactions_user_category").on(table.userId, table.category),
  index("idx_transactions_user_card").on(table.userId, table.cardId),
  index("idx_transactions_user_category_id").on(table.userId, table.categoryId),
]);

export const syncRuns = sqliteTable("sync_runs", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), status: text("status").notNull(),
  messagesScanned: integer("messages_scanned").notNull().default(0), transactionsCreated: integer("transactions_created").notNull().default(0),
  duplicatesSkipped: integer("duplicates_skipped").notNull().default(0), parseFailures: integer("parse_failures").notNull().default(0), errorMessage: text("error_message"),
  startedAt: integer("started_at").notNull().default(sql`(unixepoch())`), finishedAt: integer("finished_at"),
}, (table) => [
  index("idx_sync_runs_user_started").on(table.userId, table.startedAt),
  // Como máximo una ejecución activa por usuario: el índice hace atómico el bloqueo de sincronización.
  uniqueIndex("idx_sync_runs_one_running").on(table.userId).where(sql`status = 'running'`),
]);

// Correos revisados que no produjeron movimiento (no bancarios o ilegibles): evita reprocesarlos y atascar los lotes.
export const processedMessages = sqliteTable("processed_messages", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  gmailMessageId: text("gmail_message_id").notNull(),
  status: text("status").notNull().default("ignored"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
}, (table) => [primaryKey({ columns: [table.userId, table.gmailMessageId] })]);
