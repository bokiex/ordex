import { createFileRoute } from "@tanstack/react-router";
import { subscribeToIncomingMessages } from "@/lib/events/incomingMessages";

const encoder = new TextEncoder();

export const Route = createFileRoute("/api/events/incoming-messages")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const stream = new ReadableStream({
					start(controller) {
						const send = (event: string, data: unknown) => {
							controller.enqueue(
								encoder.encode(
									`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
								),
							);
						};

						send("connected", { ok: true });

						const unsubscribe = subscribeToIncomingMessages((message) => {
							send("incoming-message", message);
						});

						const heartbeat = setInterval(() => {
							controller.enqueue(encoder.encode(": keepalive\n\n"));
						}, 25_000);

						request.signal.addEventListener("abort", () => {
							clearInterval(heartbeat);
							unsubscribe();
							controller.close();
						});
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
