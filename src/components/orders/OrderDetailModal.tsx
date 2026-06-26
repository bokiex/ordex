import {
	Autocomplete,
	AutocompleteItem,
	Button,
	Chip,
	Input,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
	Table,
	TableBody,
	TableCell,
	TableColumn,
	TableHeader,
	TableRow,
	Tooltip,
} from "@heroui/react";
import {
	AlertTriangle,
	Check,
	Download,
	Plus,
	Trash2,
	UserPlus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiCall } from "@/hooks/useApi";
import type { Debtor, Item, OrderItem, OrderWithItems } from "@/lib/db/types";
import { searchCatalogueItems } from "@/lib/itemSearch";

interface OrderDetailModalProps {
	isOpen: boolean;
	onClose: () => void;
	order: OrderWithItems | null;
	onUpdated: () => void;
}

/** Filter items client-side by code or description (case-insensitive). */
function filterItems(allItems: Item[], query: string): Item[] {
	return searchCatalogueItems(allItems, query, 20);
}

/** Filter debtors client-side by name, alias, or code (case-insensitive). */
function filterDebtors(allDebtors: Debtor[], query: string): Debtor[] {
	if (!query) return allDebtors.slice(0, 20);
	const q = query.toLowerCase();
	return allDebtors
		.filter(
			(d) =>
				d.companyName.toLowerCase().includes(q) ||
				(d.alias?.toLowerCase().includes(q) ?? false) ||
				d.code.toLowerCase().includes(q),
		)
		.slice(0, 20);
}

export function OrderDetailModal({
	isOpen,
	onClose,
	order,
	onUpdated,
}: OrderDetailModalProps) {
	const [localOrder, setLocalOrder] = useState<OrderWithItems | null>(null);
	const [saving, setSaving] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const [exporting, setExporting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Preloaded reference data (loaded once when modal opens)
	const [allDebtors, setAllDebtors] = useState<Debtor[]>([]);
	const [allItems, setAllItems] = useState<Item[]>([]);

	// Customer search (client-side filtered)
	const [customerSearch, setCustomerSearch] = useState("");
	const customerResults = useMemo(
		() => filterDebtors(allDebtors, customerSearch),
		[allDebtors, customerSearch],
	);

	// Item search for new row (client-side filtered)
	const [itemSearch, setItemSearch] = useState("");
	const itemResults = useMemo(
		() => filterItems(allItems, itemSearch),
		[allItems, itemSearch],
	);

	// New customer form
	const [showNewCustomer, setShowNewCustomer] = useState(false);
	const [newCustomer, setNewCustomer] = useState({
		code: "",
		companyName: "",
		alias: "",
		phone: "",
		agent: "",
	});
	const [savingCustomer, setSavingCustomer] = useState(false);

	const noCustomerMatch = useMemo(() => {
		if (localOrder?.debtorCode) return false;
		if (!customerSearch || customerSearch.length < 2) return false;
		return customerResults.length === 0;
	}, [customerSearch, customerResults, localOrder?.debtorCode]);

	const handleCreateCustomer = async () => {
		if (!newCustomer.code || !newCustomer.companyName) return;
		setSavingCustomer(true);
		try {
			const debtor = await apiCall<Debtor>("/api/debtors", {
				method: "POST",
				body: JSON.stringify({
					code: newCustomer.code,
					companyName: newCustomer.companyName,
					alias: newCustomer.alias || null,
					phone: newCustomer.phone || null,
					agent: newCustomer.agent || null,
				}),
			});
			// Add to local list and select
			setAllDebtors((prev) => [debtor, ...prev]);
			setCustomerSearch(debtor.companyName);
			setShowNewCustomer(false);
			setNewCustomer({
				code: "",
				companyName: "",
				alias: "",
				phone: "",
				agent: "",
			});
			// Update order header
			await updateHeader({
				debtorCode: debtor.code,
				debtorName: debtor.companyName,
				agent: debtor.agent,
			});
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to create customer");
		} finally {
			setSavingCustomer(false);
		}
	};

	useEffect(() => {
		if (order) {
			setLocalOrder(order);
			setError(null);
			// Set initial customer display text
			setCustomerSearch(order.debtorName ?? "");
		}
	}, [order]);

	// Load all debtors + items once when modal opens
	useEffect(() => {
		if (!isOpen) return;
		fetch("/api/debtors")
			.then((r) => r.json())
			.then(setAllDebtors)
			.catch(() => {});
		fetch("/api/items")
			.then((r) => r.json())
			.then(setAllItems)
			.catch(() => {});
	}, [isOpen]);

	if (!localOrder) return null;

	const isDraft = localOrder.status === "draft";
	const allMatched = localOrder.items.every((i) => i.matched && i.itemCode);
	const hasDebtor = !!localOrder.debtorCode;
	const canConfirm =
		isDraft && allMatched && hasDebtor && localOrder.items.length > 0;

	const updateHeader = async (data: Record<string, unknown>) => {
		setSaving(true);
		try {
			const updated = await apiCall<OrderWithItems>(
				`/api/orders/${localOrder.id}`,
				{
					method: "PUT",
					body: JSON.stringify(data),
				},
			);
			setLocalOrder(updated);
			onUpdated();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to update");
		} finally {
			setSaving(false);
		}
	};

	const updateItem = async (itemId: number, data: Record<string, unknown>) => {
		try {
			await apiCall(`/api/order-items/${itemId}`, {
				method: "PUT",
				body: JSON.stringify(data),
			});
			// Refetch full order
			const updated = await apiCall<OrderWithItems>(
				`/api/orders/${localOrder.id}`,
				{
					method: "GET",
				},
			);
			setLocalOrder(updated);
			onUpdated();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to update item");
		}
	};

	const deleteItem = async (itemId: number) => {
		try {
			await apiCall(`/api/order-items/${itemId}`, { method: "DELETE" });
			const updated = await apiCall<OrderWithItems>(
				`/api/orders/${localOrder.id}`,
				{
					method: "GET",
				},
			);
			setLocalOrder(updated);
			onUpdated();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to delete item");
		}
	};

	const addItem = async (item: Item) => {
		try {
			await apiCall(`/api/orders/${localOrder.id}/items`, {
				method: "POST",
				body: JSON.stringify({
					itemCode: item.code,
					rawItemName: item.description,
					description: item.description,
					uom: item.baseUom,
					qty: 1,
					unitPrice: item.price,
					lineTotal: item.price,
					matched: true,
				}),
			});
			const updated = await apiCall<OrderWithItems>(
				`/api/orders/${localOrder.id}`,
				{
					method: "GET",
				},
			);
			setLocalOrder(updated);
			setItemSearch("");
			onUpdated();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to add item");
		}
	};

	const handleConfirm = async () => {
		setConfirming(true);
		setError(null);
		try {
			const updated = await apiCall<OrderWithItems>(
				`/api/orders/${localOrder.id}/confirm`,
				{ method: "POST" },
			);
			setLocalOrder(updated);
			onUpdated();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to confirm order");
		} finally {
			setConfirming(false);
		}
	};

	const handleDownloadExcel = async () => {
		if (localOrder.status === "draft") return;

		setExporting(true);
		setError(null);
		try {
			const response = await fetch(`/api/orders/${localOrder.id}/export`);
			if (!response.ok) {
				const payload = await response.json().catch(() => null);
				const message =
					payload && typeof payload.error === "string"
						? payload.error
						: "Failed to export order";
				throw new Error(message);
			}

			const blob = await response.blob();
			const disposition = response.headers.get("content-disposition");
			const fileNameMatch = disposition?.match(/filename="?([^"]+)"?/i);
			const filename = fileNameMatch?.[1] ?? `order-${localOrder.id}.xlsx`;

			const blobUrl = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = blobUrl;
			anchor.download = filename;
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(blobUrl);

			if (localOrder.status === "confirmed") {
				setLocalOrder((previous) =>
					previous ? { ...previous, status: "exported" } : previous,
				);
				onUpdated();
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to export order");
		} finally {
			setExporting(false);
		}
	};

	const total = localOrder.items.reduce(
		(sum, i) => sum + (i.lineTotal ?? i.qty * (i.unitPrice ?? 0)),
		0,
	);

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside">
			<ModalContent>
				<ModalHeader className="flex justify-between items-center">
					<div className="flex items-center gap-3">
						<span>Order #{localOrder.id}</span>
						<Chip
							color={
								localOrder.status === "draft"
									? "warning"
									: localOrder.status === "confirmed"
										? "success"
										: "primary"
							}
							size="sm"
							variant="flat"
						>
							{localOrder.status}
						</Chip>
					</div>
				</ModalHeader>

				<ModalBody>
					{error && <p className="text-danger text-sm mb-2">{error}</p>}

					{/* Order header fields */}
					<div className="grid grid-cols-3 gap-4 mb-6">
						<div className="col-span-2">
							<Autocomplete
								label="Customer"
								placeholder="Search customers..."
								inputValue={customerSearch}
								onInputChange={setCustomerSearch}
								selectedKey={localOrder.debtorCode}
								onSelectionChange={(key) => {
									if (key) {
										const debtor = allDebtors.find((d) => d.code === key);
										if (debtor) {
											setCustomerSearch(debtor.companyName);
										}
										updateHeader({
											debtorCode: key,
											debtorName: debtor?.companyName ?? localOrder.debtorName,
											agent: debtor?.agent ?? localOrder.agent,
										});
									}
								}}
								isDisabled={!isDraft}
							>
								{customerResults.map((d) => (
									<AutocompleteItem key={d.code} textValue={d.companyName}>
										<div className="flex flex-col">
											<span className="font-medium">{d.companyName}</span>
											<span className="text-sm text-gray-400">{d.code}</span>
										</div>
									</AutocompleteItem>
								))}
							</Autocomplete>
						</div>
						<Input
							type="date"
							label="Date"
							value={localOrder.docDate}
							onValueChange={(val) => updateHeader({ docDate: val })}
							isDisabled={!isDraft}
						/>
					</div>

					{/* New customer prompt + form */}
					{isDraft && noCustomerMatch && !showNewCustomer && (
						<div className="flex items-center gap-3 mb-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
							<AlertTriangle size={18} className="text-warning shrink-0" />
							<span className="text-sm text-warning">
								No matching customer found.
							</span>
							<Button
								size="sm"
								color="warning"
								variant="flat"
								startContent={<UserPlus size={16} />}
								onPress={() => {
									setShowNewCustomer(true);
									setNewCustomer((prev) => ({
										...prev,
										companyName: customerSearch,
									}));
								}}
							>
								Add New Customer
							</Button>
						</div>
					)}

					{showNewCustomer && (
						<div className="mb-4 p-4 bg-gray-800/50 border border-gray-700 rounded-lg space-y-3">
							<h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
								<UserPlus size={16} />
								New Customer
							</h4>
							<div className="grid grid-cols-2 gap-3">
								<Input
									label="Customer Code"
									placeholder="e.g. 3000-X001"
									value={newCustomer.code}
									onValueChange={(v) =>
										setNewCustomer((prev) => ({ ...prev, code: v }))
									}
									isRequired
									size="sm"
								/>
								<Input
									label="Company Name"
									placeholder="Company name"
									value={newCustomer.companyName}
									onValueChange={(v) =>
										setNewCustomer((prev) => ({
											...prev,
											companyName: v,
										}))
									}
									isRequired
									size="sm"
								/>
								<Input
									label="Alias"
									placeholder="Short name / location"
									value={newCustomer.alias}
									onValueChange={(v) =>
										setNewCustomer((prev) => ({ ...prev, alias: v }))
									}
									size="sm"
								/>
								<Input
									label="Phone"
									placeholder="Phone number"
									value={newCustomer.phone}
									onValueChange={(v) =>
										setNewCustomer((prev) => ({ ...prev, phone: v }))
									}
									size="sm"
								/>
								<Input
									label="Agent"
									placeholder="Agent code"
									value={newCustomer.agent}
									onValueChange={(v) =>
										setNewCustomer((prev) => ({ ...prev, agent: v }))
									}
									size="sm"
								/>
							</div>
							<div className="flex gap-2 justify-end">
								<Button
									size="sm"
									variant="light"
									onPress={() => setShowNewCustomer(false)}
								>
									Cancel
								</Button>
								<Button
									size="sm"
									color="primary"
									onPress={handleCreateCustomer}
									isLoading={savingCustomer}
									isDisabled={!newCustomer.code || !newCustomer.companyName}
									startContent={<Check size={16} />}
								>
									Create & Assign
								</Button>
							</div>
						</div>
					)}

					{/* Raw message preview */}
					{localOrder.rawMessage && (
						<details className="mb-4">
							<summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-300">
								Original WhatsApp message
							</summary>
							<pre className="mt-2 p-3 bg-gray-800/50 rounded-lg text-sm text-gray-300 whitespace-pre-wrap">
								{localOrder.rawMessage}
							</pre>
						</details>
					)}

					{/* Order items table */}
					<Table
						aria-label="Order items"
						classNames={{
							wrapper: "bg-gray-900/50 border border-gray-800",
							th: "bg-gray-800/50 text-gray-300",
						}}
					>
						<TableHeader>
							<TableColumn width={40}>#</TableColumn>
							<TableColumn>Item</TableColumn>
							<TableColumn>Description</TableColumn>
							<TableColumn>UOM</TableColumn>
							<TableColumn width={100}>Qty</TableColumn>
							<TableColumn width={120}>Unit Price</TableColumn>
							<TableColumn width={100}>Total</TableColumn>
							<TableColumn width={80}>Actions</TableColumn>
						</TableHeader>
						<TableBody items={localOrder.items}>
							{(orderItem) => (
								<TableRow key={orderItem.id}>
									<TableCell>
										{orderItem.matched ? (
											<Check size={16} className="text-success" />
										) : (
											<Tooltip content="Item not matched — select from catalogue">
												<AlertTriangle size={16} className="text-warning" />
											</Tooltip>
										)}
									</TableCell>
									<TableCell>
										{isDraft ? (
											<ItemSearchCell
												orderItem={orderItem}
												allItems={allItems}
												onSelect={(item) =>
													updateItem(orderItem.id, {
														itemCode: item.code,
														description: item.description,
														uom: item.baseUom,
														unitPrice: item.price,
														lineTotal:
															item.price == null
																? null
																: item.price * orderItem.qty,
														matched: true,
													})
												}
											/>
										) : (
											<span className="font-mono text-sm">
												{orderItem.itemCode ?? "—"}
											</span>
										)}
									</TableCell>
									<TableCell className="max-w-[200px] truncate text-sm text-gray-400">
										{orderItem.description ?? orderItem.rawItemName}
									</TableCell>
									<TableCell>{orderItem.uom ?? "—"}</TableCell>
									<TableCell>
										{isDraft ? (
											<Input
												type="number"
												size="sm"
												value={String(orderItem.qty)}
												onValueChange={(v) =>
													updateItem(orderItem.id, { qty: Number(v) || 0 })
												}
												className="w-20"
											/>
										) : (
											orderItem.qty
										)}
									</TableCell>
									<TableCell>
										{isDraft ? (
											<Input
												type="number"
												size="sm"
												value={String(orderItem.unitPrice ?? "")}
												onValueChange={(v) =>
													updateItem(orderItem.id, {
														unitPrice: Number(v) || 0,
														lineTotal: (Number(v) || 0) * orderItem.qty,
													})
												}
												className="w-24"
												startContent={
													<span className="text-gray-400 text-xs">$</span>
												}
											/>
										) : (
											`$${(orderItem.unitPrice ?? 0).toFixed(2)}`
										)}
									</TableCell>
									<TableCell className="text-right font-medium">
										$
										{(
											orderItem.lineTotal ??
											orderItem.qty * (orderItem.unitPrice ?? 0)
										).toFixed(2)}
									</TableCell>
									<TableCell>
										{isDraft && (
											<Tooltip content="Remove" color="danger">
												<Button
													isIconOnly
													size="sm"
													variant="light"
													color="danger"
													onPress={() => deleteItem(orderItem.id)}
												>
													<Trash2 size={14} />
												</Button>
											</Tooltip>
										)}
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>

					{/* Add item row */}
					{isDraft && (
						<div className="mt-3">
							<Autocomplete
								label="Add item..."
								placeholder="Search item catalogue..."
								inputValue={itemSearch}
								onInputChange={setItemSearch}
								onSelectionChange={(key) => {
									const item = allItems.find((i) => i.code === key);
									if (item) addItem(item);
								}}
								size="sm"
								startContent={<Plus size={16} className="text-gray-400" />}
							>
								{itemResults.map((item) => (
									<AutocompleteItem
										key={item.code}
										textValue={`${item.code} — ${item.description}`}
									>
										<div className="flex flex-col">
											<span className="font-medium">{item.description}</span>
											<span className="text-sm text-gray-400">
												{item.code} — {item.baseUom}
											</span>
										</div>
									</AutocompleteItem>
								))}
							</Autocomplete>
						</div>
					)}

					{/* Total */}
					<div className="flex justify-end mt-4 text-lg">
						<span className="text-gray-400 mr-3">Order Total:</span>
						<span className="font-bold text-cyan-400">${total.toFixed(2)}</span>
					</div>
				</ModalBody>

				<ModalFooter>
					{!canConfirm && isDraft && (
						<div className="flex-1 text-sm text-warning flex items-center gap-2">
							<AlertTriangle size={16} />
							{!hasDebtor
								? "Assign a customer before confirming"
								: !allMatched
									? "Match all items before confirming"
									: "Add at least one item"}
						</div>
					)}
					<Button variant="light" onPress={onClose}>
						Close
					</Button>
					{!isDraft && (
						<Button
							color="primary"
							variant="flat"
							onPress={handleDownloadExcel}
							isLoading={exporting}
							startContent={<Download size={18} />}
						>
							Download Excel
						</Button>
					)}
					{isDraft && (
						<Button
							color="success"
							onPress={handleConfirm}
							isLoading={confirming}
							isDisabled={!canConfirm || saving}
							startContent={<Check size={18} />}
						>
							Confirm Order
						</Button>
					)}
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

// Inline item search component for table cells
function ItemSearchCell({
	orderItem,
	allItems,
	onSelect,
}: {
	orderItem: OrderItem & { item: Item | null };
	allItems: Item[];
	onSelect: (item: Item) => void;
}) {
	const [search, setSearch] = useState(orderItem.itemCode ?? "");
	const results = useMemo(
		() => filterItems(allItems, search),
		[allItems, search],
	);

	if (orderItem.matched && orderItem.itemCode) {
		return (
			<Autocomplete
				size="sm"
				inputValue={search}
				onInputChange={setSearch}
				selectedKey={search === orderItem.itemCode ? orderItem.itemCode : null}
				onSelectionChange={(key) => {
					const item = allItems.find((i) => i.code === key);
					if (item) {
						setSearch(item.code);
						onSelect(item);
					}
				}}
				className="w-40"
			>
				{results.map((item) => (
					<AutocompleteItem
						key={item.code}
						textValue={`${item.code} ${item.description}`}
					>
						<div className="flex flex-col">
							<span className="text-sm">{item.description}</span>
							<span className="text-xs text-gray-400">{item.code}</span>
						</div>
					</AutocompleteItem>
				))}
			</Autocomplete>
		);
	}

	return (
		<Autocomplete
			size="sm"
			inputValue={search}
			onInputChange={setSearch}
			onSelectionChange={(key) => {
				const item = allItems.find((i) => i.code === key);
				if (item) {
					setSearch(item.code);
					onSelect(item);
				}
			}}
			placeholder={orderItem.rawItemName ?? "Search..."}
			className="w-40"
			color="warning"
		>
			{results.map((item) => (
				<AutocompleteItem
					key={item.code}
					textValue={`${item.code} ${item.description}`}
				>
					<div className="flex flex-col">
						<span className="text-sm">{item.description}</span>
						<span className="text-xs text-gray-400">{item.code}</span>
					</div>
				</AutocompleteItem>
			))}
		</Autocomplete>
	);
}
