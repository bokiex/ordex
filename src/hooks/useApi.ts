import { useCallback, useEffect, useState } from "react";

interface UseApiResult<T> {
	data: T | null;
	error: string | null;
	loading: boolean;
	refetch: () => void;
}

export function useApi<T>(url: string | null): UseApiResult<T> {
	const [data, setData] = useState<T | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [trigger, setTrigger] = useState(0);

	const refetch = useCallback(() => {
		setTrigger((prev) => prev + 1);
	}, []);

	useEffect(() => {
		void trigger;

		if (url === null) {
			setData(null);
			setError(null);
			setLoading(false);
			return;
		}

		let cancelled = false;
		setLoading(true);
		setError(null);

		fetch(url, {
			cache: "no-store",
			headers: { "Content-Type": "application/json" },
		})
			.then(async (res) => {
				if (!res.ok) {
					const err = await res.json().catch(() => ({ error: res.statusText }));
					throw new Error(err.error || res.statusText);
				}
				if (res.status === 204) return null as T;
				return res.json() as Promise<T>;
			})
			.then((result) => {
				if (!cancelled) {
					setData(result);
					setLoading(false);
				}
			})
			.catch((err) => {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : String(err));
					setLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [url, trigger]);

	return { data, error, loading, refetch };
}

export async function apiCall<T>(
	url: string,
	options?: RequestInit,
): Promise<T> {
	const res = await fetch(url, {
		cache: "no-store",
		headers: { "Content-Type": "application/json" },
		...options,
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({ error: res.statusText }));
		throw new Error(err.error || res.statusText);
	}
	if (res.status === 204) return null as T;
	return res.json();
}
