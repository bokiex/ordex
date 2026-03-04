import { Menu } from "lucide-react";

interface HeaderProps {
	onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
	return (
		<header className="flex items-center gap-3 p-4 bg-gray-900 border-b border-gray-800 text-white md:hidden">
			<button
				type="button"
				onClick={onMenuClick}
				className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
				aria-label="Open menu"
			>
				<Menu size={24} />
			</button>
			<h1 className="text-xl font-bold tracking-tight">
				<span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
					Ordex
				</span>
			</h1>
		</header>
	);
}
