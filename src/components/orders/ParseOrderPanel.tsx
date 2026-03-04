import { Button, Card, CardBody, Input, Textarea } from "@heroui/react";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { apiCall } from "@/hooks/useApi";
import type { OrderWithItems } from "@/lib/db/types";

interface ParseOrderPanelProps {
	onOrderCreated: (order: OrderWithItems) => void;
}

export function ParseOrderPanel({ onOrderCreated }: ParseOrderPanelProps) {
	const [message, setMessage] = useState("");
	const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleParse = async () => {
		if (!message.trim()) return;
		setLoading(true);
		setError(null);
		try {
			const order = await apiCall<OrderWithItems>("/api/orders", {
				method: "POST",
				body: JSON.stringify({ message: message.trim(), date }),
			});
			onOrderCreated(order);
			setMessage("");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to parse order");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Card className="bg-gray-900/50 border border-gray-800">
			<CardBody className="gap-4">
				<h3 className="text-lg font-semibold text-white">
					Parse WhatsApp Order
				</h3>
				<Textarea
					label="WhatsApp Message"
					placeholder="Paste a WhatsApp order message here..."
					value={message}
					onValueChange={setMessage}
					minRows={4}
					maxRows={8}
				/>
				<div className="flex gap-3 items-end">
					<Input
						type="date"
						label="Order Date"
						value={date}
						onValueChange={setDate}
						className="max-w-[200px]"
					/>
					<Button
						color="primary"
						startContent={<Sparkles size={18} />}
						onPress={handleParse}
						isLoading={loading}
						isDisabled={!message.trim()}
					>
						Parse Order
					</Button>
				</div>
				{error && <p className="text-danger text-sm">{error}</p>}
			</CardBody>
		</Card>
	);
}
