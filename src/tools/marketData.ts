import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TossClient } from "../client.js";

const symbol = z.string().min(1).max(30);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const count = z.number().int().min(1).max(200).optional();
const output = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
const readOnly = { readOnlyHint: true, openWorldHint: true };

export function registerMarketDataTools(server: McpServer, client: TossClient): void {
    server.registerTool("toss_get_orderbook", { title: "Get order book", description: "Returns live ask and bid levels for a Korean stock code or US ticker.", inputSchema: { symbol }, annotations: readOnly }, async ({ symbol }) =>
        output(await client.get("/api/v1/orderbook", { query: { symbol } })));

    server.registerTool("toss_get_recent_trades", { title: "Get recent trades", description: "Returns recent executions for a Korean stock code or US ticker.", inputSchema: { symbol, count: z.number().int().min(1).max(50).optional() }, annotations: readOnly }, async ({ symbol, count }) =>
        output(await client.get("/api/v1/trades", { query: { symbol, count: count?.toString() } })));

    server.registerTool("toss_get_market_calendar", { title: "Get market hours", description: "Returns session and holiday information for the Korean or US market, including adjacent business days.", inputSchema: { market: z.enum(["KR", "US"]), date: date.optional().describe("KST date, YYYY-MM-DD. Omit for today.") }, annotations: readOnly }, async ({ market, date }) =>
        output(await client.get(`/api/v1/market-calendar/${market}`, { query: { date } })));

    server.registerTool("toss_get_stock_warnings", { title: "Get stock warnings", description: "Returns investment cautions, liquidation trading, volatility interruption, and warrant warnings.", inputSchema: { symbol }, annotations: readOnly }, async ({ symbol }) =>
        output(await client.get(`/api/v1/stocks/${encodeURIComponent(symbol)}/warnings`)));

    server.registerTool("toss_get_stock_investor_trading", { title: "Get stock investor trading", description: "Returns daily Korean-stock trading trends for retail, foreign, institutional, and other investors.", inputSchema: { symbol: z.string().regex(/^\d{6}$/), count: count, until: date.optional() }, annotations: readOnly }, async ({ symbol, count, until }) =>
        output(await client.get(`/api/v1/stocks/${symbol}/investor-trading`, { query: { count: count?.toString(), until } })));

    server.registerTool("toss_get_short_selling", { title: "Get short-selling trends", description: "Returns daily Korean-stock short-selling volume, value, and ratio.", inputSchema: { symbol: z.string().regex(/^\d{6}$/), count, until: date.optional() }, annotations: readOnly }, async ({ symbol, count, until }) =>
        output(await client.get(`/api/v1/stocks/${symbol}/short-selling`, { query: { count: count?.toString(), until } })));

    server.registerTool("toss_get_rankings", { title: "Get stock rankings", description: "Ranks Korean or US stocks by trading amount, volume, gainers, or losers.", inputSchema: { type: z.enum(["MARKET_TRADING_AMOUNT", "MARKET_TRADING_VOLUME", "TOP_GAINERS", "TOP_LOSERS", "TOSS_SECURITIES_TRADING_AMOUNT", "TOSS_SECURITIES_TRADING_VOLUME"]), marketCountry: z.enum(["KR", "US"]), duration: z.enum(["realtime", "1d", "1w", "1mo", "3mo", "6mo", "1y"]), excludeInvestmentCaution: z.boolean().optional(), count: z.number().int().min(1).max(100).optional() }, annotations: readOnly }, async (input) =>
        output(await client.get("/api/v1/rankings", { query: { ...Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v === undefined ? undefined : String(v)])) } })));

    server.registerTool("toss_get_market_indicator_prices", { title: "Get market indicator prices", description: "Returns current prices for market indicators such as KOSPI and KOSDAQ. Pass one or more documented indicator symbols.", inputSchema: { symbols: z.array(symbol).min(1).max(100) }, annotations: readOnly }, async ({ symbols }) =>
        output(await client.get("/api/v1/market-indicators/prices", { query: { symbols: symbols.join(",") } })));

    server.registerTool("toss_get_market_indicator_candles", { title: "Get market indicator candles", description: "Returns 1-minute or daily OHLCV candles for a market indicator.", inputSchema: { symbol, interval: z.enum(["1m", "1d"]), count, before: z.string().datetime().optional() }, annotations: readOnly }, async ({ symbol, interval, count, before }) =>
        output(await client.get(`/api/v1/market-indicators/${encodeURIComponent(symbol)}/candles`, { query: { interval, count: count?.toString(), before } })));

    server.registerTool("toss_get_market_investor_trading", { title: "Get index investor trading", description: "Returns investor trading value trends for KOSPI or KOSDAQ.", inputSchema: { symbol: z.enum(["KOSPI", "KOSDAQ"]), interval: z.enum(["1d", "1w", "1mo", "1y"]), count: z.number().int().min(1).max(100).optional(), until: date.optional() }, annotations: readOnly }, async ({ symbol, interval, count, until }) =>
        output(await client.get(`/api/v1/market-indicators/${symbol}/investor-trading`, { query: { interval, count: count?.toString(), until } })));
}
