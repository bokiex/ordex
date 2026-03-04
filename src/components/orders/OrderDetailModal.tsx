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
import { AlertTriangle, Check, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { apiCall } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import type { Debtor, Item, OrderItem, OrderWithItems } from "@/lib/db/types";

interface OrderDetailModalProps {
	isOpen: boolean;
	onClose: () => void;
	order: OrderWithItems | null;
	onUpdated: () => void;
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
	const [error, setError] = useState<string | null>(null);

	// Customer search
	const [customerSearch, setCustomerSearch] = useState("");
	const debouncedCustomerSearch = useDebounce(customerSearch, 300);
	const [customerResults, setCustomerResults] = useState<Debtor[]>([]);

	// Item search for new row
	const [itemSearch, setItemSearch] = useState("");
	const debouncedItemSearch = useDebounce(itemSearch, 300);
	const [itemResults, setItemResults] = useState<Item[]>([]);

	useEffect(() => {
		if (order) {
			setLocalOrder(order);
			setError(null);
		}
	}, [order]);

	// Fetch customer search results
	useEffect(() => {
		if (!debouncedCustomerSearch) {
			setCustomerResults([]);
			return;
		}
		fetch(`/api/debtors?search=${encodeURIComponent(debouncedCustomerSearch)}`)
			.then((r) => r.json())
			.then(setCustomerResults)
			.catch(() => {});
	}, [debouncedCustomerSearch]);

	// Fetch item search results
	useEffect(() => {
		if (!debouncedItemSearch) {
			setItemResults([]);
			return;
		}
		fetch(`/api/items?search=${encodeURIComponent(debouncedItemSearch)}`)
			.then((r) => r.json())
			.then(setItemResults)
			.catch(() => {});
	}, [debouncedItemSearch]);

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
										const debtor = customerResults.find((d) => d.code === key);
										updateHeader({
											debtorCode: key,
											debtorName: debtor?.companyName ?? localOrder.debtorName,
											agent: debtor?.agent ?? localOrder.agent,
										});
									}
								}}
								isDisabled={!isDraft}
								defaultInputValue={
									localOrder.debtorName
										? `${localOrder.debtorCode ?? ""} — ${localOrder.debtorName}`
										: ""
								}
							>
								{customerResults.map((d) => (
									<AutocompleteItem
										key={d.code}
										textValue={`${d.code} — ${d.companyName}`}
									>
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
												onSelect={(item) =>
													updateItem(orderItem.id, {
														itemCode: item.code,
														description: item.description,
														uom: item.baseUom,
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
									const item = itemResults.find((i) => i.code === key);
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
	onSelect,
}: {
	orderItem: OrderItem & { item: Item | null };
	onSelect: (item: Item) => void;
}) {
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebounce(search, 300);
	const [results, setResults] = useState<Item[]>([]);

	useEffect(() => {
		if (!debouncedSearch) {
			setResults([]);
			return;
		}
		fetch(`/api/items?search=${encodeURIComponent(debouncedSearch)}`)
			.then((r) => r.json())
			.then(setResults)
			.catch(() => {});
	}, [debouncedSearch]);

	if (orderItem.matched && orderItem.itemCode) {
		return (
			<Autocomplete
				size="sm"
				inputValue={search}
				onInputChange={setSearch}
				selectedKey={orderItem.itemCode}
				onSelectionChange={(key) => {
					const item = results.find((i) => i.code === key);
					if (item) onSelect(item);
				}}
				defaultInputValue={orderItem.itemCode}
				className="w-40"
			>
				{results.map((item) => (
					<AutocompleteItem key={item.code} textValue={item.code}>
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
				const item = results.find((i) => i.code === key);
				if (item) onSelect(item);
			}}
			placeholder={orderItem.rawItemName ?? "Search..."}
			className="w-40"
			color="warning"
		>
			{results.map((item) => (
				<AutocompleteItem key={item.code} textValue={item.code}>
					<div className="flex flex-col">
						<span className="text-sm">{item.description}</span>
						<span className="text-xs text-gray-400">{item.code}</span>
					</div>
				</AutocompleteItem>
			))}
		</Autocomplete>
	);
}
