import test from "node:test";
import assert from "node:assert/strict";
import { formatHoldings, type HoldingsOverview } from "../src/tools/holdings.js";

// Synthetic fixture. Shapes mirror the live API; values are made up.
const fixture: HoldingsOverview = {
    totalPurchaseAmount: { krw: "1000000", usd: "2000" },
    marketValue: {
        amount: { krw: "1100000", usd: "1500" },
        amountAfterCost: { krw: "1099000", usd: "1495" }
    },
    profitLoss: {
        amount: { krw: "100000", usd: "-500" },
        rate: "-0.1"
    },
    items: [
        {
            symbol: "005930",
            name: "삼성전자",
            marketCountry: "KR",
            currency: "KRW",
            quantity: "10",
            lastPrice: "110000",
            averagePurchasePrice: "100000",
            marketValue: { purchaseAmount: "1000000", amount: "1100000" },
            profitLoss: { amount: "100000", rate: "0.1" }
        },
        {
            symbol: "NVDA",
            name: "엔비디아",
            marketCountry: "US",
            currency: "USD",
            quantity: "1.5",
            lastPrice: "1000",
            averagePurchasePrice: "1333.333333",
            marketValue: { purchaseAmount: "2000", amount: "1500" },
            profitLoss: { amount: "-500", rate: "-0.25" }
        }
    ]
};

test("수량과 금액을 숫자로 변환한다", () => {
    const result = formatHoldings(fixture);
    assert.equal(result.items[0].quantity, 10);
    assert.equal(result.items[0].marketValue, 1100000);
});

test("소수 수량을 정수로 반올림하지 않는다", () => {
    assert.equal(formatHoldings(fixture).items[1].quantity, 1.5);
});

test("수익률을 백분율로 변환한다", () => {
    const result = formatHoldings(fixture);
    assert.equal(result.items[0].profitLossPercent, 10);
    assert.equal(result.items[1].profitLossPercent, -25);
});

test("통화별 합계를 보존한다 — KRW 버킷은 국내, USD 버킷은 미국이다", () => {
    const result = formatHoldings(fixture);
    assert.equal(result.totals.krw.purchaseAmount, 1000000);
    assert.equal(result.totals.usd.purchaseAmount, 2000);
    assert.equal(result.totals.usd.marketValue, 1500);
});

test("통화별 수익률을 금액에서 직접 계산한다", () => {
    // The top-level profitLoss.rate cannot be derived from either bucket,
    // so we compute per-currency rates ourselves.
    const result = formatHoldings(fixture);
    assert.equal(result.totals.krw.profitLossPercent, 10);
    assert.equal(result.totals.usd.profitLossPercent, -25);
});

test("예수금이 포함되지 않는다는 사실을 결과에 명시한다", () => {
    assert.match(formatHoldings(fixture).note, /buying power/i);
});

test("보유 종목이 없어도 빈 배열로 정상 처리한다", () => {
    const empty: HoldingsOverview = { ...fixture, items: [] };
    assert.deepEqual(formatHoldings(empty).items, []);
});
