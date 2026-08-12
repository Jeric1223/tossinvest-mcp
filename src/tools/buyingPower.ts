import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TossClient } from "../client.js";
import { toNumber } from "../parse.js";

interface BuyingPowerResponse {
    currency: string;
    cashBuyingPower: string;
}

export function registerBuyingPowerTool(server: McpServer, client: TossClient): void {
    server.registerTool(
        "toss_get_buying_power",
        {
            title: "Get buying power",
            description:
                "Returns available cash in the Toss Securities account. " +
                "toss_get_holdings excludes cash, so call this too when computing total assets.",
            inputSchema: {
                currency: z
                    .enum(["KRW", "USD"])
                    .optional()
                    .describe("Omit to fetch both KRW and USD")
            },
            annotations: { readOnlyHint: true, openWorldHint: true }
        },
        async ({ currency }) => {
            const targets = currency ? [currency] : (["KRW", "USD"] as const);
            const rows = [];
            for (const target of targets) {
                const result = await client.get<BuyingPowerResponse>("/api/v1/buying-power", {
                    accountScoped: true,
                    query: { currency: target }
                });
                rows.push({
                    currency: result.currency,
                    cashBuyingPower: toNumber(result.cashBuyingPower)
                });
            }
            return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
        }
    );
}
