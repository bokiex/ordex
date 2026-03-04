import {
	Button,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
} from "@heroui/react";

interface ConfirmDeleteModalProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
	title?: string;
	message?: string;
	loading?: boolean;
}

export function ConfirmDeleteModal({
	isOpen,
	onClose,
	onConfirm,
	title = "Confirm Delete",
	message = "Are you sure? This action cannot be undone.",
	loading = false,
}: ConfirmDeleteModalProps) {
	return (
		<Modal isOpen={isOpen} onClose={onClose}>
			<ModalContent>
				<ModalHeader>{title}</ModalHeader>
				<ModalBody>
					<p className="text-gray-400">{message}</p>
				</ModalBody>
				<ModalFooter>
					<Button variant="light" onPress={onClose}>
						Cancel
					</Button>
					<Button color="danger" onPress={onConfirm} isLoading={loading}>
						Delete
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}
