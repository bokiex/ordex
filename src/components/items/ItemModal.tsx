import {
	Button,
	Input,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
	Switch,
} from "@heroui/react";
import { useEffect, useState } from "react";
import type { Item } from "@/lib/db/types";

interface ItemModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSave: (data: Partial<Item>) => Promise<void>;
	item: Item | null;
}

const emptyForm = {
	code: "",
	description: "",
	baseUom: "PKT",
	uomCount: 1,
	itemGroup: "",
	isActive: true,
	stockBalance: 0,
};

export function ItemModal({ isOpen, onClose, onSave, item }: ItemModalProps) {
	const [form, setForm] = useState(emptyForm);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const isEdit = item !== null;

	useEffect(() => {
		if (item) {
			setForm({
				code: item.code,
				description: item.description,
				baseUom: item.baseUom,
				uomCount: item.uomCount ?? 1,
				itemGroup: item.itemGroup ?? "",
				isActive: item.isActive ?? true,
				stockBalance: item.stockBalance ?? 0,
			});
		} else {
			setForm(emptyForm);
		}
		setError(null);
	}, [item]);

	const handleSave = async () => {
		if (!form.code || !form.description || !form.baseUom) {
			setError("Code, Description, and Base UOM are required");
			return;
		}
		setSaving(true);
		setError(null);
		try {
			await onSave({
				...form,
				itemGroup: form.itemGroup || null,
			});
			onClose();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to save");
		} finally {
			setSaving(false);
		}
	};

	const set = (key: string) => (value: string) =>
		setForm((prev) => ({ ...prev, [key]: value }));

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="2xl">
			<ModalContent>
				<ModalHeader>{isEdit ? "Edit Item" : "Add Item"}</ModalHeader>
				<ModalBody>
					{error && <p className="text-danger text-sm mb-2">{error}</p>}
					<div className="grid grid-cols-2 gap-4">
						<Input
							label="Item Code"
							value={form.code}
							onValueChange={set("code")}
							isDisabled={isEdit}
							isRequired
						/>
						<Input
							label="Description"
							value={form.description}
							onValueChange={set("description")}
							isRequired
							className="col-span-2"
						/>
						<Input
							label="Base UOM"
							value={form.baseUom}
							onValueChange={set("baseUom")}
							isRequired
						/>
						<Input
							label="UOM Count"
							type="number"
							value={String(form.uomCount)}
							onValueChange={(v) =>
								setForm((p) => ({ ...p, uomCount: Number(v) || 1 }))
							}
						/>
						<Input
							label="Item Group"
							value={form.itemGroup}
							onValueChange={set("itemGroup")}
						/>
						<Input
							label="Stock Balance"
							type="number"
							value={String(form.stockBalance)}
							onValueChange={(v) =>
								setForm((p) => ({ ...p, stockBalance: Number(v) || 0 }))
							}
						/>
						<div className="flex items-center gap-2">
							<Switch
								isSelected={form.isActive}
								onValueChange={(val) =>
									setForm((p) => ({ ...p, isActive: val }))
								}
							/>
							<span className="text-sm text-gray-400">Active</span>
						</div>
					</div>
				</ModalBody>
				<ModalFooter>
					<Button variant="light" onPress={onClose}>
						Cancel
					</Button>
					<Button color="primary" onPress={handleSave} isLoading={saving}>
						{isEdit ? "Update" : "Create"}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}
