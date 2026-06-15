type IncomingMessageEvent = {
	id: number;
	from: string;
	senderName: string;
	createdAt: string;
};

type IncomingMessageListener = (event: IncomingMessageEvent) => void;

const listeners = new Set<IncomingMessageListener>();

export function subscribeToIncomingMessages(
	listener: IncomingMessageListener,
): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function publishIncomingMessage(event: IncomingMessageEvent): void {
	for (const listener of listeners) {
		listener(event);
	}
}
