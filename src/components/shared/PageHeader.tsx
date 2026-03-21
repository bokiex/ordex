import { Divider } from "@heroui/react";
import type { ReactNode } from "react";

interface PageHeaderProps {
	title: string;
	action?: ReactNode;
}

export function PageHeader({ title, action }: PageHeaderProps) {
	return (
		<>
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold text-white">{title}</h1>
				{action}
			</div>
			<Divider className="my-4" />
		</>
	);
}
