import test from "node:test";
import assert from "node:assert/strict";
import { unwrap, toNumber, toPercent } from "../src/parse.js";

test("unwrap: result 필드를 벗겨낸다", () => {
    assert.deepEqual(unwrap<{ a: number }>({ result: { a: 1 } }), { a: 1 });
});

test("unwrap: 배열 result 도 그대로 반환한다", () => {
    assert.deepEqual(unwrap<number[]>({ result: [1, 2] }), [1, 2]);
});

test("unwrap: result 가 없으면 던진다 (data 래퍼를 잘못 가정하는 실수 방지)", () => {
    assert.throws(() => unwrap({ data: 1 }), TypeError);
});

test("toNumber: 정수 문자열", () => {
    assert.equal(toNumber("243500"), 243500);
});

test("toNumber: 소수 수량 (보유 수량은 정수가 아니다)", () => {
    assert.equal(toNumber("1.048615"), 1.048615);
});

test("toNumber: 음수", () => {
    assert.equal(toNumber("-0.3799"), -0.3799);
});

test("toNumber: null / undefined / 빈 문자열은 null 로 보존한다", () => {
    assert.equal(toNumber(null), null);
    assert.equal(toNumber(undefined), null);
    assert.equal(toNumber(""), null);
});

test("toNumber: 0 을 null 로 바꾸지 않는다", () => {
    assert.equal(toNumber("0"), 0);
});

test("toNumber: 파싱 불가능한 값은 던진다", () => {
    assert.throws(() => toNumber("abc"), TypeError);
});

test("toPercent: 소수 비율을 백분율로 변환한다", () => {
    assert.equal(toPercent("-0.3799"), -37.99);
    assert.equal(toPercent("0.0786"), 7.86);
    assert.equal(toPercent("-0.1235"), -12.35);
});

test("toPercent: null 보존", () => {
    assert.equal(toPercent(null), null);
});
