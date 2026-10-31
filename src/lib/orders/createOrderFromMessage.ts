import { searchDebtors } from "@/lib/db/debtors";
import { getDebtorItemPreferences } from "@/lib/db/invoices";
import { listItems } from "@/lib/db/items";
import { createOrder } from "@/lib/db/orders";
import type { NewOrder, NewOrderItem, OrderWithItems } from "@/lib/db/types";
import { matchItem } from "@/lib/matcher/index";
import { parseOrderMessage } from "@/lib/parser/index";

export type CreateOrderInput = {
	message: string;
	date?: string;
	customerNameHint?: string;
};

export type CreateOrderResult =
	| { success: true; order: OrderWithItems }
	| { success: false; error: string; stage: "parse" | "create" };

type PreparedOrder = {
	order: NewOrder;
	lineItems: Omit<NewOrderItem, "orderId">[];
};

export type PrepareOrderResult =
	| { success: true; prepared: PreparedOrder }
	| { success: false; error: string; stage: "parse" | "create" };

export async function createOrderFromMessage(
	input: CreateOrderInput,
): Promise<CreateOrderResult> {
	const result = await prepareOrderFromMessage(input);
	if (!result.success) return result;

	try {
		return {
			success: true,
			order: createOrder(result.prepared.order, result.prepared.lineItems),
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown",
			stage: "create",
		};
	}
}

export async function prepareOrderFromMessage(
	input: CreateOrderInput,
): Promise<PrepareOrderResult> {
	const today = input.date ?? new Date().toISOString().split("T")[0];

	let parsedOrder: Awaited<ReturnType<typeof parseOrderMessage>>;
	try {
		parsedOrder = await parseOrderMessage(input.message, today);
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown",
			stage: "parse",
		};
	}

	try {
		const customerName =
			input.customerNameHint || parsedOrder.customerName || null;
		let debtorCode: string | null = null;
		let debtorName = customerName || "Unknown";
		let agent: string | null = null;

		if (customerName) {
			const matchedDebtors = searchDebtors(customerName);
			if (matchedDebtors.length > 0) {
				debtorCode = matchedDebtors[0].code;
				debtorName = matchedDebtors[0].companyName;
				agent = matchedDebtors[0].agent;
			}
		}

		const preferences = debtorCode ? getDebtorItemPreferences(debtorCode) : [];
		const catalogueItems = listItems({ isActive: true });
		const docDate = parsedOrder.deliveryDate || today;

		const lineItems = parsedOrder.items.map((item) => {
			const match = matchItem(item.itemName, preferences, catalogueItems);
			const unitPrice = match?.unitPrice ?? null;

			return {
				itemCode: match?.itemCode ?? null,
				rawItemName: item.rawText,
				description: match?.description ?? item.itemName,
				uom: match?.uom ?? item.uom ?? null,
				qty: item.qty,
				unitPrice,
				lineTotal: unitPrice != null ? unitPrice * item.qty : null,
				matched: !!match,
			};
		});

		return {
			success: true,
			prepared: {
				order: {
					debtorCode,
					debtorName,
					agent,
					docDate,
					rawMessage: input.message,
					status: "draft",
				},
				lineItems,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown",
			stage: "create",
		};
	}
}
