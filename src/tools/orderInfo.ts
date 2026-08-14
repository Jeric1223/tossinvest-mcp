import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TossClient } from "../client.js";

const output = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
const readOnly = { readOnlyHint: true, openWorldHint: true };
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("KST date formatted YYYY-MM-DD.");
const page = z.number().int().min(1).max(100).optional().describe("Maximum number of rows in one page. Follow `cursor` from the response to fetch the rest.");
const symbolFilter = z.string().optional().describe("Restrict the list to one Korean 6-digit code or US ticker. Omit to list every symbol.");
const cursor = z.string().optional().describe("Pagination cursor taken from the previous response. Omit for the first page.");

export function registerOrderInfoTools(server: McpServer, client: TossClient): void {
    server.registerTool("toss_get_orders", { title: "Get orders", description: "Lists regular orders in the account, filtered by status. Use it to find the orderId needed by toss_prepare_order_modify and toss_prepare_order_cancel, or to check whether an order filled. Conditional orders are listed separately by toss_get_conditional_orders.", inputSchema: { status: z.enum(["OPEN", "CLOSED"]).describe("OPEN lists orders that can still fill; CLOSED lists filled, cancelled, and expired ones."), symbol: symbolFilter, from: date, to: date, cursor, limit: page }, annotations: readOnly }, async (input) =>
        output(await client.get("/api/v1/orders", { accountScoped: true, query: Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v === undefined ? undefined : String(v)])) })));
    server.registerTool("toss_get_order", { title: "Get order detail", description: "Gets one regular order in full, including its current status and every partial execution. Use it to confirm what actually filled after submitting an order.", inputSchema: { orderId: z.string().min(1).describe("Identifier of the order, as returned by toss_get_orders or by toss_submit_prepared_order.") }, annotations: readOnly }, async ({ orderId }) =>
        output(await client.get(`/api/v1/orders/${encodeURIComponent(orderId)}`, { accountScoped: true })));
    server.registerTool("toss_get_sellable_quantity", { title: "Get sellable quantity", description: "Returns how many shares of one symbol can be sold right now. This can be lower than the holding shown by toss_get_holdings, because shares reserved by open sell orders or still settling are excluded. Check it before sizing a SELL order.", inputSchema: { symbol: z.string().min(1).describe("Korean 6-digit code (e.g. '005930') or US ticker (e.g. 'NVDA').") }, annotations: readOnly }, async ({ symbol }) =>
        output(await client.get("/api/v1/sellable-quantity", { accountScoped: true, query: { symbol } })));
    server.registerTool("toss_get_commissions", { title: "Get commissions", description: "Returns applicable Korean and US stock trading commission schedules.", inputSchema: {}, annotations: readOnly }, async () =>
        output(await client.get("/api/v1/commissions", { accountScoped: true })));
    server.registerTool("toss_get_conditional_orders", { title: "Get conditional orders", description: "Lists conditional (trigger-based) orders in the account, filtered by status. Use it to find the conditionalOrderId needed by toss_prepare_conditional_order_modify and toss_prepare_conditional_order_cancel. Regular orders are listed separately by toss_get_orders.", inputSchema: { status: z.enum(["OPEN", "CLOSED"]).describe("OPEN lists conditions still armed and waiting to trigger; CLOSED lists triggered, cancelled, and expired ones."), symbol: symbolFilter, cursor, limit: page }, annotations: readOnly }, async (input) =>
        output(await client.get("/api/v1/conditional-orders", { accountScoped: true, query: Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v === undefined ? undefined : String(v)])) })));
    server.registerTool("toss_get_conditional_order", { title: "Get conditional order detail", description: "Gets one conditional order in full, including whether its trigger has fired and what each leg is doing. Use it to check on an armed condition before modifying it.", inputSchema: { conditionalOrderId: z.string().min(1).describe("Identifier of the conditional order, as returned by toss_get_conditional_orders or by toss_submit_prepared_order.") }, annotations: readOnly }, async ({ conditionalOrderId }) =>
        output(await client.get(`/api/v1/conditional-orders/${encodeURIComponent(conditionalOrderId)}`, { accountScoped: true })));
}
