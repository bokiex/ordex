import {
	Button,
	Table,
	TableBody,
	TableCell,
	TableColumn,
	TableHeader,
	TableRow,
	Tooltip,
} from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, Trash2 } from "lucide-react";
import { useState } from "react";
import { OrderDetailModal } from "@/components/orders/OrderDetailModal";
import { ParseOrderPanel } from "@/components/orders/ParseOrderPanel";
import { ConfirmDeleteModal } from "@/components/shared/ConfirmDeleteModal";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusChip } from "@/components/shared/StatusChip";
import { apiCall, useApi } from "@/hooks/useApi";
import type { OrderWithItems } from "@/lib/db/types";

export const Route = createFileRoute("/orders")({ component: OrdersPage });

// Lightweight order list type (from GET /api/orders)
interface OrderListItem {
	id: number;
	debtorCode: string | null;
	debtorName: string | null;
	agent: string | null;
	docDate: string;
	rawMessage: string;
	status: string;
	createdAt: string;
	debtor: { companyName: string } | null;
	_itemCount?: number;
}

function OrdersPage() {
	const {
		data: orders,
		loading,
		refetch,
	} = useApi<OrderListItem[]>("/api/orders");
	const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(
		null,
	);
	const [detailOpen, setDetailOpen] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<OrderListItem | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [loadingDetail, setLoadingDetail] = useState(false);

	const handleOrderCreated = (order: OrderWithItems) => {
		setSelectedOrder(order);
		setDetailOpen(true);
		refetch();
	};

	const openDetail = async (orderId: number) => {
		setLoadingDetail(true);
		try {
			const order = await apiCall<OrderWithItems>(`/api/orders/${orderId}`);
			setSelectedOrder(order);
			setDetailOpen(true);
		} finally {
			setLoadingDetail(false);
		}
	};

	const handleDelete = async () => {
		if (!deleteTarget) return;
		setDeleting(true);
		try {
			await apiCall(`/api/orders/${deleteTarget.id}`, { method: "DELETE" });
			setDeleteTarget(null);
			refetch();
		} finally {
			setDeleting(false);
		}
	};

	return (
		<div className="space-y-6">
			<PageHeader title="Orders" />

			<ParseOrderPanel onOrderCreated={handleOrderCreated} />

			<Table
				aria-label="Orders table"
				isStriped
				classNames={{
					wrapper: "bg-gray-900/50 border border-gray-800",
					th: "bg-gray-800/50 text-gray-300",
				}}
			>
				<TableHeader>
					<TableColumn>ID</TableColumn>
					<TableColumn>Customer</TableColumn>
					<TableColumn>Date</TableColumn>
					<TableColumn>Status</TableColumn>
					<TableColumn>Created</TableColumn>
					<TableColumn>Actions</TableColumn>
				</TableHeader>
				<TableBody
					items={orders ?? []}
					isLoading={loading || loadingDetail}
					emptyContent="No orders yet. Parse a WhatsApp message above to create one."
				>
					{(order) => (
						<TableRow key={order.id}>
							<TableCell className="font-mono">#{order.id}</TableCell>
							<TableCell className="font-medium">
								{order.debtor?.companyName ?? order.debtorName ?? "Unknown"}
							</TableCell>
							<TableCell>{order.docDate}</TableCell>
							<TableCell>
								<StatusChip status={order.status} />
							</TableCell>
							<TableCell className="text-gray-400 text-sm">
								{new Date(order.createdAt).toLocaleDateString()}
							</TableCell>
							<TableCell>
								<div className="flex gap-1">
									<Tooltip content="View / Edit">
										<Button
											isIconOnly
											size="sm"
											variant="light"
											color="primary"
											onPress={() => openDetail(order.id)}
										>
											<Eye size={16} />
										</Button>
									</Tooltip>
									{order.status === "draft" && (
										<Tooltip content="Delete" color="danger">
											<Button
												isIconOnly
												size="sm"
												variant="light"
												color="danger"
												onPress={() => setDeleteTarget(order)}
											>
												<Trash2 size={16} />
											</Button>
										</Tooltip>
									)}
								</div>
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>

			<OrderDetailModal
				isOpen={detailOpen}
				onClose={() => setDetailOpen(false)}
				order={selectedOrder}
				onUpdated={refetch}
			/>

			<ConfirmDeleteModal
				isOpen={deleteTarget !== null}
				onClose={() => setDeleteTarget(null)}
				onConfirm={handleDelete}
				loading={deleting}
				message={`Delete order #${deleteTarget?.id}? This cannot be undone.`}
			/>
		</div>
	);
}
