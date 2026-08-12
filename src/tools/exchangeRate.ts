import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TossClient } from "../client.js";
import { toNumber } from "../parse.js";

interface ExchangeRateResponse {
    baseCurrency: string;
    quoteCurrency: string;
    rate: string;
    midRate: string;
    validFrom: string;
    validUntil: string;
}

export function registerExchangeRateTool(server: McpServer, client: TossClient): void {
    server.registerTool(
        "toss_get_exchange_rate",
        {
            title: "Get exchange rate",
            description:
                "Returns the Toss Securities FX rate, defaulting to USD -> KRW. " +
                "Use it to convert USD positions to KRW. Quotes expire in about five minutes, " +
                "so do not cache the result.",
            inputSchema: {
                baseCurrency: z.enum(["USD", "KRW"]).default("USD").describe("Base currency"),
                quoteCurrency: z.enum(["USD", "KRW"]).default("KRW").describe("Quote currency")
            },
            annotations: { readOnlyHint: true, openWorldHint: true }
        },
        async ({ baseCurrency, quoteCurrency }) => {
            const result = await client.get<ExchangeRateResponse>("/api/v1/exchange-rate", {
                query: { baseCurrency, quoteCurrency }
            });
            const formatted = {
                baseCurrency: result.baseCurrency,
                quoteCurrency: result.quoteCurrency,
                rate: toNumber(result.rate),
                midRate: toNumber(result.midRate),
                validFrom: result.validFrom,
                validUntil: result.validUntil
            };
            return { content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }] };
        }
    );
}
