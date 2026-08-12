import test from "node:test";
import assert from "node:assert/strict";
import { registerOrderInfoTools } from "../src/tools/orderInfo.js";
import { TossClient } from "../src/client.js";

test("registerOrderInfoTools registers all expected tools", () => {
    const registered = new Set<string>();
    const mockServer = {
        registerTool: (name: string) => registered.add(name)
    } as any;
    const mockClient = {} as TossClient;
    registerOrderInfoTools(mockServer, mockClient);

    const expectedTools = [
        "toss_get_orders",
        "toss_get_order",
        "toss_get_sellable_quantity",
        "toss_get_commissions",
        "toss_get_conditional_orders",
        "toss_get_conditional_order"
    ];

    for (const tool of expectedTools) {
        assert.ok(registered.has(tool), `Tool ${tool} not registered`);
    }
});
