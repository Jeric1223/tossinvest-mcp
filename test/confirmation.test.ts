import test from "node:test";
import assert from "node:assert/strict";
import { ConfirmationStore } from "../src/confirmation.js";

test("확인 토큰은 한 번만 소비할 수 있다", () => {
    const store = new ConfirmationStore<{ symbol: string }>();
    const pending = store.create({ symbol: "000660" });
    assert.deepEqual(store.consume(pending.token), { symbol: "000660" });
    assert.throws(() => store.consume(pending.token), /Unknown or already-used/);
});

test("만료된 확인 토큰은 주문에 사용할 수 없다", () => {
    let now = 0;
    const store = new ConfirmationStore(100, () => now);
    const pending = store.create({});
    now = 100;
    assert.throws(() => store.consume(pending.token), /expired/);
});
