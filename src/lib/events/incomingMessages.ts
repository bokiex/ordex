type IncomingMessageEvent = {
	id: number;
	from: string;
	senderName: string;
	createdAt: string;
};

type IncomingMessageListener = (event: IncomingMessageEvent) => void;
type OrdersChangedEvent = {
	orderId: number;
	action: "created" | "confirmed" | "deleted" | "exported" | "updated";
};
type OrdersChangedListener = (event: OrdersChangedEvent) => void;
type IncomingMessagesChangedEvent = {
	action: "created" | "deleted" | "restored" | "used";
	ids: number[];
};
type IncomingMessagesChangedListener = (
	event: IncomingMessagesChangedEvent,
) => void;

const listeners = new Set<IncomingMessageListener>();
const ordersChangedListeners = new Set<OrdersChangedListener>();
const incomingMessagesChangedListeners =
	new Set<IncomingMessagesChangedListener>();

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

export function subscribeToOrdersChanged(
	listener: OrdersChangedListener,
): () => void {
	ordersChangedListeners.add(listener);
	return () => {
		ordersChangedListeners.delete(listener);
	};
}

export function publishOrdersChanged(event: OrdersChangedEvent): void {
	for (const listener of ordersChangedListeners) {
		listener(event);
	}
}

export function subscribeToIncomingMessagesChanged(
	listener: IncomingMessagesChangedListener,
): () => void {
	incomingMessagesChangedListeners.add(listener);
	return () => {
		incomingMessagesChangedListeners.delete(listener);
	};
}

export function publishIncomingMessagesChanged(
	event: IncomingMessagesChangedEvent,
): void {
	for (const listener of incomingMessagesChangedListeners) {
		listener(event);
	}
}
