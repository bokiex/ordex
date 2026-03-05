import { join } from "node:path";
import * as XLSX from "xlsx";
import { db } from "./index";
import { debtors, invoiceHistory, items } from "./schema";

const EXCEL_DIR = join(import.meta.dirname ?? "", "../../docs/excel sheets");

function excelDateToISO(serial: number): string {
	// Excel serial date → JS Date → ISO string
	const epoch = new Date(Date.UTC(1899, 11, 30));
	const date = new Date(epoch.getTime() + serial * 86400000);
	return date.toISOString().split("T")[0];
}

async function seed() {
	console.log("Seeding database from Excel files...\n");

	// ─── 1. Items from "Item Codes 26.2.26.xlsx" ───────────────────────────
	const itemsWb = XLSX.readFile(join(EXCEL_DIR, "Item Codes 26.2.26.xlsx"));
	const itemRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
		itemsWb.Sheets.Sheet,
	);

	const itemValues = itemRows.map((row) => ({
		code: String(row["Item Code"]),
		description: String(row.Description ?? ""),
		baseUom: String(row["Base UOM"] ?? "PCS").toUpperCase(),
		uomCount: Number(row["UOM Count"]) || 1,
		itemGroup: row["Item Group"] ? String(row["Item Group"]) : null,
		isActive: row["Is Active"] === "Checked",
		stockBalance:
			row["Total Bal. Qty"] != null ? Number(row["Total Bal. Qty"]) : null,
	}));

	const _itemResult = db
		.insert(items)
		.values(itemValues)
		.onConflictDoNothing()
		.run();
	console.log(`Items: inserted ${itemValues.length} rows`);

	// ─── 2. Debtors from "debtor listing.xlsx" ─────────────────────────────
	const debtorWb = XLSX.readFile(join(EXCEL_DIR, "debtor listing.xlsx"));
	const debtorRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
		debtorWb.Sheets.Sheet,
	);

	const debtorValues = debtorRows.map((row) => ({
		code: String(row.Code),
		companyName: String(row["Company Name"] ?? ""),
		alias: row["2nd Description"] ? String(row["2nd Description"]) : null,
		phone: row["Phone 1"] ? String(row["Phone 1"]) : null,
		agent: row.Agent ? String(row.Agent) : null,
		currencyCode: String(row["Currency Code"] ?? "SGD"),
		isActive: row.Active === "Checked",
		multiPricing: row["Multi Pricing"] ? String(row["Multi Pricing"]) : null,
	}));

	const _debtorResult = db
		.insert(debtors)
		.values(debtorValues)
		.onConflictDoNothing()
		.run();
	console.log(`Debtors: inserted ${debtorValues.length} rows`);

	// ─── 3. Invoice history from "INV DETAIL LISTING.xlsx" ─────────────────
	const invWb = XLSX.readFile(join(EXCEL_DIR, "INV DETAIL LISTING.xlsx"));
	const invRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
		invWb.Sheets.Sheet,
	);

	// Filter out summary/empty rows (last row has no Doc No)
	const validInvRows = invRows.filter(
		(row) => row["Doc No"] && row["Item Code"],
	);

	const invValues = validInvRows.map((row) => ({
		docNo: String(row["Doc No"]),
		docDate:
			typeof row["Doc Date"] === "number"
				? excelDateToISO(row["Doc Date"])
				: String(row["Doc Date"]),
		debtorCode: String(row["Debtor Code"]),
		debtorName: String(row["Debtor Name"] ?? ""),
		agent: row.Agent ? String(row.Agent) : null,
		itemCode: String(row["Item Code"]),
		description: String(row["Detail Description"] ?? ""),
		uom: String(row.UOM ?? "PCS").toUpperCase(),
		location: String(row.Location ?? "HQ"),
		qty: Number(row.Qty) || 0,
		unitPrice: Number(row["Unit Price"]) || 0,
		discount: row.Discount ? String(row.Discount) : null,
		lineTotal: row["Total (ex)"] != null ? Number(row["Total (ex)"]) : null,
		taxCode: String(row["Tax Code"] ?? "SR"),
		taxAmount: row.Tax_1 != null ? Number(row.Tax_1) : null,
		totalInc: row["Total (inc)"] != null ? Number(row["Total (inc)"]) : null,
		desc2: row.Desc2 ? String(row.Desc2) : null,
	}));

	// Insert in batches of 500 (SQLite variable limit)
	const BATCH_SIZE = 500;
	for (let i = 0; i < invValues.length; i += BATCH_SIZE) {
		const batch = invValues.slice(i, i + BATCH_SIZE);
		db.insert(invoiceHistory).values(batch).run();
	}
	console.log(
		`Invoice history: inserted ${invValues.length} rows (${new Set(validInvRows.map((r) => r["Doc No"])).size} unique invoices)`,
	);

	console.log("\nSeed complete!");
}

seed().catch(console.error);
