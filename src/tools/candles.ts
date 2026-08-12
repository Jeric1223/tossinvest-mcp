import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TossClient } from "../client.js";
import { toNumber } from "../parse.js";

interface Candle {
    timestamp: string;
    openPrice: string;
    highPrice: string;
    lowPrice: string;
    closePrice: string;
    volume: string;
    currency: string;
}

interface CandlePageResponse {
    candles: Candle[];
    nextBefore: string | null;
}

export function registerCandlesTool(server: McpServer, client: TossClient): void {
    server.registerTool(
        "toss_get_candles",
        {
            title: "Get OHLCV candles",
            description:
                "Returns OHLCV candles for a symbol, for trend and volatility analysis. " +
                "Interval is 1m or 1d; at most 200 candles per call.",
            inputSchema: {
                symbol: z.string().min(1).describe("Symbol, e.g. 005930 or NVDA"),
                interval: z.enum(["1m", "1d"]).describe("Candle interval"),
                count: z.number().int().min(1).max(200).optional().describe("How many candles"),
                before: z
                    .string()
                    .optional()
                    .describe("Pagination cursor: pass the previous response's nextBefore"),
                adjusted: z.boolean().optional().describe("Apply split/dividend adjustment")
            },
            annotations: { readOnlyHint: true, openWorldHint: true }
        },
        async ({ symbol, interval, count, before, adjusted }) => {
            const page = await client.get<CandlePageResponse>("/api/v1/candles", {
                query: {
                    symbol,
                    interval,
                    count: count === undefined ? undefined : String(count),
                    before,
                    adjusted: adjusted === undefined ? undefined : String(adjusted)
                }
            });

            const formatted = {
                candles: page.candles.map((candle) => ({
                    timestamp: candle.timestamp,
                    open: toNumber(candle.openPrice),
                    high: toNumber(candle.highPrice),
                    low: toNumber(candle.lowPrice),
                    close: toNumber(candle.closePrice),
                    volume: toNumber(candle.volume),
                    currency: candle.currency
                })),
                nextBefore: page.nextBefore
            };

            return { content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }] };
        }
    );
}
