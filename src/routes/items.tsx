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
import { ItemModal } from "@/components/items/ItemModal";
import { ConfirmDeleteModal } from "@/components/shared/ConfirmDeleteModal";
import { PageHeader } from "@/components/shared/PageHeader";
import { apiCall, useApi } from "@/hooks/useApi";
import type { Item } from "@/lib/db/types";

export const Route = createFileRoute("/items")({ component: ItemsPage });

function ItemsPage() {
	const [search, setSearch] = useState("");
	const {
		data: items,
		loading,
		refetch,
	} = useApi<Item[]>(
		search ? `/api/items?search=${encodeURIComponent(search)}` : "/api/items",
	);
	const [modalOpen, setModalOpen] = useState(false);
	const [editItem, setEditItem] = useState<Item | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
	const [deleting, setDeleting] = useState(false);

	const handleCreate = () => {
		setEditItem(null);
		setModalOpen(true);
	};

	const handleEdit = (item: Item) => {
		setEditItem(item);
		setModalOpen(true);
	};

	const handleSave = async (data: Partial<Item>) => {
		if (editItem) {
			await apiCall(`/api/items/${editItem.code}`, {
				method: "PUT",
				body: JSON.stringify(data),
			});
		} else {
			await apiCall("/api/items", {
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
			await apiCall(`/api/items/${deleteTarget.code}`, { method: "DELETE" });
			setDeleteTarget(null);
			refetch();
		} finally {
			setDeleting(false);
		}
	};

	return (
		<div>
			<PageHeader
				title="Item Codes"
				action={
					<Button
						color="primary"
						startContent={<Plus size={18} />}
						onPress={handleCreate}
					>
						Add Item
					</Button>
				}
			/>

			<div className="mb-4">
				<Input
					placeholder="Search items..."
					value={search}
					onValueChange={setSearch}
					startContent={<Search size={18} className="text-gray-400" />}
					className="max-w-sm"
					isClearable
					onClear={() => setSearch("")}
				/>
			</div>

			<Table
				aria-label="Items table"
				isStriped
				classNames={{
					wrapper: "bg-gray-900/50 border border-gray-800",
					th: "bg-gray-800/50 text-gray-300",
				}}
			>
				<TableHeader>
					<TableColumn>Code</TableColumn>
					<TableColumn>Description</TableColumn>
					<TableColumn>UOM</TableColumn>
					<TableColumn>Group</TableColumn>
					<TableColumn>Price</TableColumn>
					<TableColumn>Status</TableColumn>
					<TableColumn>Actions</TableColumn>
				</TableHeader>
				<TableBody
					items={items ?? []}
					isLoading={loading}
					emptyContent="No items found."
				>
					{(item) => (
						<TableRow key={item.code}>
							<TableCell className="font-mono text-sm">{item.code}</TableCell>
							<TableCell className="font-medium max-w-xs truncate">
								{item.description}
							</TableCell>
							<TableCell>{item.baseUom}</TableCell>
							<TableCell className="text-gray-400">
								{item.itemGroup ?? "—"}
							</TableCell>
							<TableCell className="text-right">
								{item.price != null ? `$${item.price.toFixed(2)}` : "—"}
							</TableCell>
							<TableCell>
								<Chip
									color={item.isActive ? "success" : "default"}
									size="sm"
									variant="flat"
								>
									{item.isActive ? "Active" : "Inactive"}
								</Chip>
							</TableCell>
							<TableCell>
								<div className="flex gap-1">
									<Tooltip content="Edit">
										<Button
											isIconOnly
											size="sm"
											variant="light"
											onPress={() => handleEdit(item)}
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
											onPress={() => setDeleteTarget(item)}
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

			<ItemModal
				isOpen={modalOpen}
				onClose={() => setModalOpen(false)}
				onSave={handleSave}
				item={editItem}
			/>

			<ConfirmDeleteModal
				isOpen={deleteTarget !== null}
				onClose={() => setDeleteTarget(null)}
				onConfirm={handleDelete}
				loading={deleting}
				message={`Delete item "${deleteTarget?.code}"? This cannot be undone.`}
			/>
		</div>
	);
}
