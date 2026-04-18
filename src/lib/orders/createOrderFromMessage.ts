import { searchDebtors } from "@/lib/db/debtors";
import { getDebtorItemPreferences } from "@/lib/db/invoices";
import { createOrder } from "@/lib/db/orders";
import type { OrderWithItems } from "@/lib/db/types";
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

export async function createOrderFromMessage(
	input: CreateOrderInput,
): Promise<CreateOrderResult> {
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
			parsedOrder.customerName || input.customerNameHint || null;
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
		const docDate = parsedOrder.deliveryDate || today;

		const lineItems = parsedOrder.items.map((item) => {
			const match = matchItem(item.itemName, preferences);
			const unitPrice = match?.unitPrice ?? null;

			return {
				itemCode: match?.itemCode ?? null,
				rawItemName: item.rawText,
				description: match?.description ?? item.itemName,
				uom: item.uom || match?.uom || null,
				qty: item.qty,
				unitPrice,
				lineTotal: unitPrice != null ? unitPrice * item.qty : null,
				matched: !!match,
			};
		});

		const order = createOrder(
			{
				debtorCode,
				debtorName,
				agent,
				docDate,
				rawMessage: input.message,
				status: "draft",
			},
			lineItems,
		);

		return { success: true, order };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown",
			stage: "create",
		};
	}
}
