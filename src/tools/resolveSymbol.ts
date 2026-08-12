import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SymbolIndex } from "../symbols.js";

export function registerResolveSymbolTool(server: McpServer, symbols: SymbolIndex): void {
    server.registerTool(
        "toss_resolve_symbol",
        {
            title: "Resolve a company name to a symbol",
            description:
                "Finds the Toss Securities symbol for a company name or ticker, e.g. '삼성전자' -> 005930. " +
                "When `exact` is false the query matched several candidates — ask the user which one " +
                "instead of picking one yourself.",
            inputSchema: {
                query: z.string().min(1).describe("Company name or ticker, e.g. '삼성전자', 'NVDA'")
            },
            annotations: { readOnlyHint: true }
        },
        async ({ query }) => {
            const result = symbols.resolve(query);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
    );
}
