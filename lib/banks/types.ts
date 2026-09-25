export type EmailInput = { id: string; threadId?: string; from: string; subject: string; body: string; internalDate: number };
export type OperationType = "expense" | "card_charge" | "subscription" | "refund" | "transfer" | "income" | "statement";
export type ParsedTransaction = {
  bank: string; merchant: string; operationDate: number; amountCents: number; currency: "PEN" | "USD";
  cardType?: string; cardLast4?: string; operationType: OperationType; description?: string; confidence: number; parserId: string;
};
export interface BankParser { id: string; /** Remitente esperado; tiene prioridad sobre coincidencias en asunto o cuerpo. */ sender?: RegExp; canParse(email: EmailInput): boolean; parse(email: EmailInput): ParsedTransaction | null; }
