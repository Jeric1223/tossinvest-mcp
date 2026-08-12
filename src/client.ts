import { TossApiError, unwrap } from "./parse.js";

export interface TossClientOptions {
    clientId: string;
    clientSecret: string;
    baseUrl?: string;
    /** Injected by tests. Defaults to global fetch. */
    fetchImpl?: typeof fetch;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
}

interface CachedToken {
    accessToken: string;
    expiresAt: number;
}

interface Account {
    accountNo: string;
    accountSeq: number;
    accountType: string;
}

/** Refresh this far ahead of expiry so in-flight requests never race the deadline. */
const TOKEN_SKEW_MS = 60_000;
/** 429 retry delays. Array length is the retry cap. */
const BACKOFF_MS = [500, 1000, 2000];
const TIMEOUT_MS = 15_000;

export class TossClient {
    private token?: CachedToken;
    private accountSeq?: number;
    private readonly baseUrl: string;
    private readonly fetchImpl: typeof fetch;
    private readonly now: () => number;
    private readonly sleep: (ms: number) => Promise<void>;

    constructor(private readonly options: TossClientOptions) {
        this.baseUrl = options.baseUrl ?? "https://openapi.tossinvest.com";
        this.fetchImpl = options.fetchImpl ?? fetch;
        this.now = options.now ?? Date.now;
        this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    }

    async getAccessToken(): Promise<string> {
        if (this.token && this.token.expiresAt - TOKEN_SKEW_MS > this.now()) {
            return this.token.accessToken;
        }

        const body = new URLSearchParams({
            grant_type: "client_credentials",
            client_id: this.options.clientId,
            client_secret: this.options.clientSecret
        });

        const response = await this.fetchImpl(`${this.baseUrl}/oauth2/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body
        });

        if (!response.ok) {
            // The body can echo the credentials back, so surface only the status.
            throw new TossApiError(response.status, "TOKEN_ISSUE_FAILED", "", "Token request failed");
        }

        const json = (await response.json()) as { access_token: string; expires_in: number };
        this.token = {
            accessToken: json.access_token,
            expiresAt: this.now() + json.expires_in * 1000
        };
        return this.token.accessToken;
    }

    /** The ACCOUNT rate-limit group allows 1 req/s, so resolve this once per process. */
    async getAccountSeq(): Promise<number> {
        if (this.accountSeq !== undefined) {
            return this.accountSeq;
        }
        const accounts = await this.get<Account[]>("/api/v1/accounts");
        const target = accounts.find((account) => account.accountType === "BROKERAGE") ?? accounts[0];
        if (!target) {
            throw new TossApiError(404, "NO_ACCOUNT", "", "No account available");
        }
        this.accountSeq = target.accountSeq;
        return this.accountSeq;
    }

    async get<T>(
        path: string,
        options: { query?: Record<string, string | undefined>; accountScoped?: boolean } = {}
    ): Promise<T> {
        let authRetried = false;
        let backoffAttempt = 0;

        for (;;) {
            const headers: Record<string, string> = {
                Authorization: `Bearer ${await this.getAccessToken()}`
            };
            if (options.accountScoped) {
                headers["X-Tossinvest-Account"] = String(await this.getAccountSeq());
            }

            const url = new URL(this.baseUrl + path);
            for (const [key, value] of Object.entries(options.query ?? {})) {
                if (value !== undefined) {
                    url.searchParams.set(key, value);
                }
            }

            const response = await this.fetchImpl(url, {
                headers,
                signal: AbortSignal.timeout(TIMEOUT_MS)
            });

            if (response.ok) {
                return unwrap<T>(await response.json());
            }

            if (response.status === 401 && !authRetried) {
                authRetried = true;
                this.token = undefined;
                continue;
            }

            if (response.status === 429 && backoffAttempt < BACKOFF_MS.length) {
                await this.sleep(BACKOFF_MS[backoffAttempt]);
                backoffAttempt += 1;
                continue;
            }

            throw await toApiError(response);
        }
    }
}

async function toApiError(response: Response): Promise<TossApiError> {
    let code = "UNKNOWN";
    let requestId = "";
    let message = response.statusText;
    try {
        const body = (await response.json()) as {
            code?: string;
            requestId?: string;
            message?: string;
        };
        code = body.code ?? code;
        requestId = body.requestId ?? requestId;
        message = body.message ?? message;
    } catch {
        // Non-JSON body: report the status alone.
    }
    return new TossApiError(response.status, code, requestId, message);
}
