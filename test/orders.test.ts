import test from "node:test";
import assert from "node:assert/strict";
import { registerOrderTools } from "../src/tools/orders.js";
import { TossClient } from "../src/client.js";

test("registerOrderTools registers all expected tools", () => {
    const registered = new Set<string>();
    const mockServer = {
        registerTool: (name: string) => registered.add(name)
    } as any;
    const mockClient = {} as TossClient;
    registerOrderTools(mockServer, mockClient);

    const expectedTools = [
        "toss_prepare_order",
        "toss_prepare_conditional_order",
        "toss_prepare_order_modify",
        "toss_prepare_order_cancel",
        "toss_prepare_conditional_order_modify",
        "toss_prepare_conditional_order_cancel",
        "toss_submit_prepared_order"
    ];

    for (const tool of expectedTools) {
        assert.ok(registered.has(tool), `Tool ${tool} not registered`);
    }
});
