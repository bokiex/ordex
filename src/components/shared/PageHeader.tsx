import type { ReactNode } from "react";

interface PageHeaderProps {
	title: string;
	action?: ReactNode;
}

export function PageHeader({ title, action }: PageHeaderProps) {
	return (
		<div className="flex items-center justify-between mb-6">
			<h1 className="text-2xl font-bold text-white">{title}</h1>
			{action}
		</div>
	);
}
