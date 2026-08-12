#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TossClient } from "./client.js";
import { loadSymbolIndex } from "./symbols.js";
import { registerPriceTool } from "./tools/price.js";
import { registerResolveSymbolTool } from "./tools/resolveSymbol.js";
import { registerHoldingsTool } from "./tools/holdings.js";
import { registerBuyingPowerTool } from "./tools/buyingPower.js";
import { registerExchangeRateTool } from "./tools/exchangeRate.js";
import { registerCandlesTool } from "./tools/candles.js";

// From dist/src/index.js, two levels up is the package root.
// Deriving it from the file location keeps us independent of the launcher's cwd.
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function loadCredentials(): { clientId: string; clientSecret: string } {
    const fromEnv = {
        clientId: process.env.TOSS_CLIENT_ID,
        clientSecret: process.env.TOSS_CLIENT_SECRET
    };
    if (fromEnv.clientId && fromEnv.clientSecret) {
        return { clientId: fromEnv.clientId, clientSecret: fromEnv.clientSecret };
    }

    const values = new Map<string, string>();
    try {
        const raw = readFileSync(resolve(packageRoot, ".env"), "utf8");
        for (const line of raw.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) {
                continue;
            }
            const separator = trimmed.indexOf("=");
            if (separator === -1) {
                continue;
            }
            values.set(trimmed.slice(0, separator).trim(), trimmed.slice(separator + 1).trim());
        }
    } catch {
        // No .env file: fall through to the error below.
    }

    const clientId = values.get("TOSS_CLIENT_ID");
    const clientSecret = values.get("TOSS_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
        throw new Error(
            "TOSS_CLIENT_ID and TOSS_CLIENT_SECRET must be set, either as environment " +
                "variables or in a .env file at the package root."
        );
    }
    return { clientId, clientSecret };
}

const { clientId, clientSecret } = loadCredentials();
const client = new TossClient({ clientId, clientSecret });
const symbols = await loadSymbolIndex(client, resolve(packageRoot, "cache/symbols.json"));

const server = new McpServer({ name: "toss", version: "0.1.0" });

registerPriceTool(server, client, symbols);
registerResolveSymbolTool(server, symbols);
registerHoldingsTool(server, client);
registerBuyingPowerTool(server, client);
registerExchangeRateTool(server, client);
registerCandlesTool(server, client);

// stdout carries the MCP protocol. All logging must go to stderr.
await server.connect(new StdioServerTransport());
console.error("[toss-mcp] server started");
