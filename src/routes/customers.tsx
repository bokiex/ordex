import {
	Button,
	Chip,
	Input,
	Table,
	TableBody,
	TableCell,
	TableColumn,
	TableHeader,
	TableRow,
	Tooltip,
} from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { DebtorModal } from "@/components/customers/DebtorModal";
import { ConfirmDeleteModal } from "@/components/shared/ConfirmDeleteModal";
import { PageHeader } from "@/components/shared/PageHeader";
import { apiCall, useApi } from "@/hooks/useApi";
import type { Debtor } from "@/lib/db/types";

export const Route = createFileRoute("/customers")({
	component: CustomersPage,
});

function CustomersPage() {
	const [search, setSearch] = useState("");
	const {
		data: debtors,
		loading,
		refetch,
	} = useApi<Debtor[]>(
		search
			? `/api/debtors?search=${encodeURIComponent(search)}`
			: "/api/debtors",
	);
	const [modalOpen, setModalOpen] = useState(false);
	const [editDebtor, setEditDebtor] = useState<Debtor | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<Debtor | null>(null);
	const [deleting, setDeleting] = useState(false);

	const handleCreate = () => {
		setEditDebtor(null);
		setModalOpen(true);
	};

	const handleEdit = (debtor: Debtor) => {
		setEditDebtor(debtor);
		setModalOpen(true);
	};

	const handleSave = async (data: Partial<Debtor>) => {
		if (editDebtor) {
			await apiCall(`/api/debtors/${editDebtor.code}`, {
				method: "PUT",
				body: JSON.stringify(data),
			});
		} else {
			await apiCall("/api/debtors", {
				method: "POST",
				body: JSON.stringify(data),
			});
		}
		refetch();
	};

	const handleDelete = async () => {
		if (!deleteTarget) return;
		setDeleting(true);
		try {
			await apiCall(`/api/debtors/${deleteTarget.code}`, { method: "DELETE" });
			setDeleteTarget(null);
			refetch();
		} finally {
			setDeleting(false);
		}
	};

	return (
		<div>
			<PageHeader
				title="Customers"
				action={
					<Button
						color="primary"
						startContent={<Plus size={18} />}
						onPress={handleCreate}
					>
						Add Customer
					</Button>
				}
			/>

			<div className="mb-4">
				<Input
					placeholder="Search customers..."
					value={search}
					onValueChange={setSearch}
					startContent={<Search size={18} className="text-gray-400" />}
					className="max-w-sm"
					isClearable
					onClear={() => setSearch("")}
				/>
			</div>

			<Table
				aria-label="Customers table"
				isStriped
				classNames={{
					wrapper: "bg-gray-900/50 border border-gray-800",
					th: "bg-gray-800/50 text-gray-300",
				}}
			>
				<TableHeader>
					<TableColumn>Code</TableColumn>
					<TableColumn>Company Name</TableColumn>
					<TableColumn>Alias</TableColumn>
					<TableColumn>Phone</TableColumn>
					<TableColumn>Agent</TableColumn>
					<TableColumn>Currency</TableColumn>
					<TableColumn>Status</TableColumn>
					<TableColumn>Actions</TableColumn>
				</TableHeader>
				<TableBody
					items={debtors ?? []}
					isLoading={loading}
					emptyContent="No customers found."
				>
					{(debtor) => (
						<TableRow key={debtor.code}>
							<TableCell className="font-mono text-sm">{debtor.code}</TableCell>
							<TableCell className="font-medium">
								{debtor.companyName}
							</TableCell>
							<TableCell className="text-gray-400">
								{debtor.alias ?? "—"}
							</TableCell>
							<TableCell className="text-gray-400">
								{debtor.phone ?? "—"}
							</TableCell>
							<TableCell className="text-gray-400">
								{debtor.agent ?? "—"}
							</TableCell>
							<TableCell>{debtor.currencyCode}</TableCell>
							<TableCell>
								<Chip
									color={debtor.isActive ? "success" : "default"}
									size="sm"
									variant="flat"
								>
									{debtor.isActive ? "Active" : "Inactive"}
								</Chip>
							</TableCell>
							<TableCell>
								<div className="flex gap-1">
									<Tooltip content="Edit">
										<Button
											isIconOnly
											size="sm"
											variant="light"
											onPress={() => handleEdit(debtor)}
										>
											<Pencil size={16} />
										</Button>
									</Tooltip>
									<Tooltip content="Delete" color="danger">
										<Button
											isIconOnly
											size="sm"
											variant="light"
											color="danger"
											onPress={() => setDeleteTarget(debtor)}
										>
											<Trash2 size={16} />
										</Button>
									</Tooltip>
								</div>
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>

			<DebtorModal
				isOpen={modalOpen}
				onClose={() => setModalOpen(false)}
				onSave={handleSave}
				debtor={editDebtor}
			/>

			<ConfirmDeleteModal
				isOpen={deleteTarget !== null}
				onClose={() => setDeleteTarget(null)}
				onConfirm={handleDelete}
				loading={deleting}
				message={`Delete customer "${deleteTarget?.companyName}"? This cannot be undone.`}
			/>
		</div>
	);
}
