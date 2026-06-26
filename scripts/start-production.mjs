import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const serverEntry = ".output/server/index.mjs";

if (!existsSync(serverEntry)) {
	console.error(
		`Production build not found at ${serverEntry}. Run "pnpm build" first.`,
	);
	process.exit(1);
}

const processes = [
	startProcess("web", process.execPath, [serverEntry]),
	startProcess("whatsapp", "bun", [
		"run",
		"src/workers/whatsapp-group/index.ts",
	]),
];

let shuttingDown = false;

for (const child of processes) {
	child.process.once("error", (error) => {
		console.error(`[start:${child.name}] Failed to start: ${error.message}`);
		void shutdown(1);
	});

	child.process.once("exit", (code, signal) => {
		if (shuttingDown) {
			return;
		}

		const reason = signal ? `signal ${signal}` : `exit code ${code ?? 1}`;
		console.error(
			`[start:${child.name}] Process stopped with ${reason}; shutting down.`,
		);
		void shutdown(code ?? 1);
	});
}

process.once("SIGINT", () => {
	void shutdown(0, "SIGINT");
});

process.once("SIGTERM", () => {
	void shutdown(0, "SIGTERM");
});

function startProcess(name, command, args) {
	console.info(`[start:${name}] Starting...`);

	return {
		name,
		process: spawn(command, args, {
			cwd: process.cwd(),
			env: {
				...process.env,
				NODE_ENV: "production",
			},
			stdio: "inherit",
		}),
	};
}

async function shutdown(exitCode, signal = "SIGTERM") {
	if (shuttingDown) {
		return;
	}

	shuttingDown = true;
	console.info(`[start] Shutting down (${signal})...`);

	for (const child of processes) {
		if (child.process.exitCode === null && child.process.signalCode === null) {
			child.process.kill(signal);
		}
	}

	await Promise.all(
		processes.map(
			(child) =>
				new Promise((resolve) => {
					if (
						child.process.exitCode !== null ||
						child.process.signalCode !== null
					) {
						resolve();
						return;
					}

					child.process.once("exit", resolve);
				}),
		),
	);

	process.exit(exitCode);
}
