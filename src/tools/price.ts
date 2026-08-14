import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TossClient } from "../client.js";
import type { SymbolIndex } from "../symbols.js";
import { toNumber } from "../parse.js";

interface PriceResponse {
    symbol: string;
    timestamp: string | null;
    lastPrice: string;
    currency: string;
}

export function registerPriceTool(
    server: McpServer,
    client: TossClient,
    loadSymbols: () => Promise<SymbolIndex>
): void {
    server.registerTool(
        "toss_get_price",
        {
            title: "Get current price",
            description:
                "Fetches current prices from Toss Securities. Korean listings use the 6-digit code " +
                "(e.g. 005930); US listings use the ticker (e.g. NVDA). Both can be mixed in one call. " +
                "If you only know the company name, call toss_resolve_symbol first.",
            inputSchema: {
                symbols: z
                    .array(z.string())
                    .min(1)
                    .max(200)
                    .describe("Symbols to look up, e.g. ['005930', 'NVDA']")
            },
            annotations: { readOnlyHint: true, openWorldHint: true }
        },
        async ({ symbols: requested }) => {
            const [prices, index] = await Promise.all([
                client.get<PriceResponse[]>("/api/v1/prices", {
                    query: { symbols: requested.join(",") }
                }),
                loadSymbols()
            ]);

            const rows = prices.map((price) => ({
                symbol: price.symbol,
                name: index.nameOf(price.symbol) ?? null,
                lastPrice: toNumber(price.lastPrice),
                currency: price.currency,
                timestamp: price.timestamp
            }));

            return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
        }
    );
}
