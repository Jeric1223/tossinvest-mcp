import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TossClient } from "../client.js";

const output = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
const readOnly = { readOnlyHint: true, openWorldHint: true };
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
const page = z.number().int().min(1).max(100).optional();

export function registerOrderInfoTools(server: McpServer, client: TossClient): void {
    server.registerTool("toss_get_orders", { title: "Get orders", description: "Lists open or closed orders. Open orders return all matching pending orders.", inputSchema: { status: z.enum(["OPEN", "CLOSED"]), symbol: z.string().optional(), from: date, to: date, cursor: z.string().optional(), limit: page }, annotations: readOnly }, async (input) =>
        output(await client.get("/api/v1/orders", { accountScoped: true, query: Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v === undefined ? undefined : String(v)])) })));
    server.registerTool("toss_get_order", { title: "Get order detail", description: "Gets a single order, including status and executions.", inputSchema: { orderId: z.string().min(1) }, annotations: readOnly }, async ({ orderId }) =>
        output(await client.get(`/api/v1/orders/${encodeURIComponent(orderId)}`, { accountScoped: true })));
    server.registerTool("toss_get_sellable_quantity", { title: "Get sellable quantity", description: "Returns the quantity currently available to sell for a symbol.", inputSchema: { symbol: z.string().min(1) }, annotations: readOnly }, async ({ symbol }) =>
        output(await client.get("/api/v1/sellable-quantity", { accountScoped: true, query: { symbol } })));
    server.registerTool("toss_get_commissions", { title: "Get commissions", description: "Returns applicable Korean and US stock trading commission schedules.", inputSchema: {}, annotations: readOnly }, async () =>
        output(await client.get("/api/v1/commissions", { accountScoped: true })));
    server.registerTool("toss_get_conditional_orders", { title: "Get conditional orders", description: "Lists open or closed conditional orders.", inputSchema: { status: z.enum(["OPEN", "CLOSED"]), symbol: z.string().optional(), cursor: z.string().optional(), limit: page }, annotations: readOnly }, async (input) =>
        output(await client.get("/api/v1/conditional-orders", { accountScoped: true, query: Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v === undefined ? undefined : String(v)])) })));
    server.registerTool("toss_get_conditional_order", { title: "Get conditional order detail", description: "Gets a single conditional order and its current trigger status.", inputSchema: { conditionalOrderId: z.string().min(1) }, annotations: readOnly }, async ({ conditionalOrderId }) =>
        output(await client.get(`/api/v1/conditional-orders/${encodeURIComponent(conditionalOrderId)}`, { accountScoped: true })));
}
