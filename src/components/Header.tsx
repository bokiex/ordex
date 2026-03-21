import { Button, Navbar, NavbarBrand, NavbarContent } from "@heroui/react";
import { Menu } from "lucide-react";

interface HeaderProps {
	onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
	return (
		<Navbar
			maxWidth="full"
			className="md:hidden"
			classNames={{
				base: "bg-gray-900 border-b border-gray-800",
				wrapper: "px-4",
			}}
		>
			<NavbarContent>
				<Button
					isIconOnly
					variant="light"
					onPress={onMenuClick}
					className="text-white hover:bg-gray-800"
					aria-label="Open menu"
				>
					<Menu size={24} />
				</Button>
				<NavbarBrand>
					<h1 className="text-xl font-bold tracking-tight">
						<span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
							Ordex
						</span>
					</h1>
				</NavbarBrand>
			</NavbarContent>
		</Navbar>
	);
}
