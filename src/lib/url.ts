/** Change only the supplied query parameters, preserving the rest of the current view. */
export const queryUrl = (current: URL, values: Record<string, string | null>): string => {
	const url = new URL(current);
	for (const [key, value] of Object.entries(values)) {
		if (value === null) url.searchParams.delete(key);
		else url.searchParams.set(key, value);
	}
	return `${url.pathname}${url.search}${url.hash}`;
};

export const integerParam = (
	url: URL,
	key: string,
	fallback: number,
	min: number,
	max: number,
): number => {
	const raw = url.searchParams.get(key);
	const value = raw === null || raw.trim() === '' ? NaN : Number(raw);
	return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
};
