import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const projectRoot = resolve(import.meta.dirname, "../../..");
const migrationFiles = [
	"0000_right_revanche.sql",
	"0001_daily_kang.sql",
	"0002_lovely_fenris.sql",
	"0003_skinny_microchip.sql",
	"0004_backfill_item_prices.sql",
	"0005_clammy_elektra.sql",
];
const tempDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		tempDirectories
			.splice(0)
			.map((directory) => rm(directory, { force: true, recursive: true })),
	);
});

describe("database seed script", () => {
	it("runs successfully through the configured package command", async () => {
		const tempDirectory = await mkdtemp(join(tmpdir(), "ordex-seed-"));
		tempDirectories.push(tempDirectory);
		const databasePath = join(tempDirectory, "ordex.db");

		await createMigratedDatabase(databasePath);

		const { stdout } = await execFileAsync("npm", ["run", "db:seed"], {
			cwd: projectRoot,
			env: { ...process.env, DATABASE_URL: databasePath },
			maxBuffer: 10 * 1024 * 1024,
		});

		expect(stdout).toContain("Seed complete!");
		expect(readRowCount(databasePath, "items")).toBeGreaterThan(0);
		expect(readRowCount(databasePath, "debtors")).toBeGreaterThan(0);
		expect(readRowCount(databasePath, "invoice_history")).toBeGreaterThan(0);
	});
});

async function createMigratedDatabase(databasePath: string): Promise<void> {
	const database = new Database(databasePath);

	try {
		for (const migrationFile of migrationFiles) {
			const migration = await readFile(
				join(projectRoot, "drizzle", migrationFile),
				"utf8",
			);
			database.exec(migration);
		}
	} finally {
		database.close();
	}
}

function readRowCount(databasePath: string, tableName: string): number {
	const database = new Database(databasePath, { readonly: true });

	try {
		return (
			database.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get() as {
				count: number;
			}
		).count;
	} finally {
		database.close();
	}
}
