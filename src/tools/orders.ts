import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TossClient } from "../client.js";
import { ConfirmationStore } from "../confirmation.js";

const decimal = z.string().regex(/^\d+(\.\d+)?$/, "Use a positive decimal string");
const side = z.enum(["BUY", "SELL"]);
const orderType = z.enum(["LIMIT", "MARKET"]);
const leg = z.object({
    orderSide: side.describe("Direction of this leg: BUY or SELL."),
    triggerPrice: decimal
        .describe("Price that activates this leg, as a positive decimal string, e.g. '71000'."),
    orderPrice: decimal
        .optional()
        .describe(
            "Limit price submitted once the leg triggers. Required when orderType is LIMIT; " +
                "must be omitted when orderType is MARKET."
        )
});

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
type ModifyOrder = { orderId: string; orderType: "LIMIT" | "MARKET"; quantity?: string; price?: string };
type ModifyConditional = Omit<ConditionalOrder, "symbol"> & { conditionalOrderId: string };
type Pending =
    | { kind: "order"; request: DirectOrder }
    | { kind: "conditional"; request: ConditionalOrder }
    | { kind: "modify_order"; request: ModifyOrder }
    | { kind: "cancel_order"; orderId: string }
    | { kind: "modify_conditional"; request: ModifyConditional }
    | { kind: "cancel_conditional"; conditionalOrderId: string };

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
    // Shared safety contract, appended after each tool's own purpose sentence so that an agent
    // reading only the description can still tell the six prepare_* tools apart.
    const safetyContract =
        " Nothing reaches the market from this call: it only validates the request and returns a " +
        "preview plus a confirmation token. Show that preview to the user, obtain explicit approval, " +
        "then pass the token to toss_submit_prepared_order. The token is single-use and expires 60 " +
        "seconds after this call.";

    server.registerTool("toss_prepare_order", {
        title: "Prepare stock order",
        description:
            "Previews a NEW market or limit order to buy or sell one stock immediately. " +
            "For trigger-based orders use toss_prepare_conditional_order; to change or withdraw an " +
            "order that already exists use toss_prepare_order_modify or toss_prepare_order_cancel." +
            safetyContract,
        inputSchema: {
            symbol: z.string().min(1).describe(
                "Korean 6-digit code (e.g. '005930') or US ticker (e.g. 'NVDA'). " +
                    "Call toss_resolve_symbol first if you only have a company name."
            ),
            side: side.describe("BUY to open or increase a position, SELL to reduce or close one."),
            orderType: orderType.describe(
                "LIMIT executes only at `price` or better and requires `price`. " +
                    "MARKET executes at the prevailing price and must omit `price`."
            ),
            quantity: decimal.optional().describe(
                "Share count as a positive decimal string. Provide exactly one of `quantity` or `orderAmount`."
            ),
            orderAmount: decimal.optional().describe(
                "Cash amount to spend instead of a share count, as a positive decimal string. " +
                    "Valid only for MARKET orders. Provide exactly one of `quantity` or `orderAmount`."
            ),
            price: decimal.optional().describe(
                "Limit price as a positive decimal string. Required for LIMIT, rejected for MARKET."
            ),
            timeInForce: z.enum(["DAY", "CLS"]).optional().describe(
                "DAY keeps the order working for the current session; CLS routes it to the closing " +
                    "auction. Defaults to DAY when omitted."
            )
        }, annotations: { destructiveHint: true, openWorldHint: true }
    }, async (order) => {
        validateDirect(order);
        const prepared = confirmations.create({ kind: "order", request: order });
        return result({ status: "awaiting_user_confirmation", order, confirmationToken: prepared.token, expiresAt: prepared.expiresAt,
            instruction: "Ask the user to explicitly confirm this exact order. Do not submit without confirmation." });
    });

    server.registerTool("toss_prepare_conditional_order", {
        title: "Prepare conditional stock order",
        description:
            "Previews a NEW conditional order that stays dormant until its trigger price is reached. " +
            "SINGLE arms one leg. OCO arms two legs where filling either one cancels the other " +
            "(typical take-profit plus stop-loss pair). OTO arms a second leg that is placed only " +
            "after the first leg fills. For an order that should execute right away use " +
            "toss_prepare_order instead." +
            safetyContract,
        inputSchema: {
            symbol: z.string().min(1).describe(
                "Korean 6-digit code (e.g. '005930') or US ticker (e.g. 'NVDA'). " +
                    "Call toss_resolve_symbol first if you only have a company name."
            ),
            type: z.enum(["SINGLE", "OCO", "OTO"]).describe(
                "SINGLE uses `first` only. OCO and OTO both require `second`."
            ),
            quantity: decimal.describe("Share count for the order, as a positive decimal string."),
            orderType: orderType.describe(
                "LIMIT requires `orderPrice` on every leg. MARKET forbids it. " +
                    "OCO and OTO accept LIMIT only."
            ),
            expireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe(
                "Last KST date the condition stays armed, formatted YYYY-MM-DD, e.g. '2026-12-31'."
            ),
            first: leg.describe("Primary leg, armed as soon as the order is accepted."),
            second: leg.optional().describe(
                "Second leg. Required for OCO and OTO; must be omitted for SINGLE."
            )
        },
        annotations: { destructiveHint: true, openWorldHint: true }
    }, async (order) => {
        validateConditional(order);
        const prepared = confirmations.create({ kind: "conditional", request: order });
        return result({ status: "awaiting_user_confirmation", conditionalOrder: order, confirmationToken: prepared.token, expiresAt: prepared.expiresAt,
            instruction: "Ask the user to explicitly confirm this exact conditional order. Do not submit without confirmation." });
    });

    server.registerTool("toss_prepare_order_modify", {
        title: "Prepare order modification",
        description:
            "Previews a change to an EXISTING open regular order — its quantity, price, or order type. " +
            "The order keeps its identity; only the listed fields change. Find the orderId with " +
            "toss_get_orders (status 'OPEN'). Use toss_prepare_conditional_order_modify for " +
            "conditional orders." +
            safetyContract,
        inputSchema: {
            orderId: z.string().min(1).describe("Identifier of the open order, as returned by toss_get_orders."),
            orderType: orderType.describe(
                "Order type after the change. LIMIT requires `price`; MARKET forbids it."
            ),
            quantity: decimal.optional().describe(
                "New share count as a positive decimal string. Omit to leave the quantity unchanged."
            ),
            price: decimal.optional().describe(
                "New limit price as a positive decimal string. Required when `orderType` is LIMIT."
            )
        },
        annotations: { destructiveHint: true, openWorldHint: true }
    }, async (request) => {
        if (request.orderType === "LIMIT" && !request.price) throw new Error("LIMIT modifications require price.");
        if (request.orderType === "MARKET" && request.price) throw new Error("MARKET modifications cannot include price.");
        const prepared = confirmations.create({ kind: "modify_order", request });
        return result({ status: "awaiting_user_confirmation", modification: request, confirmationToken: prepared.token, expiresAt: prepared.expiresAt });
    });

    server.registerTool("toss_prepare_order_cancel", {
        title: "Prepare order cancellation",
        description:
            "Previews the withdrawal of an EXISTING open regular order so that none of its remaining " +
            "quantity can fill. Already-executed shares are unaffected — cancelling never reverses a " +
            "fill. Find the orderId with toss_get_orders (status 'OPEN'). Use " +
            "toss_prepare_conditional_order_cancel for conditional orders." +
            safetyContract,
        inputSchema: {
            orderId: z.string().min(1).describe("Identifier of the open order to cancel, as returned by toss_get_orders.")
        }, annotations: { destructiveHint: true, openWorldHint: true }
    }, async ({ orderId }) => {
        const prepared = confirmations.create({ kind: "cancel_order", orderId });
        return result({ status: "awaiting_user_confirmation", cancelOrderId: orderId, confirmationToken: prepared.token, expiresAt: prepared.expiresAt });
    });

    server.registerTool("toss_prepare_conditional_order_modify", {
        title: "Prepare conditional order modification",
        description:
            "Previews a change to an EXISTING conditional order that has not triggered yet — its " +
            "trigger prices, legs, quantity, or expiry. Every field is replaced, so send the complete " +
            "intended state rather than only the parts you want changed. The symbol cannot be changed; " +
            "cancel and create a new order for that. Find the conditionalOrderId with " +
            "toss_get_conditional_orders (status 'OPEN')." +
            safetyContract,
        inputSchema: {
            conditionalOrderId: z.string().min(1).describe(
                "Identifier of the conditional order, as returned by toss_get_conditional_orders."
            ),
            type: z.enum(["SINGLE", "OCO", "OTO"]).describe(
                "Type after the change. SINGLE uses `first` only; OCO and OTO both require `second`."
            ),
            quantity: decimal.describe("Share count after the change, as a positive decimal string."),
            orderType: orderType.describe(
                "LIMIT requires `orderPrice` on every leg. MARKET forbids it. OCO and OTO accept LIMIT only."
            ),
            expireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe(
                "Last KST date the condition stays armed, formatted YYYY-MM-DD."
            ),
            first: leg.describe("Primary leg after the change."),
            second: leg.optional().describe(
                "Second leg. Required for OCO and OTO; must be omitted for SINGLE."
            )
        },
        annotations: { destructiveHint: true, openWorldHint: true }
    }, async (request) => {
        validateConditional({ ...request, symbol: "_" });
        const prepared = confirmations.create({ kind: "modify_conditional", request });
        return result({ status: "awaiting_user_confirmation", conditionalModification: request, confirmationToken: prepared.token, expiresAt: prepared.expiresAt });
    });

    server.registerTool("toss_prepare_conditional_order_cancel", {
        title: "Prepare conditional order cancellation",
        description:
            "Previews the removal of an EXISTING conditional order so that it can no longer trigger. " +
            "Legs that already triggered and became live orders are unaffected — cancel those with " +
            "toss_prepare_order_cancel. Find the conditionalOrderId with toss_get_conditional_orders." +
            safetyContract,
        inputSchema: {
            conditionalOrderId: z.string().min(1).describe(
                "Identifier of the conditional order to remove, as returned by toss_get_conditional_orders."
            )
        }, annotations: { destructiveHint: true, openWorldHint: true }
    }, async ({ conditionalOrderId }) => {
        const prepared = confirmations.create({ kind: "cancel_conditional", conditionalOrderId });
        return result({ status: "awaiting_user_confirmation", cancelConditionalOrderId: conditionalOrderId, confirmationToken: prepared.token, expiresAt: prepared.expiresAt });
    });

    server.registerTool("toss_submit_prepared_order", {
        title: "Submit confirmed prepared order",
        description: "Places the previously prepared order. Call only after the user has explicitly confirmed the exact preview in this conversation. The confirmation token is single-use and expires after 60 seconds.",
        inputSchema: {
            confirmationToken: z.string().uuid().describe(
                "The token returned by the matching toss_prepare_* call. It is bound to that exact " +
                    "preview, so a token cannot be reused for a different order."
            ),
            userConfirmed: z.literal(true).describe(
                "Set to true only after the user has explicitly approved the preview in this conversation."
            )
        },
        annotations: { destructiveHint: true, openWorldHint: true }
    }, async ({ confirmationToken }) => {
        const pending = confirmations.consume(confirmationToken);
        const clientOrderId = confirmationToken.replaceAll("-", "");
        if (pending.kind === "order") {
            const response = await client.post<{ orderId: string; clientOrderId?: string }>("/api/v1/orders", { ...pending.request, clientOrderId, confirmHighValueOrder: true });
            return result({ status: "submitted", kind: "order", ...response });
        }
        if (pending.kind === "conditional") {
            const response = await client.post<{ conditionalOrderId: string; clientOrderId?: string }>("/api/v1/conditional-orders", { ...pending.request, clientOrderId, confirmHighValueOrder: true });
            return result({ status: "submitted", kind: "conditional_order", ...response });
        }
        if (pending.kind === "modify_order") {
            const { orderId, ...request } = pending.request;
            const res = await client.post<Record<string, unknown>>(`/api/v1/orders/${encodeURIComponent(orderId)}/modify`, { ...request, confirmHighValueOrder: true });
            return result({ status: "submitted", kind: "order_modification", ...res });
        }
        if (pending.kind === "cancel_order") {
            const res = await client.post<Record<string, unknown>>(`/api/v1/orders/${encodeURIComponent(pending.orderId)}/cancel`, {});
            return result({ status: "submitted", kind: "order_cancellation", ...res });
        }
        if (pending.kind === "modify_conditional") {
            const { conditionalOrderId, ...request } = pending.request;
            const res = await client.post<Record<string, unknown>>(`/api/v1/conditional-orders/${encodeURIComponent(conditionalOrderId)}/modify`, { ...request, confirmHighValueOrder: true });
            return result({ status: "submitted", kind: "conditional_order_modification", ...res });
        }
        await client.delete(`/api/v1/conditional-orders/${encodeURIComponent(pending.conditionalOrderId)}`);
        return result({ status: "submitted", kind: "conditional_order_cancellation", conditionalOrderId: pending.conditionalOrderId });
    });
}
