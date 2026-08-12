# tossinvest-mcp

[한국어 안내](README.ko.md)

A read-only [Model Context Protocol (MCP)](https://modelcontextprotocol.io)
server for the [Toss Securities Open API](https://developers.tossinvest.com).
It lets an AI assistant retrieve market data and account information without
placing, changing, or cancelling orders.

## Install in Claude Code

Once this package has been published to npm, cloning is not required. Add the
following to `.mcp.json` in the project where you use Claude Code:

```json
{
  "mcpServers": {
    "toss": {
      "command": "npx",
      "args": ["-y", "@soehd0889/tossinvest-mcp"],
      "env": {
        "TOSS_CLIENT_ID": "your_toss_client_id",
        "TOSS_CLIENT_SECRET": "your_toss_client_secret"
      }
    }
  }
}
```

Get both values from the Toss Securities Open API developer console. Restart
Claude Code after saving the file. Keep these credentials out of Git and never
share them in a prompt or commit.

> `npx` downloads the package on the first run and reuses its cache later.
> Node.js 18 or later is required.

## Tools

| Tool | Description |
| --- | --- |
| `toss_get_price` | Current Korean and US stock prices |
| `toss_resolve_symbol` | Resolves a company name to its ticker or Korean stock code |
| `toss_get_holdings` | Positions and profit/loss |
| `toss_get_buying_power` | Available KRW or USD cash |
| `toss_get_exchange_rate` | Exchange rates; USD to KRW by default |
| `toss_get_candles` | 1-minute or daily OHLCV candles |

## Local development

```bash
git clone https://github.com/Jeric1223/tossinvest-mcp.git
cd tossinvest-mcp
npm install
npm test
```

For local use, create `.env` from `.env.example` and add your credentials:

```bash
cp .env.example .env
```

## Notes

- The first run downloads stock-master data for KOSPI, KOSDAQ, NASDAQ, NYSE,
  and AMEX. It is cached and refreshed daily afterwards.
- API numeric fields are returned as strings, and rate values are decimal
  fractions (`-0.3799` means -37.99%).
- The API rate limits are 15 requests/sec for market data, 5 for assets, and
  1 for accounts.

## Disclaimer

Unofficial; not affiliated with Toss Securities. This project provides no
investment advice. Use at your own risk.

## License

[MIT](LICENSE)
