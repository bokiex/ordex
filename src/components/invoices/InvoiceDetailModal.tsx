import {
	Modal,
	ModalBody,
	ModalContent,
	ModalHeader,
	Table,
	TableBody,
	TableCell,
	TableColumn,
	TableHeader,
	TableRow,
} from "@heroui/react";
import type { InvoiceGroup } from "@/lib/db/types";

interface InvoiceDetailModalProps {
	isOpen: boolean;
	onClose: () => void;
	invoice: InvoiceGroup | null;
}

export function InvoiceDetailModal({
	isOpen,
	onClose,
	invoice,
}: InvoiceDetailModalProps) {
	if (!invoice) return null;

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
			<ModalContent>
				<ModalHeader className="flex flex-col gap-1">
					<span>{invoice.docNo}</span>
					<span className="text-sm text-gray-400 font-normal">
						{invoice.debtorName} — {invoice.docDate}
					</span>
				</ModalHeader>
				<ModalBody className="pb-6">
					<div className="grid grid-cols-3 gap-4 mb-4 text-sm">
						<div>
							<span className="text-gray-500">Debtor Code:</span>{" "}
							<span className="font-mono">{invoice.debtorCode}</span>
						</div>
						<div>
							<span className="text-gray-500">Agent:</span>{" "}
							{invoice.agent ?? "—"}
						</div>
						<div>
							<span className="text-gray-500">Total:</span>{" "}
							<span className="font-semibold text-cyan-400">
								${invoice.grandTotal.toFixed(2)}
							</span>
						</div>
					</div>

					<Table
						aria-label="Invoice line items"
						isStriped
						classNames={{
							wrapper: "bg-gray-900/50 border border-gray-800",
							th: "bg-gray-800/50 text-gray-300",
						}}
					>
						<TableHeader>
							<TableColumn>Item Code</TableColumn>
							<TableColumn>Description</TableColumn>
							<TableColumn>UOM</TableColumn>
							<TableColumn className="text-right">Qty</TableColumn>
							<TableColumn className="text-right">Unit Price</TableColumn>
							<TableColumn className="text-right">Line Total</TableColumn>
							<TableColumn>Tax</TableColumn>
						</TableHeader>
						<TableBody items={invoice.lines}>
							{(line) => (
								<TableRow key={line.id}>
									<TableCell className="font-mono text-sm">
										{line.itemCode}
									</TableCell>
									<TableCell className="max-w-xs truncate">
										{line.description}
									</TableCell>
									<TableCell>{line.uom}</TableCell>
									<TableCell className="text-right">{line.qty}</TableCell>
									<TableCell className="text-right">
										${line.unitPrice.toFixed(2)}
									</TableCell>
									<TableCell className="text-right">
										${(line.lineTotal ?? 0).toFixed(2)}
									</TableCell>
									<TableCell>{line.taxCode}</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</ModalBody>
			</ModalContent>
		</Modal>
	);
}
