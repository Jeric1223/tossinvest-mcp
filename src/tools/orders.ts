import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TossClient } from "../client.js";
import { ConfirmationStore } from "../confirmation.js";

const decimal = z.string().regex(/^\d+(\.\d+)?$/, "Use a positive decimal string");
const side = z.enum(["BUY", "SELL"]);
const orderType = z.enum(["LIMIT", "MARKET"]);
const leg = z.object({ orderSide: side, triggerPrice: decimal, orderPrice: decimal.optional() });

type DirectOrder = {
    symbol: string; side: "BUY" | "SELL"; orderType: "LIMIT" | "MARKET";
    quantity?: string; orderAmount?: string; price?: string; timeInForce?: "DAY" | "CLS";
};
type ConditionalOrder = {
    symbol: string; type: "SINGLE" | "OCO" | "OTO"; quantity: string;
    orderType: "LIMIT" | "MARKET"; expireDate: string;
    first: { orderSide: "BUY" | "SELL"; triggerPrice: string; orderPrice?: string };
    second?: { orderSide: "BUY" | "SELL"; triggerPrice: string; orderPrice?: string };
};
type Pending = { kind: "order"; request: DirectOrder } | { kind: "conditional"; request: ConditionalOrder };

function result(value: unknown) {
    return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function validateDirect(order: DirectOrder): void {
    if ((order.quantity === undefined) === (order.orderAmount === undefined)) {
        throw new Error("Provide exactly one of quantity or orderAmount.");
    }
    if (order.orderType === "LIMIT" && !order.price) throw new Error("LIMIT orders require price.");
    if (order.orderType === "MARKET" && order.price) throw new Error("MARKET orders cannot include price.");
    if (order.orderAmount && order.orderType !== "MARKET") throw new Error("orderAmount is only valid for MARKET orders.");
}

function validateConditional(order: ConditionalOrder): void {
    const hasSecond = order.second !== undefined;
    if ((order.type === "SINGLE") === hasSecond) throw new Error("SINGLE needs no second leg; OCO and OTO require one.");
    if (["OCO", "OTO"].includes(order.type) && order.orderType !== "LIMIT") {
        throw new Error("OCO and OTO conditional orders require LIMIT orderType.");
    }
    for (const item of [order.first, order.second].filter(Boolean)) {
        if (order.orderType === "LIMIT" && !item!.orderPrice) throw new Error("LIMIT conditional orders require orderPrice for every leg.");
        if (order.orderType === "MARKET" && item!.orderPrice) throw new Error("MARKET conditional orders cannot include orderPrice.");
    }
}

export function registerOrderTools(server: McpServer, client: TossClient): void {
    const confirmations = new ConfirmationStore<Pending>();
    const prepareDescription = "This never places an order. Show its returned preview to the user and obtain an explicit final confirmation before calling toss_submit_prepared_order. The token expires after 60 seconds and can only be used once.";

    server.registerTool("toss_prepare_order", {
        title: "Prepare stock order", description: prepareDescription,
        inputSchema: {
            symbol: z.string().min(1), side, orderType,
            quantity: decimal.optional(), orderAmount: decimal.optional(), price: decimal.optional(),
            timeInForce: z.enum(["DAY", "CLS"]).optional()
        }, annotations: { destructiveHint: true, openWorldHint: true }
    }, async (order) => {
        validateDirect(order);
        const prepared = confirmations.create({ kind: "order", request: order });
        return result({ status: "awaiting_user_confirmation", order, confirmationToken: prepared.token, expiresAt: prepared.expiresAt,
            instruction: "Ask the user to explicitly confirm this exact order. Do not submit without confirmation." });
    });

    server.registerTool("toss_prepare_conditional_order", {
        title: "Prepare conditional stock order", description: prepareDescription,
        inputSchema: { symbol: z.string().min(1), type: z.enum(["SINGLE", "OCO", "OTO"]), quantity: decimal, orderType,
            expireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), first: leg, second: leg.optional() },
        annotations: { destructiveHint: true, openWorldHint: true }
    }, async (order) => {
        validateConditional(order);
        const prepared = confirmations.create({ kind: "conditional", request: order });
        return result({ status: "awaiting_user_confirmation", conditionalOrder: order, confirmationToken: prepared.token, expiresAt: prepared.expiresAt,
            instruction: "Ask the user to explicitly confirm this exact conditional order. Do not submit without confirmation." });
    });

    server.registerTool("toss_submit_prepared_order", {
        title: "Submit confirmed prepared order",
        description: "Places the previously prepared order. Call only after the user has explicitly confirmed the exact preview in this conversation. The confirmation token is single-use and expires after 60 seconds.",
        inputSchema: { confirmationToken: z.string().uuid(), userConfirmed: z.literal(true).describe("Must be true only after the user explicitly confirms the preview") },
        annotations: { destructiveHint: true, openWorldHint: true }
    }, async ({ confirmationToken }) => {
        const pending = confirmations.consume(confirmationToken);
        const clientOrderId = confirmationToken.replaceAll("-", "");
        if (pending.kind === "order") {
            const response = await client.post<{ orderId: string; clientOrderId?: string }>("/api/v1/orders", { ...pending.request, clientOrderId, confirmHighValueOrder: true });
            return result({ status: "submitted", kind: "order", ...response });
        }
        const response = await client.post<{ conditionalOrderId: string; clientOrderId?: string }>("/api/v1/conditional-orders", { ...pending.request, clientOrderId, confirmHighValueOrder: true });
        return result({ status: "submitted", kind: "conditional_order", ...response });
    });
}
