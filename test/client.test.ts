import test from "node:test";
import assert from "node:assert/strict";
import { TossClient } from "../src/client.js";
import { TossApiError } from "../src/parse.js";

function tokenResponse(expiresIn = 86399): Response {
    return new Response(
        JSON.stringify({ access_token: "tok", token_type: "Bearer", expires_in: expiresIn }),
        { status: 200, headers: { "content-type": "application/json" } }
    );
}

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" }
    });
}

function makeClient(handlers: Array<() => Response>, now = () => 0) {
    const calls: string[] = [];
    let index = 0;
    const fetchImpl = (async (input: string | URL) => {
        calls.push(String(input));
        const handler = handlers[Math.min(index, handlers.length - 1)];
        index += 1;
        return handler();
    }) as unknown as typeof fetch;

    const client = new TossClient({
        clientId: "id",
        clientSecret: "secret",
        fetchImpl,
        now,
        sleep: async () => {}
    });
    return { client, calls };
}

test("토큰을 캐시해 두 번째 호출에서 재발급하지 않는다", async () => {
    const { client, calls } = makeClient([
        () => tokenResponse(),
        () => jsonResponse({ result: [] }),
        () => jsonResponse({ result: [] })
    ]);

    await client.get("/api/v1/prices");
    await client.get("/api/v1/prices");

    assert.equal(calls.filter((url) => url.includes("/oauth2/token")).length, 1);
});

test("만료 60초 전이면 토큰을 미리 갱신한다", async () => {
    let clock = 0;
    const { client, calls } = makeClient(
        [
            () => tokenResponse(100),
            () => jsonResponse({ result: [] }),
            () => tokenResponse(100),
            () => jsonResponse({ result: [] })
        ],
        () => clock
    );

    await client.get("/api/v1/prices");
    clock = 45_000; // 만료까지 55초 → 스큐(60초) 안으로 들어옴
    await client.get("/api/v1/prices");

    assert.equal(calls.filter((url) => url.includes("/oauth2/token")).length, 2);
});

test("401 이면 토큰을 버리고 한 번만 재시도한다", async () => {
    const { client, calls } = makeClient([
        () => tokenResponse(),
        () => jsonResponse({ code: "UNAUTHORIZED", message: "expired", requestId: "r1" }, 401),
        () => tokenResponse(),
        () => jsonResponse({ result: [{ symbol: "AAAA" }] })
    ]);

    const result = await client.get<Array<{ symbol: string }>>("/api/v1/prices");

    assert.deepEqual(result, [{ symbol: "AAAA" }]);
    assert.equal(calls.filter((url) => url.includes("/oauth2/token")).length, 2);
});

test("401 이 두 번 연속이면 재시도를 멈추고 던진다", async () => {
    const { client } = makeClient([
        () => tokenResponse(),
        () => jsonResponse({ code: "UNAUTHORIZED", message: "bad key", requestId: "r1" }, 401),
        () => tokenResponse(),
        () => jsonResponse({ code: "UNAUTHORIZED", message: "bad key", requestId: "r2" }, 401)
    ]);

    await assert.rejects(
        () => client.get("/api/v1/prices"),
        (error: unknown) => {
            assert.ok(error instanceof TossApiError);
            assert.equal(error.status, 401);
            assert.equal(error.code, "UNAUTHORIZED");
            return true;
        }
    );
});

test("429 는 최대 3회 백오프 후 실패한다", async () => {
    let dataCalls = 0;
    const { client } = makeClient([
        () => tokenResponse(),
        () => {
            dataCalls += 1;
            return jsonResponse({ code: "RATE_LIMITED", message: "slow", requestId: "r" }, 429);
        }
    ]);

    await assert.rejects(() => client.get("/api/v1/prices"), TossApiError);
    assert.equal(dataCalls, 4); // 최초 1회 + 재시도 3회
});

test("getAccountSeq 는 BROKERAGE 계좌를 골라 캐시한다", async () => {
    const { client, calls } = makeClient([
        () => tokenResponse(),
        () =>
            jsonResponse({
                result: [
                    { accountNo: "1", accountSeq: 7, accountType: "PENSION" },
                    { accountNo: "2", accountSeq: 3, accountType: "BROKERAGE" }
                ]
            }),
        () => jsonResponse({ result: [] })
    ]);

    assert.equal(await client.getAccountSeq(), 3);
    assert.equal(await client.getAccountSeq(), 3);

    assert.equal(calls.filter((url) => url.includes("/api/v1/accounts")).length, 1);
});

test("accountScoped 요청에 X-Tossinvest-Account 헤더를 붙인다", async () => {
    let capturedHeaders: Record<string, string> = {};
    const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/oauth2/token")) return tokenResponse();
        if (url.includes("/api/v1/accounts")) {
            return jsonResponse({
                result: [{ accountNo: "1", accountSeq: 3, accountType: "BROKERAGE" }]
            });
        }
        capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
        return jsonResponse({ result: { items: [] } });
    }) as unknown as typeof fetch;

    const client = new TossClient({
        clientId: "id",
        clientSecret: "secret",
        fetchImpl,
        now: () => 0,
        sleep: async () => {}
    });

    await client.get("/api/v1/holdings", { accountScoped: true });

    assert.equal(capturedHeaders["X-Tossinvest-Account"], "3");
});

test("undefined 쿼리 파라미터는 URL 에 넣지 않는다", async () => {
    const { client, calls } = makeClient([
        () => tokenResponse(),
        () => jsonResponse({ result: [] })
    ]);

    await client.get("/api/v1/candles", {
        query: { symbol: "005930", interval: "1d", count: undefined }
    });

    const dataCall = calls.find((url) => url.includes("/api/v1/candles"))!;
    assert.ok(dataCall.includes("symbol=005930"));
    assert.ok(!dataCall.includes("count="));
});
