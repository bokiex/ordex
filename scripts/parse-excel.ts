import { readdirSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";

const EXCEL_DIR = join(import.meta.dirname ?? "", "../docs/excel sheets");

const files = readdirSync(EXCEL_DIR).filter(
	(f) => f.endsWith(".xlsx") && !f.includes("Zone.Identifier"),
);

for (const file of files) {
	const filePath = join(EXCEL_DIR, file);
	const workbook = XLSX.readFile(filePath);

	console.log(`\n${"=".repeat(80)}`);
	console.log(`📄 FILE: ${file}`);
	console.log(`${"=".repeat(80)}`);
	console.log(`Sheets: ${workbook.SheetNames.join(", ")}`);

	for (const sheetName of workbook.SheetNames) {
		const sheet = workbook.Sheets[sheetName];
		const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
		const rows = range.e.r - range.s.r + 1;
		const cols = range.e.c - range.s.c + 1;

		console.log(`\n  📊 Sheet: "${sheetName}" (${rows} rows × ${cols} cols)`);

		// Get all data as JSON
		const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

		// Show headers (first few rows to catch multi-row headers)
		console.log(`\n  Headers / First 5 rows:`);
		const previewRows = Math.min(5, data.length);
		for (let i = 0; i < previewRows; i++) {
			const row = data[i];
			if (row?.some((cell) => cell !== undefined && cell !== null)) {
				console.log(`    Row ${i}: ${JSON.stringify(row)}`);
			}
		}

		// Show last 2 rows for context
		if (data.length > 7) {
			console.log(`    ...`);
			for (
				let i = Math.max(previewRows, data.length - 2);
				i < data.length;
				i++
			) {
				const row = data[i];
				if (row?.some((cell) => cell !== undefined && cell !== null)) {
					console.log(`    Row ${i}: ${JSON.stringify(row)}`);
				}
			}
		}

		// Column analysis
		if (data.length > 1) {
			const headerRow = data[0] as string[];
			console.log(`\n  Column Details:`);
			for (let c = 0; c < Math.min(cols, 30); c++) {
				const colName = headerRow?.[c] || `(unnamed col ${c})`;
				// Sample non-empty values from this column
				const samples: unknown[] = [];
				for (let r = 1; r < data.length && samples.length < 3; r++) {
					const val = data[r]?.[c];
					if (val !== undefined && val !== null && val !== "") {
						samples.push(val);
					}
				}
				if (samples.length > 0) {
					console.log(
						`    [${c}] "${colName}" → samples: ${JSON.stringify(samples)}`,
					);
				}
			}
		}
	}
}
