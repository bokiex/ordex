import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type {
	debtors,
	incomingMessages,
	invoiceHistory,
	items,
	orderItems,
	orders,
} from "@/db/schema";

// ─── Row Types ───────────────────────────────────────────────────────────────

export type Item = InferSelectModel<typeof items>;
export type NewItem = InferInsertModel<typeof items>;

export type Debtor = InferSelectModel<typeof debtors>;
export type NewDebtor = InferInsertModel<typeof debtors>;

export type IncomingMessage = InferSelectModel<typeof incomingMessages>;
export type NewIncomingMessage = InferInsertModel<typeof incomingMessages>;
export type IncomingMessageStatus = "new" | "used";

export type Order = InferSelectModel<typeof orders>;
export type NewOrder = InferInsertModel<typeof orders>;

export type OrderItem = InferSelectModel<typeof orderItems>;
export type NewOrderItem = InferInsertModel<typeof orderItems>;

export type InvoiceHistoryLine = InferSelectModel<typeof invoiceHistory>;

export type OrderStatus = "draft" | "confirmed" | "exported";

// ─── Composite Types ─────────────────────────────────────────────────────────

export type OrderWithItems = Order & {
	debtor: Debtor | null;
	items: (OrderItem & { item: Item | null })[];
};

export type InvoiceGroup = {
	docNo: string;
	docDate: string;
	debtorCode: string;
	debtorName: string;
	agent: string | null;
	lines: InvoiceHistoryLine[];
	totalLines: number;
	grandTotal: number;
};
