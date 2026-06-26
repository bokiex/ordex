import { createFileRoute } from "@tanstack/react-router";
import {
	subscribeToIncomingMessages,
	subscribeToIncomingMessagesChanged,
	subscribeToOrdersChanged,
} from "@/lib/events/incomingMessages";

const encoder = new TextEncoder();

export const Route = createFileRoute("/api/events/incoming-messages")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				let cleanup = () => {};

				const stream = new ReadableStream({
					start(controller) {
						let active = true;
						let heartbeat: ReturnType<typeof setInterval> | undefined;
						let unsubscribe = () => {};
						let unsubscribeIncomingChanges = () => {};
						let unsubscribeOrders = () => {};

						const stop = () => {
							if (!active) return;

							active = false;
							if (heartbeat) clearInterval(heartbeat);
							unsubscribe();
							unsubscribeIncomingChanges();
							unsubscribeOrders();
							request.signal.removeEventListener("abort", stop);
						};

						cleanup = stop;

						const enqueue = (value: string) => {
							if (!active) return;

							try {
								controller.enqueue(encoder.encode(value));
							} catch {
								stop();
							}
						};

						const send = (event: string, data: unknown) => {
							enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
						};

						send("connected", { ok: true });

						unsubscribe = subscribeToIncomingMessages((message) => {
							send("incoming-message", message);
						});
						unsubscribeIncomingChanges = subscribeToIncomingMessagesChanged(
							(event) => {
								send("incoming-messages-changed", event);
							},
						);
						unsubscribeOrders = subscribeToOrdersChanged((event) => {
							send("orders-changed", event);
						});

						heartbeat = setInterval(() => {
							enqueue(": keepalive\n\n");
						}, 25_000);

						request.signal.addEventListener("abort", stop, { once: true });
						if (request.signal.aborted) stop();
					},
					cancel() {
						cleanup();
					},
				});

				return new Response(stream, {
					headers: {
						"Cache-Control": "no-cache, no-transform",
						Connection: "keep-alive",
						"Content-Type": "text/event-stream",
						"X-Accel-Buffering": "no",
					},
				});
			},
		},
	},
});
