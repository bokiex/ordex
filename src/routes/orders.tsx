import {
	Badge,
	Button,
	Tab,
	Table,
	TableBody,
	TableCell,
	TableColumn,
	TableHeader,
	TableRow,
	Tabs,
	Tooltip,
} from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, Eye, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { OrderDetailModal } from "@/components/orders/OrderDetailModal";
import { ConfirmDeleteModal } from "@/components/shared/ConfirmDeleteModal";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusChip } from "@/components/shared/StatusChip";
import { apiCall, useApi } from "@/hooks/useApi";
import type { OrderWithItems } from "@/lib/db/types";

export const Route = createFileRoute("/orders")({ component: OrdersPage });

interface OrderListItem {
	id: number;
	debtorCode: string | null;
	debtorName: string | null;
	debtorCompanyName: string | null;
	agent: string | null;
	docDate: string;
	rawMessage: string;
	status: string;
	createdAt: string;
}

const POLL_INTERVAL = 10_000; // 10s

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
	const [seenIds, setSeenIds] = useState<Set<number>>(new Set());
	const [activeTab, setActiveTab] = useState<string>("incoming");
	const initialLoadDone = useRef(false);

	// Poll for new orders
	useEffect(() => {
		const interval = setInterval(refetch, POLL_INTERVAL);
		return () => clearInterval(interval);
	}, [refetch]);

	// Track seen IDs — mark all initial orders as seen
	useEffect(() => {
		if (!orders || orders.length === 0) return;
		if (!initialLoadDone.current) {
			setSeenIds(new Set(orders.map((o) => o.id)));
			initialLoadDone.current = true;
		}
	}, [orders]);

	const draftOrders = useMemo(
		() => (orders ?? []).filter((o) => o.status === "draft"),
		[orders],
	);
	const confirmedOrders = useMemo(
		() => (orders ?? []).filter((o) => o.status !== "draft"),
		[orders],
	);

	const newOrderCount = useMemo(
		() => draftOrders.filter((o) => !seenIds.has(o.id)).length,
		[draftOrders, seenIds],
	);

	const openDetail = async (orderId: number) => {
		setLoadingDetail(true);
		// Mark as seen
		setSeenIds((prev) => new Set([...prev, orderId]));
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

	const renderOrderTable = (
		items: OrderListItem[],
		emptyMsg: string,
		showDelete: boolean,
	) => (
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
				items={items}
				isLoading={loading || loadingDetail}
				emptyContent={emptyMsg}
			>
				{(order) => (
					<TableRow
						key={order.id}
						className={!seenIds.has(order.id) ? "bg-primary-900/20" : undefined}
					>
						<TableCell className="font-mono">
							<span className="flex items-center gap-2">
								#{order.id}
								{!seenIds.has(order.id) && (
									<Badge
										content=""
										color="primary"
										size="sm"
										shape="circle"
										placement="top-right"
									>
										<Bell size={14} className="text-primary animate-pulse" />
									</Badge>
								)}
							</span>
						</TableCell>
						<TableCell className="font-medium">
							{order.debtorCompanyName ?? order.debtorName ?? "Unknown"}
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
								{showDelete && (
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
	);

	return (
		<div className="space-y-6">
			<PageHeader title="Orders" />

			<Tabs
				selectedKey={activeTab}
				onSelectionChange={(key) => setActiveTab(String(key))}
				variant="underlined"
				classNames={{
					tabList: "border-b border-gray-800",
					tab: "text-gray-400",
				}}
			>
				<Tab
					key="incoming"
					title={
						<span className="flex items-center gap-2">
							Incoming
							{newOrderCount > 0 && (
								<span className="bg-primary text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
									{newOrderCount}
								</span>
							)}
							{newOrderCount === 0 && draftOrders.length > 0 && (
								<span className="bg-warning/20 text-warning text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
									{draftOrders.length}
								</span>
							)}
						</span>
					}
				>
					{renderOrderTable(
						draftOrders,
						"No incoming orders. New orders arrive via WhatsApp webhook.",
						true,
					)}
				</Tab>
				<Tab
					key="confirmed"
					title={
						<span className="flex items-center gap-2">
							Confirmed
							{confirmedOrders.length > 0 && (
								<span className="bg-success/20 text-success text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
									{confirmedOrders.length}
								</span>
							)}
						</span>
					}
				>
					{renderOrderTable(confirmedOrders, "No confirmed orders yet.", false)}
				</Tab>
			</Tabs>

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
