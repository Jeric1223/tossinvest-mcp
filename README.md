# tossinvest-mcp

Read-only [MCP](https://modelcontextprotocol.io) server for the
[Toss Securities Open API](https://developers.tossinvest.com).

Ask your assistant "what's Samsung Electronics trading at?" and get a real quote
instead of a web search.

## Why read-only

The Toss API also exposes order placement, modification, cancellation and
conditional orders. **None of them are implemented here.** A feature that does
not exist cannot misfire. If you need trading, place orders in the Toss app.

## Tools

| Tool | Description |
|---|---|
| `toss_get_price` | Current prices. Korean 6-digit codes and US tickers, mixed in one call |
| `toss_resolve_symbol` | Company name to symbol (`삼성전자` → `005930`) |
| `toss_get_holdings` | Positions and P&L |
| `toss_get_buying_power` | Available cash (KRW / USD) |
| `toss_get_exchange_rate` | FX rate, default USD → KRW |
| `toss_get_candles` | OHLCV candles (1m / 1d) |

## Requirements

- Node.js 18 or newer
- Toss Securities Open API credentials from https://developers.tossinvest.com

## Setup

```bash
git clone https://github.com/Jeric1223/tossinvest-mcp.git
cd tossinvest-mcp
npm install
npm run build
```

Provide credentials either as environment variables or in a `.env` file at the
package root:

```bash
cp .env.example .env
# then edit .env
```

```
TOSS_CLIENT_ID=your_client_id
TOSS_CLIENT_SECRET=your_client_secret
```

## Register with an MCP client

Claude Code — add to `.mcp.json` in your project:

```json
{
  "mcpServers": {
    "toss": {
      "command": "node",
      "args": ["/absolute/path/to/tossinvest-mcp/dist/src/index.js"]
    }
  }
}
```

The server resolves `.env` relative to its own location, so the launcher's
working directory does not matter.

## Notes

- On first run the server downloads the stock master for KOSPI, KOSDAQ, NASDAQ,
  NYSE and AMEX into `cache/symbols.json`. This takes a while; later runs reuse
  the cache and refresh it in the background once a day.
- The API returns every numeric field as a string and every rate as a decimal
  (`-0.3799` meaning −37.99%). Conversion is centralized in `src/parse.ts`.
- Successful responses are wrapped in `{"result": ...}`.
- `toss_get_holdings` does not include cash. Call `toss_get_buying_power` as
  well when computing totals.
- Rate limits: 15 req/s for market data, 5 req/s for assets, **1 req/s for
  accounts**. The client caches the account sequence for the process lifetime
  and coalesces concurrent token and account lookups, so parallel tool calls
  issue only one of each.

## Development

```bash
npm test    # compiles, then runs node:test against dist/test
```

Tests use synthetic fixtures and never call the live API.

## Disclaimer

This is an unofficial client, not affiliated with Toss Securities. Use at your
own risk. Nothing here is investment advice.

## License

MIT
