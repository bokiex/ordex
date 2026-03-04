import {
	Input,
	Table,
	TableBody,
	TableCell,
	TableColumn,
	TableHeader,
	TableRow,
} from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { InvoiceDetailModal } from "@/components/invoices/InvoiceDetailModal";
import { PageHeader } from "@/components/shared/PageHeader";
import { useApi } from "@/hooks/useApi";
import type { InvoiceGroup } from "@/lib/db/types";

export const Route = createFileRoute("/invoices")({ component: InvoicesPage });

function InvoicesPage() {
	const [search, setSearch] = useState("");
	const { data: invoices, loading } = useApi<InvoiceGroup[]>(
		search
			? `/api/invoices?debtorCode=${encodeURIComponent(search)}`
			: "/api/invoices",
	);
	const [selected, setSelected] = useState<InvoiceGroup | null>(null);

	return (
		<div>
			<PageHeader title="Invoice History" />

			<div className="mb-4">
				<Input
					placeholder="Filter by debtor code..."
					value={search}
					onValueChange={setSearch}
					startContent={<Search size={18} className="text-gray-400" />}
					className="max-w-sm"
					isClearable
					onClear={() => setSearch("")}
				/>
			</div>

			<Table
				aria-label="Invoices table"
				isStriped
				selectionMode="single"
				onRowAction={(key) => {
					const inv = (invoices ?? []).find((i) => i.docNo === key);
					if (inv) setSelected(inv);
				}}
				classNames={{
					wrapper: "bg-gray-900/50 border border-gray-800",
					th: "bg-gray-800/50 text-gray-300",
					tr: "cursor-pointer",
				}}
			>
				<TableHeader>
					<TableColumn>Doc No</TableColumn>
					<TableColumn>Date</TableColumn>
					<TableColumn>Debtor Code</TableColumn>
					<TableColumn>Debtor Name</TableColumn>
					<TableColumn>Agent</TableColumn>
					<TableColumn className="text-right">Lines</TableColumn>
					<TableColumn className="text-right">Total</TableColumn>
				</TableHeader>
				<TableBody
					items={invoices ?? []}
					isLoading={loading}
					emptyContent="No invoices found."
				>
					{(inv) => (
						<TableRow key={inv.docNo}>
							<TableCell className="font-mono text-sm">{inv.docNo}</TableCell>
							<TableCell>{inv.docDate}</TableCell>
							<TableCell className="font-mono text-sm">
								{inv.debtorCode}
							</TableCell>
							<TableCell className="font-medium">{inv.debtorName}</TableCell>
							<TableCell className="text-gray-400">
								{inv.agent ?? "—"}
							</TableCell>
							<TableCell className="text-right">{inv.totalLines}</TableCell>
							<TableCell className="text-right font-semibold">
								${inv.grandTotal.toFixed(2)}
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>

			<InvoiceDetailModal
				isOpen={selected !== null}
				onClose={() => setSelected(null)}
				invoice={selected}
			/>
		</div>
	);
}
