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
import { Bell, Eye, Inbox, Sparkles, Trash2 } from "lucide-react";
import { type Key, useEffect, useMemo, useRef, useState } from "react";
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

interface IncomingMessageListItem {
	id: number;
	from: string;
	senderName: string;
	customerNameHint: string | null;
	whatsappMessageId: string;
	timestamp: string;
	body: string;
	status: string;
	sourceOrderId: number | null;
	createdAt: string;
}

interface IncomingMessageGroup {
	customerName: string;
	messages: IncomingMessageListItem[];
}

const POLL_INTERVAL = 10_000; // 10s

function OrdersPage() {
	const {
		data: orders,
		loading,
		refetch: refetchOrders,
	} = useApi<OrderListItem[]>("/api/orders");
	const {
		data: incomingMessages,
		loading: loadingMessages,
		error: incomingMessagesError,
		refetch: refetchIncomingMessages,
	} = useApi<IncomingMessageListItem[]>("/api/incoming-messages?status=new");
	const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(
		null,
	);
	const [detailOpen, setDetailOpen] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<OrderListItem | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [orderActionError, setOrderActionError] = useState<string | null>(null);
	const [loadingDetail, setLoadingDetail] = useState(false);
	const [seenIds, setSeenIds] = useState<Set<number>>(new Set());
	const [activeTab, setActiveTab] = useState<string>("incoming");
	const [selectedMessageKeys, setSelectedMessageKeys] = useState<Set<string>>(
		new Set(),
	);
	const [generatingOrder, setGeneratingOrder] = useState(false);
	const [deletingMessages, setDeletingMessages] = useState(false);
	const [deleteMessagesOpen, setDeleteMessagesOpen] = useState(false);
	const [messageActionError, setMessageActionError] = useState<string | null>(
		null,
	);
	const initialLoadDone = useRef(false);

	// Poll for new orders
	useEffect(() => {
		const interval = setInterval(() => {
			refetchOrders();
			refetchIncomingMessages();
		}, POLL_INTERVAL);
		return () => clearInterval(interval);
	}, [refetchOrders, refetchIncomingMessages]);

	useEffect(() => {
		const events = new EventSource("/api/events/incoming-messages");

		const handleIncomingMessage = () => {
			refetchIncomingMessages();
		};
		const handleIncomingMessagesChanged = () => {
			refetchIncomingMessages();
		};
		const handleOrdersChanged = () => {
			refetchOrders();
		};

		events.addEventListener("incoming-message", handleIncomingMessage);
		events.addEventListener(
			"incoming-messages-changed",
			handleIncomingMessagesChanged,
		);
		events.addEventListener("orders-changed", handleOrdersChanged);

		return () => {
			events.removeEventListener("incoming-message", handleIncomingMessage);
			events.removeEventListener(
				"incoming-messages-changed",
				handleIncomingMessagesChanged,
			);
			events.removeEventListener("orders-changed", handleOrdersChanged);
			events.close();
		};
	}, [refetchIncomingMessages, refetchOrders]);

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

	const incomingMessageCount = incomingMessages?.length ?? 0;
	const selectedMessages = useMemo(() => {
		return (incomingMessages ?? []).filter((message) =>
			selectedMessageKeys.has(String(message.id)),
		);
	}, [incomingMessages, selectedMessageKeys]);
	const selectedCustomerCount = new Set(
		selectedMessages.map(
			(message) => message.customerNameHint || message.senderName,
		),
	).size;
	const groupedIncomingMessages = useMemo(() => {
		const groups = new Map<string, IncomingMessageGroup>();

		for (const message of incomingMessages ?? []) {
			const customerName = message.customerNameHint || message.senderName;
			const group = groups.get(customerName);
			if (group) {
				group.messages.push(message);
			} else {
				groups.set(customerName, {
					customerName,
					messages: [message],
				});
			}
		}

		return Array.from(groups.values());
	}, [incomingMessages]);

	useEffect(() => {
		const availableIds = new Set(
			(incomingMessages ?? []).map((message) => String(message.id)),
		);
		setSelectedMessageKeys(
			(previous) => new Set([...previous].filter((id) => availableIds.has(id))),
		);
	}, [incomingMessages]);

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
		setOrderActionError(null);
		try {
			await apiCall(`/api/orders/${deleteTarget.id}`, { method: "DELETE" });
			setDeleteTarget(null);
			refetchOrders();
			refetchIncomingMessages();
		} catch (error) {
			setOrderActionError(
				error instanceof Error ? error.message : "Failed to delete order",
			);
		} finally {
			setDeleting(false);
		}
	};

	const handleGenerateOrder = async () => {
		const messageIds = Array.from(selectedMessageKeys).map((key) =>
			Number(key),
		);
		if (messageIds.length === 0) return;

		setGeneratingOrder(true);
		setMessageActionError(null);
		try {
			const order = await apiCall<OrderWithItems>("/api/incoming-messages", {
				method: "POST",
				body: JSON.stringify({ messageIds }),
			});
			setSelectedMessageKeys(new Set());
			setSelectedOrder(order);
			setDetailOpen(true);
			refetchIncomingMessages();
			refetchOrders();
		} catch (error) {
			setMessageActionError(
				error instanceof Error ? error.message : "Failed to generate order",
			);
		} finally {
			setGeneratingOrder(false);
		}
	};

	const handleDeleteMessages = async () => {
		const messageIds = Array.from(selectedMessageKeys).map((key) =>
			Number(key),
		);
		if (messageIds.length === 0) return;

		setDeletingMessages(true);
		setMessageActionError(null);
		try {
			await apiCall("/api/incoming-messages", {
				method: "DELETE",
				body: JSON.stringify({ messageIds }),
			});
			setSelectedMessageKeys(new Set());
			setDeleteMessagesOpen(false);
			refetchIncomingMessages();
		} catch (error) {
			setMessageActionError(
				error instanceof Error ? error.message : "Failed to delete messages",
			);
		} finally {
			setDeletingMessages(false);
		}
	};

	const formatMessageTimestamp = (message: IncomingMessageListItem) => {
		const unixTimestamp = Number(message.timestamp);
		const date = Number.isFinite(unixTimestamp)
			? new Date(unixTimestamp * 1000)
			: new Date(message.createdAt);

		return date.toLocaleString();
	};

	const handleMessageSelectionChange = (
		keys: "all" | Set<Key>,
		groupMessages: IncomingMessageListItem[],
	) => {
		const groupIds = new Set(
			groupMessages.map((message) => String(message.id)),
		);
		if (keys === "all") {
			setSelectedMessageKeys((prev) => {
				const next = new Set(prev);
				for (const id of groupIds) {
					next.add(id);
				}
				return next;
			});
			return;
		}

		setSelectedMessageKeys((prev) => {
			const next = new Set(prev);
			for (const id of groupIds) {
				next.delete(id);
			}
			for (const key of keys) {
				next.add(String(key));
			}
			return next;
		});
	};

	const getGroupSelectedKeys = (messages: IncomingMessageListItem[]) => {
		return new Set(
			messages
				.filter((message) => selectedMessageKeys.has(String(message.id)))
				.map((message) => String(message.id)),
		);
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

	const renderIncomingMessagesTable = () => (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-2 text-sm text-gray-400">
					<Inbox size={16} />
					<span>
						{selectedMessageKeys.size} of {incomingMessageCount} selected
					</span>
					{selectedCustomerCount > 1 && (
						<span className="text-danger">
							Choose messages from one WhatsApp group only.
						</span>
					)}
				</div>
				<div className="flex gap-2">
					<Button
						color="danger"
						variant="flat"
						startContent={<Trash2 size={16} />}
						isDisabled={
							selectedMessageKeys.size === 0 ||
							generatingOrder ||
							deletingMessages
						}
						onPress={() => setDeleteMessagesOpen(true)}
					>
						Delete
					</Button>
					<Button
						color="primary"
						startContent={<Sparkles size={16} />}
						isLoading={generatingOrder}
						isDisabled={
							selectedMessageKeys.size === 0 ||
							selectedCustomerCount > 1 ||
							generatingOrder ||
							deletingMessages
						}
						onPress={handleGenerateOrder}
					>
						Generate order
					</Button>
				</div>
			</div>

			{(incomingMessagesError || messageActionError) && (
				<p className="text-sm text-danger">
					{incomingMessagesError ?? messageActionError}
				</p>
			)}

			{groupedIncomingMessages.length === 0 && !loadingMessages ? (
				<div className="rounded-lg border border-gray-800 bg-gray-900/50 p-8 text-center text-sm text-gray-400">
					No incoming messages. WhatsApp messages appear here before order
					generation.
				</div>
			) : (
				<div className="space-y-5">
					{groupedIncomingMessages.map((group) => {
						const groupSelectedKeys = getGroupSelectedKeys(group.messages);

						return (
							<section
								key={group.customerName}
								className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900/30"
							>
								<div className="flex flex-col gap-1 border-gray-800 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
									<div>
										<h3 className="font-semibold text-white">
											{group.customerName}
										</h3>
									</div>
									<p className="text-gray-400 text-sm">
										{groupSelectedKeys.size} of {group.messages.length} selected
									</p>
								</div>
								<Table
									removeWrapper
									aria-label={`Incoming WhatsApp messages from ${group.customerName}`}
									isStriped
									selectionMode="multiple"
									selectedKeys={groupSelectedKeys}
									onSelectionChange={(keys) =>
										handleMessageSelectionChange(keys, group.messages)
									}
									classNames={{
										th: "bg-gray-800/50 text-gray-300",
									}}
								>
									<TableHeader>
										<TableColumn>Received</TableColumn>
										<TableColumn>Sender</TableColumn>
										<TableColumn>Message</TableColumn>
									</TableHeader>
									<TableBody
										items={group.messages}
										isLoading={loadingMessages || generatingOrder}
									>
										{(message) => (
											<TableRow key={String(message.id)}>
												<TableCell className="text-gray-400 text-sm">
													{formatMessageTimestamp(message)}
												</TableCell>
												<TableCell className="text-gray-400 text-sm">
													{message.senderName}
												</TableCell>
												<TableCell className="max-w-[42rem]">
													<p className="line-clamp-3 whitespace-pre-wrap text-sm">
														{message.body}
													</p>
												</TableCell>
											</TableRow>
										)}
									</TableBody>
								</Table>
							</section>
						);
					})}
				</div>
			)}
		</div>
	);

	return (
		<div className="space-y-6">
			<PageHeader title="Orders" />
			{orderActionError && (
				<p className="text-sm text-danger">{orderActionError}</p>
			)}

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
							Orders
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
						"No draft orders. Select incoming messages to generate an order.",
						true,
					)}
				</Tab>
				<Tab
					key="messages"
					title={
						<span className="flex items-center gap-2">
							Incoming Messages
							{incomingMessageCount > 0 && (
								<span className="bg-primary text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
									{incomingMessageCount}
								</span>
							)}
						</span>
					}
				>
					{renderIncomingMessagesTable()}
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
				onUpdated={refetchOrders}
			/>

			<ConfirmDeleteModal
				isOpen={deleteTarget !== null}
				onClose={() => setDeleteTarget(null)}
				onConfirm={handleDelete}
				loading={deleting}
				message={`Delete order #${deleteTarget?.id}? This cannot be undone.`}
			/>
			<ConfirmDeleteModal
				isOpen={deleteMessagesOpen}
				onClose={() => setDeleteMessagesOpen(false)}
				onConfirm={handleDeleteMessages}
				loading={deletingMessages}
				title="Delete Incoming Messages"
				message={`Delete ${selectedMessageKeys.size} selected incoming message${selectedMessageKeys.size === 1 ? "" : "s"}? This cannot be undone.`}
			/>
		</div>
	);
}
