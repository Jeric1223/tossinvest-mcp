/** Error thrown when the Toss API responds with 4xx/5xx. */
export class TossApiError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        readonly requestId: string,
        message: string
    ) {
        super(message);
        this.name = "TossApiError";
    }
}

/**
 * Unwraps the `result` envelope from a successful response.
 * The published docs show `data`, but the live API returns `result`.
 */
export function unwrap<T>(body: unknown): T {
    if (typeof body !== "object" || body === null || !("result" in body)) {
        throw new TypeError(
            `Toss response has no "result" field: ${JSON.stringify(body).slice(0, 200)}`
        );
    }
    return (body as { result: T }).result;
}

/**
 * Converts the API's string-encoded numbers to `number`.
 * Missing values (null/undefined/"") stay `null` — substituting 0 would let a
 * caller read "no balance" as a fact.
 */
export function toNumber(value: string | null | undefined): number | null {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new TypeError(`Not a number: ${JSON.stringify(value)}`);
    }
    return parsed;
}

/** Converts a decimal ratio (-0.3799) to a percentage (-37.99), free of float noise. */
export function toPercent(rate: string | null | undefined): number | null {
    const parsed = toNumber(rate);
    return parsed === null ? null : Math.round(parsed * 10000) / 100;
}
