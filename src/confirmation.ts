import { randomUUID } from "node:crypto";

export interface PendingAction<T> {
    token: string;
    payload: T;
    expiresAt: string;
}

/** In-memory, single-use approval records. Restarting the server invalidates all of them. */
export class ConfirmationStore<T> {
    private readonly pending = new Map<string, PendingAction<T>>();

    constructor(private readonly ttlMs = 60_000, private readonly now: () => number = Date.now) {}

    create(payload: T): PendingAction<T> {
        const token = randomUUID();
        const expiresAt = new Date(this.now() + this.ttlMs).toISOString();
        const record = { token, payload, expiresAt };
        this.pending.set(token, record);
        return record;
    }

    consume(token: string): T {
        const record = this.pending.get(token);
        this.pending.delete(token); // Never allow replay, including after expiry.
        if (!record) throw new Error("Unknown or already-used confirmation token. Prepare the action again.");
        if (Date.parse(record.expiresAt) <= this.now()) {
            throw new Error("Confirmation token expired. Prepare the action again.");
        }
        return record.payload;
    }
}
