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
import type { Debtor } from "@/lib/db/types";

interface DebtorModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSave: (data: Partial<Debtor>) => Promise<void>;
	debtor: Debtor | null; // null = create mode
}

const emptyForm = {
	code: "",
	companyName: "",
	alias: "",
	phone: "",
	agent: "",
	currencyCode: "SGD",
	isActive: true,
	multiPricing: "",
};

export function DebtorModal({
	isOpen,
	onClose,
	onSave,
	debtor,
}: DebtorModalProps) {
	const [form, setForm] = useState(emptyForm);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const isEdit = debtor !== null;

	useEffect(() => {
		if (debtor) {
			setForm({
				code: debtor.code,
				companyName: debtor.companyName,
				alias: debtor.alias ?? "",
				phone: debtor.phone ?? "",
				agent: debtor.agent ?? "",
				currencyCode: debtor.currencyCode ?? "SGD",
				isActive: debtor.isActive ?? true,
				multiPricing: debtor.multiPricing ?? "",
			});
		} else {
			setForm(emptyForm);
		}
		setError(null);
	}, [debtor]);

	const handleSave = async () => {
		if (!form.code || !form.companyName) {
			setError("Code and Company Name are required");
			return;
		}
		setSaving(true);
		setError(null);
		try {
			await onSave({
				...form,
				alias: form.alias || null,
				phone: form.phone || null,
				agent: form.agent || null,
				multiPricing: form.multiPricing || null,
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
				<ModalHeader>{isEdit ? "Edit Customer" : "Add Customer"}</ModalHeader>
				<ModalBody>
					{error && <p className="text-danger text-sm mb-2">{error}</p>}
					<div className="grid grid-cols-2 gap-4">
						<Input
							label="Code"
							value={form.code}
							onValueChange={set("code")}
							isDisabled={isEdit}
							isRequired
						/>
						<Input
							label="Company Name"
							value={form.companyName}
							onValueChange={set("companyName")}
							isRequired
						/>
						<Input
							label="Alias"
							value={form.alias}
							onValueChange={set("alias")}
						/>
						<Input
							label="Phone"
							value={form.phone}
							onValueChange={set("phone")}
						/>
						<Input
							label="Agent"
							value={form.agent}
							onValueChange={set("agent")}
						/>
						<Input
							label="Currency"
							value={form.currencyCode}
							onValueChange={set("currencyCode")}
						/>
						<Input
							label="Multi Pricing"
							value={form.multiPricing}
							onValueChange={set("multiPricing")}
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
