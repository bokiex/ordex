import {
	Button,
	Divider,
	Drawer,
	DrawerBody,
	DrawerContent,
	DrawerFooter,
	DrawerHeader,
	Listbox,
	ListboxItem,
} from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { ClipboardList, FileText, Package, Users, X } from "lucide-react";

const APP_VERSION = "{APP_VERSION}";

const BRAND_GRADIENT =
	"bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent";

const NAV_LINK_BASE =
	"flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors";

const navItems = [
	{ to: "/orders" as const, label: "Orders", icon: ClipboardList },
	{ to: "/customers" as const, label: "Customers", icon: Users },
	{ to: "/items" as const, label: "Item Codes", icon: Package },
	{ to: "/invoices" as const, label: "Invoices", icon: FileText },
];

interface SidebarProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

function SidebarBrand({ onClose }: { onClose?: () => void }) {
	return (
		<div className="flex items-center justify-between p-5">
			<h1 className="text-2xl font-bold tracking-tight">
				<span className={BRAND_GRADIENT}>Ordex</span>
			</h1>
			{onClose && (
				<Button
					isIconOnly
					variant="light"
					size="sm"
					onPress={onClose}
					className="md:hidden text-white hover:bg-gray-800"
					aria-label="Close sidebar"
				>
					<X size={20} />
				</Button>
			)}
		</div>
	);
}

function SidebarNav({ onClose }: { onClose?: () => void }) {
	return (
		<Listbox
			aria-label="Navigation"
			classNames={{
				list: "gap-1",
			}}
		>
			{navItems.map((item) => (
				<ListboxItem
					key={item.to}
					className="p-0 data-[hover=true]:bg-transparent"
					textValue={item.label}
				>
					<Link
						to={item.to}
						onClick={onClose}
						className={`${NAV_LINK_BASE} text-gray-400 hover:bg-gray-800 hover:text-white`}
						activeProps={{
							className: `${NAV_LINK_BASE} bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/20`,
						}}
					>
						<item.icon size={20} />
						<span className="font-medium">{item.label}</span>
					</Link>
				</ListboxItem>
			))}
		</Listbox>
	);
}

export default function Sidebar({ isOpen, onOpenChange }: SidebarProps) {
	const handleClose = () => onOpenChange(false);

	return (
		<>
			{/* Desktop sidebar — always visible */}
			<aside className="hidden md:flex fixed top-0 left-0 h-full w-64 bg-gray-900 text-white z-50 flex-col border-r border-gray-800">
				<SidebarBrand />
				<Divider className="bg-gray-800" />
				<nav className="flex-1 p-3 overflow-y-auto">
					<SidebarNav />
				</nav>
				<Divider className="bg-gray-800" />
				<div className="p-4">
					<p className="text-xs text-gray-500">{APP_VERSION}</p>
				</div>
			</aside>

			{/* Mobile sidebar — HeroUI Drawer */}
			<Drawer
				isOpen={isOpen}
				onOpenChange={onOpenChange}
				placement="left"
				classNames={{
					base: "md:hidden max-w-64",
					body: "p-0",
					header: "p-0",
					footer: "p-0",
				}}
				hideCloseButton
			>
				<DrawerContent className="bg-gray-900 text-white">
					<DrawerHeader>
						<SidebarBrand onClose={handleClose} />
					</DrawerHeader>
					<Divider className="bg-gray-800" />
					<DrawerBody className="p-3">
						<SidebarNav onClose={handleClose} />
					</DrawerBody>
					<Divider className="bg-gray-800" />
					<DrawerFooter className="justify-start p-4">
						<p className="text-xs text-gray-500">{APP_VERSION}</p>
					</DrawerFooter>
				</DrawerContent>
			</Drawer>
		</>
	);
}
