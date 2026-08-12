import test from "node:test";
import assert from "node:assert/strict";
import { SymbolIndex, type StockEntry } from "../src/symbols.js";

const entries: StockEntry[] = [
    { symbol: "005930", name: "삼성전자", market: "KOSPI", securityType: "STOCK", isCommonShare: true },
    { symbol: "005935", name: "삼성전자우", market: "KOSPI", securityType: "STOCK", isCommonShare: false },
    { symbol: "000660", name: "SK하이닉스", market: "KOSPI", securityType: "STOCK", isCommonShare: true },
    { symbol: "NVDA", name: "엔비디아", market: "NASDAQ", securityType: "FOREIGN_STOCK", isCommonShare: true }
];

const index = new SymbolIndex(entries);

test("정확한 국내 코드로 해석한다", () => {
    const result = index.resolve("005930");
    assert.equal(result.exact, true);
    assert.equal(result.matched[0].name, "삼성전자");
});

test("미국 티커는 대소문자를 가리지 않는다", () => {
    const result = index.resolve("nvda");
    assert.equal(result.exact, true);
    assert.equal(result.matched[0].symbol, "NVDA");
});

test("정확한 종목명으로 해석한다", () => {
    const result = index.resolve("삼성전자");
    assert.equal(result.exact, true);
    assert.equal(result.matched.length, 1);
    assert.equal(result.matched[0].symbol, "005930");
});

test("정확한 종목명이 우선한다 — 삼성전자가 삼성전자우에 밀리지 않는다", () => {
    assert.equal(index.resolve("삼성전자").matched[0].symbol, "005930");
});

test("부분일치는 exact=false 로 후보를 모두 돌려준다", () => {
    const result = index.resolve("삼성");
    assert.equal(result.exact, false);
    assert.deepEqual(result.matched.map((entry) => entry.symbol).sort(), ["005930", "005935"]);
});

test("부분일치는 이름이 짧은 순으로 정렬한다", () => {
    assert.equal(index.resolve("삼성").matched[0].name, "삼성전자");
});

test("매칭이 없으면 빈 배열", () => {
    const result = index.resolve("존재하지않는종목");
    assert.equal(result.exact, false);
    assert.deepEqual(result.matched, []);
});

test("앞뒤 공백을 무시한다", () => {
    assert.equal(index.resolve("  삼성전자  ").matched[0].symbol, "005930");
});

test("nameOf 로 심볼에서 종목명을 얻는다", () => {
    assert.equal(index.nameOf("005930"), "삼성전자");
    assert.equal(index.nameOf("nvda"), "엔비디아");
    assert.equal(index.nameOf("999999"), undefined);
});
