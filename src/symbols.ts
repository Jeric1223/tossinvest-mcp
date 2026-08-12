import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { TossClient } from "./client.js";

export type Market = "KOSPI" | "KOSDAQ" | "NASDAQ" | "NYSE" | "AMEX";

export const MARKETS: Market[] = ["KOSPI", "KOSDAQ", "NASDAQ", "NYSE", "AMEX"];

export interface StockEntry {
    symbol: string;
    name: string;
    market: Market;
    securityType: string;
    isCommonShare: boolean;
}

export interface ResolveResult {
    matched: StockEntry[];
    exact: boolean;
}

/** An element of `GET /api/v1/stocks/all`. Note it carries no `market` field. */
interface ListedStock {
    symbol: string;
    name: string;
    securityType: string;
    isCommonShare: boolean;
    isinCode: string;
}

interface CacheFile {
    fetchedAt: number;
    entries: StockEntry[];
}

const TTL_MS = 24 * 60 * 60 * 1000;
/** Hundreds of partial matches would make the response useless. */
const MAX_PARTIAL_MATCHES = 20;

export class SymbolIndex {
    private readonly bySymbol = new Map<string, StockEntry>();
    private readonly byName = new Map<string, StockEntry[]>();

    constructor(private readonly entries: StockEntry[]) {
        for (const entry of entries) {
            this.bySymbol.set(entry.symbol.toUpperCase(), entry);
            const sameName = this.byName.get(entry.name) ?? [];
            sameName.push(entry);
            this.byName.set(entry.name, sameName);
        }
    }

    nameOf(symbol: string): string | undefined {
        return this.bySymbol.get(symbol.toUpperCase())?.name;
    }

    resolve(query: string): ResolveResult {
        const trimmed = query.trim();

        const bySymbol = this.bySymbol.get(trimmed.toUpperCase());
        if (bySymbol) {
            return { matched: [bySymbol], exact: true };
        }

        const byName = this.byName.get(trimmed);
        if (byName && byName.length > 0) {
            return { matched: byName, exact: byName.length === 1 };
        }

        const needle = trimmed.toLowerCase();
        const partial = this.entries
            .filter((entry) => entry.name.toLowerCase().includes(needle))
            .sort((a, b) => a.name.length - b.name.length)
            .slice(0, MAX_PARTIAL_MATCHES);

        return { matched: partial, exact: false };
    }
}

async function readCache(cachePath: string): Promise<CacheFile | undefined> {
    try {
        return JSON.parse(await readFile(cachePath, "utf8")) as CacheFile;
    } catch {
        return undefined;
    }
}

async function refresh(
    client: TossClient,
    cachePath: string,
    now: () => number
): Promise<CacheFile> {
    const entries: StockEntry[] = [];
    for (const market of MARKETS) {
        const listed = await client.get<ListedStock[]>("/api/v1/stocks/all", {
            query: { market, status: "ACTIVE" }
        });
        for (const stock of listed) {
            entries.push({
                symbol: stock.symbol,
                name: stock.name,
                market,
                securityType: stock.securityType,
                isCommonShare: stock.isCommonShare
            });
        }
    }

    const cache: CacheFile = { fetchedAt: now(), entries };
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(cachePath, JSON.stringify(cache), "utf8");
    return cache;
}

/**
 * Loads the stock master.
 * When the cache is stale we still answer from it and refresh in the background —
 * a price question must not wait on five sequential market listings.
 */
export async function loadSymbolIndex(
    client: TossClient,
    cachePath: string,
    now: () => number = Date.now
): Promise<SymbolIndex> {
    const cached = await readCache(cachePath);

    if (cached && now() - cached.fetchedAt < TTL_MS) {
        return new SymbolIndex(cached.entries);
    }

    if (cached) {
        void refresh(client, cachePath, now).catch((error: unknown) => {
            console.error("[toss-mcp] stock master refresh failed:", error);
        });
        return new SymbolIndex(cached.entries);
    }

    const fresh = await refresh(client, cachePath, now);
    return new SymbolIndex(fresh.entries);
}
