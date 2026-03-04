import { Chip } from "@heroui/react";

const statusConfig = {
	draft: { color: "warning" as const, label: "Draft" },
	confirmed: { color: "success" as const, label: "Confirmed" },
	exported: { color: "primary" as const, label: "Exported" },
};

export function StatusChip({ status }: { status: string }) {
	const config = statusConfig[status as keyof typeof statusConfig] || {
		color: "default" as const,
		label: status,
	};
	return (
		<Chip color={config.color} size="sm" variant="flat">
			{config.label}
		</Chip>
	);
}
