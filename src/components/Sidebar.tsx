import { Link } from "@tanstack/react-router";
import { ClipboardList, FileText, Package, Users, X } from "lucide-react";

const navItems = [
	{ to: "/orders" as const, label: "Orders", icon: ClipboardList },
	{ to: "/customers" as const, label: "Customers", icon: Users },
	{ to: "/items" as const, label: "Item Codes", icon: Package },
	{ to: "/invoices" as const, label: "Invoices", icon: FileText },
];

interface SidebarProps {
	isOpen: boolean;
	onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
	return (
		<>
			{/* Mobile overlay backdrop */}
			{isOpen && (
				<button
					type="button"
					className="fixed inset-0 bg-black/60 z-40 md:hidden w-full h-full border-none cursor-default"
					onClick={onClose}
					aria-label="Close sidebar"
				/>
			)}

			{/* Sidebar */}
			<aside
				className={`fixed top-0 left-0 h-full w-64 bg-gray-900 text-white z-50 flex flex-col border-r border-gray-800 transition-transform duration-300 ease-in-out md:translate-x-0 ${
					isOpen ? "translate-x-0" : "-translate-x-full"
				}`}
			>
				{/* Brand header */}
				<div className="flex items-center justify-between p-5 border-b border-gray-800">
					<h1 className="text-2xl font-bold tracking-tight">
						<span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
							Ordex
						</span>
					</h1>
					<button
						type="button"
						onClick={onClose}
						className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors md:hidden"
						aria-label="Close sidebar"
					>
						<X size={20} />
					</button>
				</div>

				{/* Navigation */}
				<nav className="flex-1 p-3 overflow-y-auto">
					<ul className="space-y-1">
						{navItems.map((item) => (
							<li key={item.to}>
								<Link
									to={item.to}
									onClick={onClose}
									className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
									activeProps={{
										className:
											"flex items-center gap-3 px-3 py-2.5 rounded-lg bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/20 transition-colors",
									}}
								>
									<item.icon size={20} />
									<span className="font-medium">{item.label}</span>
								</Link>
							</li>
						))}
					</ul>
				</nav>

				{/* Footer */}
				<div className="p-4 border-t border-gray-800">
					<p className="text-xs text-gray-500">Ordex v0.1.0</p>
				</div>
			</aside>
		</>
	);
}
