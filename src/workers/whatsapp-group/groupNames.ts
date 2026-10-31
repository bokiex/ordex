import type { Client } from "whatsapp-web.js";

export type GroupDisplayNameResolver = {
	refresh(): Promise<number>;
	resolve(groupChatId: string): Promise<string | undefined>;
};

type GroupDisplayName = {
	id: string;
	name: string;
};

type WhatsAppWebPage = {
	evaluate<T>(pageFunction: () => T | Promise<T>): Promise<T>;
};

type WhatsAppWebClient = Pick<Client, "pupPage">;

export function createGroupDisplayNameResolver(
	client: WhatsAppWebClient,
): GroupDisplayNameResolver {
	let names = new Map<string, string>();
	let refreshPromise: Promise<number> | undefined;

	const refresh = async (): Promise<number> => {
		if (refreshPromise) {
			return refreshPromise;
		}

		refreshPromise = loadGroupDisplayNames(client)
			.then((displayNames) => {
				names = new Map(displayNames.map(({ id, name }) => [id, name]));
				return names.size;
			})
			.finally(() => {
				refreshPromise = undefined;
			});

		return refreshPromise;
	};

	return {
		refresh,
		async resolve(groupChatId) {
			const cachedName = names.get(groupChatId);
			if (cachedName) {
				return cachedName;
			}

			await refresh();
			return names.get(groupChatId);
		},
	};
}

async function loadGroupDisplayNames(
	client: WhatsAppWebClient,
): Promise<GroupDisplayName[]> {
	const page = client.pupPage as WhatsAppWebPage | undefined;
	if (!page) {
		throw new Error("WhatsApp Web page is not available");
	}

	return page.evaluate(() => {
		const whatsAppWindow = window as typeof window & {
			require(moduleName: string): {
				Chat: {
					getModelsArray(): Array<{
						formattedTitle?: unknown;
						groupMetadata?: unknown;
						id?: { _serialized?: unknown };
					}>;
				};
			};
		};
		const chats = whatsAppWindow
			.require("WAWebCollections")
			.Chat.getModelsArray();

		return chats.flatMap((chat) => {
			const id = chat.id?._serialized;
			const name = chat.formattedTitle;

			if (
				!chat.groupMetadata ||
				typeof id !== "string" ||
				typeof name !== "string" ||
				!name.trim()
			) {
				return [];
			}

			return [{ id, name: name.trim() }];
		});
	});
}
