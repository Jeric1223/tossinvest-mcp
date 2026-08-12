import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TossClient } from "../client.js";
import { toNumber, toPercent } from "../parse.js";

interface Bucket {
    krw: string;
    usd: string;
}

export interface HoldingsOverview {
    totalPurchaseAmount: Bucket;
    marketValue: { amount: Bucket; amountAfterCost: Bucket };
    profitLoss: { amount: Bucket; rate: string };
    items: Array<{
        symbol: string;
        name: string;
        marketCountry: string;
        currency: string;
        quantity: string;
        lastPrice: string;
        averagePurchasePrice: string;
        marketValue: { purchaseAmount: string; amount: string };
        profitLoss: { amount: string; rate: string };
    }>;
}

interface CurrencyTotal {
    purchaseAmount: number | null;
    marketValue: number | null;
    profitLoss: number | null;
    profitLossPercent: number | null;
}

export interface FormattedHoldings {
    asOf: string;
    totals: { krw: CurrencyTotal; usd: CurrencyTotal };
    items: Array<{
        symbol: string;
        name: string;
        marketCountry: string;
        currency: string;
        quantity: number | null;
        lastPrice: number | null;
        averagePurchasePrice: number | null;
        purchaseAmount: number | null;
        marketValue: number | null;
        profitLoss: number | null;
        profitLossPercent: number | null;
    }>;
    note: string;
}

const NOTE =
    "Totals are per-currency buckets: KRW covers domestic holdings, USD covers US holdings. " +
    "Cash is NOT included — call toss_get_buying_power for buying power. " +
    "Percentages are computed from the amounts, not from the API's top-level rate field.";

function buildTotal(purchase: string, marketValue: string, profitLoss: string): CurrencyTotal {
    const purchaseAmount = toNumber(purchase);
    const value = toNumber(marketValue);
    const profit = toNumber(profitLoss);
    const percent =
        purchaseAmount !== null && profit !== null && purchaseAmount !== 0
            ? Math.round((profit / purchaseAmount) * 10000) / 100
            : null;
    return { purchaseAmount, marketValue: value, profitLoss: profit, profitLossPercent: percent };
}

export function formatHoldings(overview: HoldingsOverview): FormattedHoldings {
    return {
        asOf: new Date().toISOString(),
        totals: {
            krw: buildTotal(
                overview.totalPurchaseAmount.krw,
                overview.marketValue.amount.krw,
                overview.profitLoss.amount.krw
            ),
            usd: buildTotal(
                overview.totalPurchaseAmount.usd,
                overview.marketValue.amount.usd,
                overview.profitLoss.amount.usd
            )
        },
        items: overview.items.map((item) => ({
            symbol: item.symbol,
            name: item.name,
            marketCountry: item.marketCountry,
            currency: item.currency,
            quantity: toNumber(item.quantity),
            lastPrice: toNumber(item.lastPrice),
            averagePurchasePrice: toNumber(item.averagePurchasePrice),
            purchaseAmount: toNumber(item.marketValue.purchaseAmount),
            marketValue: toNumber(item.marketValue.amount),
            profitLoss: toNumber(item.profitLoss.amount),
            profitLossPercent: toPercent(item.profitLoss.rate)
        })),
        note: NOTE
    };
}

export function registerHoldingsTool(server: McpServer, client: TossClient): void {
    server.registerTool(
        "toss_get_holdings",
        {
            title: "Get holdings",
            description:
                "Returns the actual positions and P&L in the Toss Securities account. " +
                "Prefer this over any hand-maintained portfolio file, which may be out of date.",
            inputSchema: {},
            annotations: { readOnlyHint: true, openWorldHint: true }
        },
        async () => {
            const overview = await client.get<HoldingsOverview>("/api/v1/holdings", {
                accountScoped: true
            });
            return {
                content: [{ type: "text", text: JSON.stringify(formatHoldings(overview), null, 2) }]
            };
        }
    );
}
